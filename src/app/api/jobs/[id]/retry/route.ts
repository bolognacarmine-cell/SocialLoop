import { prisma } from "@/lib/db";
import { ApiError, json, requireWorkspace, withApi } from "@/lib/api";
import { enqueueTracked } from "@/lib/queue/queues";
import type { QueueName } from "@/lib/queue/connection";
import { QUEUE_NAMES } from "@/lib/queue/connection";
import { asRecord } from "@/lib/utils";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const job = await prisma.jobLog.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!job) throw new ApiError(404, "Job non trovato");
  if (job.status !== "FAILED") throw new ApiError(409, "Solo i job falliti possono essere riprovati");

  const queueName = job.queue as QueueName;
  if (!Object.values(QUEUE_NAMES).includes(queueName)) {
    throw new ApiError(422, "Coda non supportata");
  }

  const payload = asRecord(job.payload);
  const enqueued = await enqueueTracked({
    workspaceId: workspace.id,
    queue: queueName,
    name: job.name,
    data: payload,
    attempts: job.maxAttempts
  });

  return json({ jobLog: enqueued.jobLog }, { status: 202 });
});
