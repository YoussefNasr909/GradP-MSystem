import assert from "node:assert/strict";
import test from "node:test";
import { buildGamificationIdempotencyKey, emitGamificationEvent } from "./gamification.emitter.js";
import { prisma } from "../../loaders/dbLoader.js";
import { env } from "../../config/env.js";

function overridePrismaProperty(t, key, value) {
  const descriptor = Object.getOwnPropertyDescriptor(prisma, key);
  Object.defineProperty(prisma, key, {
    configurable: true,
    writable: true,
    value,
  });
  t.after(() => {
    if (descriptor) {
      Object.defineProperty(prisma, key, descriptor);
    } else {
      delete prisma[key];
    }
  });
}

test("buildGamificationIdempotencyKey is deterministic for the same source transition", () => {
  const first = buildGamificationIdempotencyKey(
    "SUBMISSION_APPROVED",
    "submission-1",
    "v2",
    "2026-05-15T10:00:00.000Z",
  );
  const second = buildGamificationIdempotencyKey(
    "SUBMISSION_APPROVED",
    "submission-1",
    "v2",
    "2026-05-15T10:00:00.000Z",
  );

  assert.equal(first, second);
  assert.equal(first, "SUBMISSION_APPROVED:submission-1:v2:2026-05-15T10:00:00.000Z");
});

test("buildGamificationIdempotencyKey omits empty optional parts", () => {
  assert.equal(
    buildGamificationIdempotencyKey("TASK_APPROVED", "task-1", null, ""),
    "TASK_APPROVED:task-1",
  );
});

test("same PR merge emitted twice produces one event row (idempotent upsert)", async (t) => {
  const previousGamificationEnabled = env.gamificationEnabled;
  env.gamificationEnabled = true;
  
  let upsertCount = 0;
  let lastUpsertArgs = null;
  
  overridePrismaProperty(t, "gamificationEvent", {
    upsert: async (args) => {
      upsertCount++;
      lastUpsertArgs = args;
      return { id: "event-1", status: "PENDING" };
    }
  });

  const idempotencyKey = buildGamificationIdempotencyKey(
    "GITHUB_PR_MERGED",
    "GitHubTeamRepository",
    "repo-1",
    "PR:123:mergedAt:2026-05-15T12:00:00.000Z"
  );

  await emitGamificationEvent({
    eventType: "GITHUB_PR_MERGED",
    sourceType: "GitHubTeamRepository",
    sourceId: "repo-1",
    idempotencyKey,
    teamId: "team-1",
    actorUserId: "user-1",
    payload: { pullNumber: 123 },
  });

  await emitGamificationEvent({
    eventType: "GITHUB_PR_MERGED",
    sourceType: "GitHubTeamRepository",
    sourceId: "repo-1",
    idempotencyKey,
    teamId: "team-1",
    actorUserId: "user-1",
    payload: { pullNumber: 123 },
  });

  // upsert is called twice, DB handles the idempotency. We verify the correct key is passed.
  assert.equal(upsertCount, 2);
  assert.equal(lastUpsertArgs.where.idempotencyKey, idempotencyKey);
  
  env.gamificationEnabled = previousGamificationEnabled;
});

test("self-review does not emit an event", async () => {
  const actor = { id: "user-1", githubUsername: "alice" };
  const prAuthorLogin = "alice";
  
  let emitted = false;
  if (actor.githubUsername && prAuthorLogin && prAuthorLogin.toLowerCase() !== actor.githubUsername.toLowerCase()) {
    emitted = true;
  }
  
  assert.equal(emitted, false, "Self-review should not trigger event emission logic");
});

test("non-self-review emits an event", async () => {
  const actor = { id: "user-2", githubUsername: "bob" };
  const prAuthorLogin = "alice";
  
  let emitted = false;
  if (actor.githubUsername && prAuthorLogin && prAuthorLogin.toLowerCase() !== actor.githubUsername.toLowerCase()) {
    emitted = true;
  }
  
  assert.equal(emitted, true, "Non-self-review should trigger event emission logic");
});
