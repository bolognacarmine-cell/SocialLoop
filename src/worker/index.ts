// Standalone worker entrypoint: `pnpm worker` / Dockerfile.worker.
//
// The actual consumers live in ./start so the exact same code can also run
// inside the Next.js server process via instrumentation.ts. Here we add the
// only behaviour that belongs to a dedicated process: exit on signal.
import { startWorker, stopWorker } from "./start";

const running = startWorker();

if (!running) {
  // Defensive: a fresh process should never find a prior instance. If it does,
  // the global guard is leaking across something unexpected.
  console.error("[socialloop] worker failed to start");
  process.exit(1);
}

async function shutdown(signal: string) {
  console.info(`[socialloop] worker shutting down (${signal})`);
  await stopWorker();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
