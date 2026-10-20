import { Queue, type JobsOptions } from "bullmq";
import { prisma } from "@/lib/db";
import { getRedisConnectionOptions } from "./connection";
import { getErrorMessage } from "@/lib/utils";
import { QUEUE_NAMES, type QueueName } from "./connection";

const globalForQueues = globalThis as unknown as {
  queues?: Map<string, Queue>;
};

function queueMap() {
  if (!globalForQueues.queues) globalForQueues.queues = new Map();
  return globalForQueues.queues;
}

export function getQueue(name: QueueName): Queue {
  const map = queueMap();
  const existing = map.get(name);
  if (existing) return existing;
  const queue = new Queue(name, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 60 * 60 * 24, count: 5000 },
      removeOnFail: { age: 60 * 60 * 24 * 7, count: 5000 }
    }
  });
  map.set(name, queue);
  return queue;
}

export type EnqueueOptions = {
  workspaceId: string;
  queue: QueueName;
  name: string;
  data: Record<string, unknown>;
  attempts?: number;
  delay?: number;
};

export async function enqueueTracked({
  workspaceId,
  queue,
  name,
  data,
  attempts = 3,
  delay = 0
}: EnqueueOptions) {
  const jobLog = await prisma.jobLog.create({
    data: {
      workspaceId,
      queue,
      name,
      status: delay > 0 ? "DELAYED" : "QUEUED",
      attempts: 0,
      maxAttempts: attempts,
      payload: data as object
    }
  });

  try {
    const job = await getQueue(queue).add(name, { ...data, jobLogId: jobLog.id }, {
      jobId: jobLog.id,
      attempts,
      ...(delay > 0 ? { delay } : {})
    } as JobsOptions);

    await prisma.jobLog.update({
      where: { id: jobLog.id },
      data: { jobId: String(job.id), status: delay > 0 ? "DELAYED" : "QUEUED" }
    });

    return { job, jobLog };
  } catch (error) {
    await prisma.jobLog.update({
      where: { id: jobLog.id },
      data: { status: "FAILED", error: getErrorMessage(error), finishedAt: new Date() }
    });
    throw error;
  }
}

export async function enqueuePublishPost(input: {
  workspaceId: string;
  postId: string;
  socialAccountId: string;
}) {
  return enqueueTracked({
    workspaceId: input.workspaceId,
    queue: QUEUE_NAMES.SOCIAL_PUBLISH,
    name: "publish-post",
    data: {
      workspaceId: input.workspaceId,
      postId: input.postId,
      socialAccountId: input.socialAccountId
    }
  });
}

export async function enqueueWorkflow(input: {
  workspaceId: string;
  workflowRunId: string;
  delay?: number;
}) {
  return enqueueTracked({
    workspaceId: input.workspaceId,
    queue: QUEUE_NAMES.WORKFLOW,
    name: "run-workflow",
    data: {
      workspaceId: input.workspaceId,
      workflowRunId: input.workflowRunId
    },
    delay: input.delay
  });
}

export async function enqueueEmail(input: {
  workspaceId: string;
  emailSendId: string;
}) {
  return enqueueTracked({
    workspaceId: input.workspaceId,
    queue: QUEUE_NAMES.EMAIL,
    name: "send-email",
    data: {
      workspaceId: input.workspaceId,
      emailSendId: input.emailSendId
    }
  });
}
