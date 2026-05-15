import assert from "node:assert/strict";
import test from "node:test";
import { env } from "../../config/env.js";
import { startGamificationWorker, stopGamificationWorker } from "./gamification.worker.js";

function withWorkerFlags(t, { enabled = true, workerEnabled = false } = {}) {
  const prevEnabled = env.gamificationEnabled;
  const prevWorkerEnabled = env.gamificationWorkerEnabled;
  env.gamificationEnabled = enabled;
  env.gamificationWorkerEnabled = workerEnabled;
  t.after(() => {
    stopGamificationWorker();
    env.gamificationEnabled = prevEnabled;
    env.gamificationWorkerEnabled = prevWorkerEnabled;
  });
}

test("startGamificationWorker stays disabled by default flag", (t) => {
  withWorkerFlags(t, { enabled: true, workerEnabled: false });

  const result = startGamificationWorker({ intervalMs: 5, processEvents: async () => {} });

  assert.deepEqual(result, { started: false, reason: "worker_disabled" });
});

test("startGamificationWorker starts once when enabled", (t) => {
  withWorkerFlags(t, { enabled: true, workerEnabled: true });

  const first = startGamificationWorker({ intervalMs: 1000, processEvents: async () => {} });
  const second = startGamificationWorker({ intervalMs: 1000, processEvents: async () => {} });

  assert.deepEqual(first, { started: true, intervalMs: 1000 });
  assert.deepEqual(second, { started: false, reason: "already_started" });
});

test("stopGamificationWorker clears a running worker", (t) => {
  withWorkerFlags(t, { enabled: true, workerEnabled: true });
  startGamificationWorker({ intervalMs: 1000, processEvents: async () => {} });

  assert.deepEqual(stopGamificationWorker(), { stopped: true });
  assert.deepEqual(stopGamificationWorker(), { stopped: false });
});
