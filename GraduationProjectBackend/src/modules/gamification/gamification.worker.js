import { env } from "../../config/env.js";
import { processPendingEvents } from "./gamification.processor.js";

let timer = null;
let running = false;

export function startGamificationWorker({
  intervalMs = env.gamificationWorkerIntervalMs,
  processEvents = processPendingEvents,
} = {}) {
  if (timer) return { started: false, reason: "already_started" };
  if (!env.gamificationEnabled) return { started: false, reason: "gamification_disabled" };
  if (!env.gamificationWorkerEnabled) return { started: false, reason: "worker_disabled" };

  const delay = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 30000;

  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processEvents();
    } catch (error) {
      console.error("[gamification-worker] processing failed:", error?.message ?? error);
    } finally {
      running = false;
    }
  }, delay);
  timer.unref?.();

  console.log(`[gamification-worker] scheduled every ${delay}ms`);
  return { started: true, intervalMs: delay };
}

export function stopGamificationWorker() {
  if (!timer) return { stopped: false };
  clearInterval(timer);
  timer = null;
  running = false;
  return { stopped: true };
}
