// Start the BullMQ consumers inside the Next.js web process.
//
// Why this exists: the worker originally lived in its own service, which costs
// money on PaaS. By booting it inside the web process the whole app runs as a
// single free-tier service.
//
// Why it is not in instrumentation.ts: that hook gets compiled for every
// runtime in use, and since src/middleware.ts runs on edge, webpack tried to
// bundle bullmq (child_process, worker_threads) into the edge graph and the
// build failed. These call sites are plain Node.js route handlers/components.

let started = false;

export async function ensureEmbeddedWorker(): Promise<void> {
  // Set EMBEDDED_WORKER=false if you deploy the dedicated worker container
  // (Dockerfile.worker) and want exactly one consumer set.
  if (process.env.EMBEDDED_WORKER === "false") return;
  // Never boot consumers while `next build` is rendering pages.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (started) return;
  started = true;

  try {
    const { startWorker } = await import("@/worker/start");
    startWorker();
  } catch (error) {
    // Redis being unreachable must never break the web server: BullMQ manages
    // its own reconnection, and the API keeps serving in the meantime.
    started = false;
    console.error("[embedded-worker] not started:", error);
  }
}
