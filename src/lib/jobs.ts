import { prisma } from "@/lib/db";
import { getErrorMessage } from "@/lib/utils";

export async function markJobActive(jobLogId: string) {
  if (!jobLogId) return;
  await prisma.jobLog
    .update({
      where: { id: jobLogId },
      data: { status: "ACTIVE", startedAt: new Date(), attempts: { increment: 1 } }
    })
    .catch(() => undefined);
}

export async function markJobProgress(jobLogId: string, attempts: number) {
  if (!jobLogId) return;
  await prisma.jobLog
    .update({ where: { id: jobLogId }, data: { attempts } })
    .catch(() => undefined);
}

export async function markJobCompleted(jobLogId: string, result: unknown = {}) {
  if (!jobLogId) return;
  const existing = await prisma.jobLog.findUnique({ where: { id: jobLogId } });
  const now = new Date();
  await prisma.jobLog
    .update({
      where: { id: jobLogId },
      data: {
        status: "COMPLETED",
        result: (result ?? {}) as object,
        finishedAt: now,
        durationMs: existing?.startedAt ? now.getTime() - existing.startedAt.getTime() : null,
        error: null
      }
    })
    .catch(() => undefined);
}

export async function markJobFailed(jobLogId: string, error: unknown, willRetry = false) {
  if (!jobLogId) return;
  const existing = await prisma.jobLog.findUnique({ where: { id: jobLogId } });
  const now = new Date();
  await prisma.jobLog
    .update({
      where: { id: jobLogId },
      data: {
        status: willRetry ? "DELAYED" : "FAILED",
        error: getErrorMessage(error),
        finishedAt: willRetry ? null : now,
        durationMs: existing?.startedAt ? now.getTime() - existing.startedAt.getTime() : null
      }
    })
    .catch(() => undefined);
}

export async function markJobDelayed(jobLogId: string, delayMs: number) {
  if (!jobLogId) return;
  await prisma.jobLog
    .update({
      where: { id: jobLogId },
      data: {
        status: "DELAYED",
        result: { nextRunAt: new Date(Date.now() + delayMs).toISOString() }
      }
    })
    .catch(() => undefined);
}
