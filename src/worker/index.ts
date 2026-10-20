import { Worker, type Job } from "bullmq";
import { getRedisConnectionOptions, QUEUE_NAMES } from "@/lib/queue/connection";
import { publishPostTarget, publishDueScheduledPosts } from "@/lib/social/publish";
import { executeWorkflowRun } from "@/lib/workflows/execute";
import { processEmailJob } from "./processors/email";
import { markJobActive, markJobCompleted, markJobFailed } from "@/lib/jobs";
import { getErrorMessage } from "@/lib/utils";

const connection = getRedisConnectionOptions();

function jobLogId(job: Job) {
  return String((job.data as Record<string, unknown>).jobLogId ?? "");
}

const workers: Worker[] = [];

function attachLifecycle(worker: Worker) {
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
  workers.push(worker);
}

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
attachLifecycle(publishWorker);

const workflowWorker = new Worker(
  QUEUE_NAMES.WORKFLOW,
  async (job) => executeWorkflowRun(String(job.data.workflowRunId)),
  { connection, concurrency: 5 }
);
attachLifecycle(workflowWorker);

const emailWorker = new Worker(
  QUEUE_NAMES.EMAIL,
  async (job) =>
    processEmailJob({
      workspaceId: String(job.data.workspaceId),
      emailSendId: String(job.data.emailSendId)
    }),
  { connection, concurrency: 5 }
);
attachLifecycle(emailWorker);

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
schedulerTimer.unref?.();
void tickScheduler();

console.info("[socialloop] worker ready: social-publish, workflow, email");

async function shutdown(signal: string) {
  console.info(`[socialloop] worker shutting down (${signal})`);
  clearInterval(schedulerTimer);
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
