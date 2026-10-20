import { Worker, type Job } from "bullmq";
import { getRedisConnectionOptions, QUEUE_NAMES } from "@/lib/queue/connection";
import { publishPostTarget, publishDueScheduledPosts } from "@/lib/social/publish";
import { executeWorkflowRun } from "@/lib/workflows/execute";
import { processEmailJob } from "./processors/email";
import { markJobActive, markJobCompleted, markJobFailed } from "@/lib/jobs";
import { getErrorMessage } from "@/lib/utils";

// Survives Next.js HMR and double module evaluation: `startWorker` must never
// register a second set of BullMQ consumers inside the same process.
const GLOBAL_KEY = "__socialloopWorker" as const;

type WorkerRuntime = {
  workers: Worker[];
  stop: () => Promise<void>;
};

function jobLogId(job: Job) {
  return String((job.data as Record<string, unknown>).jobLogId ?? "");
}

function attachLifecycle(running: WorkerRuntime, worker: Worker) {
  worker.on("active", (job) => {
    void markJobActive(jobLogId(job));
  });
  worker.on("completed", (job, result) => {
    void markJobCompleted(jobLogId(job), result);
    console.info(`[worker:${worker.name}] completed job ${job.id}`);
  });
  worker.on("failed", (job, error) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    const willRetry = job.attemptsMade < attempts;
    void markJobFailed(jobLogId(job), error, willRetry);
    console.error(`[worker:${worker.name}] failed job ${job.id}: ${error.message}`);
  });
  worker.on("error", (error) => {
    console.error(`[worker:${worker.name}] error`, error.message);
  });
  running.workers.push(worker);
}

/**
 * Start the BullMQ consumers and the scheduled-post poller.
 *
 * Safe to call more than once: the second call is a no-op, so Next.js
 * instrumentation, HMR and the standalone `pnpm worker` entrypoint can all
 * invoke it without stacking duplicate consumers.
 *
 * Concurrency safety across processes is handled in the database, not here:
 * `publishDueScheduledPosts` claims each post with a compare-and-swap on
 * `status: "SCHEDULED"`, so multiple instances never double-publish.
 */
export function startWorker(): WorkerRuntime | null {
  const store = globalThis as Record<string, unknown>;
  const existing = store[GLOBAL_KEY] as WorkerRuntime | undefined;
  if (existing) return existing;

  const connection = getRedisConnectionOptions();
  const running: WorkerRuntime = { workers: [], stop: async () => {} };

  const publishWorker = new Worker(
    QUEUE_NAMES.SOCIAL_PUBLISH,
    async (job) =>
      publishPostTarget({
        workspaceId: String(job.data.workspaceId),
        postId: String(job.data.postId),
        socialAccountId: String(job.data.socialAccountId)
      }),
    { connection, concurrency: 3 }
  );
  attachLifecycle(running, publishWorker);

  const workflowWorker = new Worker(
    QUEUE_NAMES.WORKFLOW,
    async (job) => executeWorkflowRun(String(job.data.workflowRunId)),
    { connection, concurrency: 5 }
  );
  attachLifecycle(running, workflowWorker);

  const emailWorker = new Worker(
    QUEUE_NAMES.EMAIL,
    async (job) =>
      processEmailJob({
        workspaceId: String(job.data.workspaceId),
        emailSendId: String(job.data.emailSendId)
      }),
    { connection, concurrency: 5 }
  );
  attachLifecycle(running, emailWorker);

  let schedulerRunning = false;

  async function tickScheduler() {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
      const result = await publishDueScheduledPosts(25);
      if (result.dispatched.length > 0) {
        console.info(`[scheduler] dispatched ${result.dispatched.length} scheduled posts`);
      }
    } catch (error) {
      console.error("[scheduler]", getErrorMessage(error));
    } finally {
      schedulerRunning = false;
    }
  }

  const schedulerTimer = setInterval(tickScheduler, 20_000);
  // Never hold the event loop open on our own account: the web server owns the
  // process lifetime, not the poller.
  schedulerTimer.unref?.();
  void tickScheduler();

  running.stop = async () => {
    clearInterval(schedulerTimer);
    await Promise.all(running.workers.map((worker) => worker.close()));
  };

  store[GLOBAL_KEY] = running;
  console.info("[socialloop] worker ready: social-publish, workflow, email");
  return running;
}

/** Stop the consumers without touching the process. Used by graceful shutdown. */
export async function stopWorker(): Promise<void> {
  const store = globalThis as Record<string, unknown>;
  const running = store[GLOBAL_KEY] as WorkerRuntime | undefined;
  if (!running) return;
  delete store[GLOBAL_KEY];
  await running.stop();
}
