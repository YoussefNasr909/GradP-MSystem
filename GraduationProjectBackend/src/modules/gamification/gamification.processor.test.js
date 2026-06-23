import assert from "node:assert/strict";
import test from "node:test";
import { env } from "../../config/env.js";
import { prisma } from "../../loaders/dbLoader.js";
import {
  buildXpTransactionNotification,
  getFlatXpForEvent,
  processFlatAwardForEvent,
  processPendingEvents,
} from "./gamification.processor.js";

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

function mockTransaction(t, tx, onOptions = () => {}) {
  overridePrismaProperty(t, "$transaction", async (callback, options) => {
    onOptions(options);
    return callback(tx);
  });
}

function createProcessorTx({ teamMembers = [] } = {}) {
  const calls = [];
  const quests = [
    {
      id: "quest-xp",
      title: "XP push",
      type: "WEEKLY",
      metric: "XP_EARNED",
      targetValue: 30,
      coinReward: 10,
      startsAt: null,
      endsAt: null,
    },
    {
      id: "quest-task",
      title: "Task closer",
      type: "DAILY",
      metric: "TASKS_DONE",
      targetValue: 1,
      coinReward: 5,
      startsAt: null,
      endsAt: null,
    },
    {
      id: "quest-submission",
      title: "Submission ready",
      type: "WEEKLY",
      metric: "SUBMISSIONS_APPROVED",
      targetValue: 1,
      coinReward: 5,
      startsAt: null,
      endsAt: null,
    },
  ];

  const tx = {
    xpTransaction: {
      findUnique: async () => null,
      create: async (args) => {
        calls.push({ model: "xpTransaction", method: "create", args });
        return { id: "tx-new", ...args.data };
      },
    },
    userXpBalance: {
      upsert: async (args) => {
        calls.push({ model: "userXpBalance", method: "upsert", args });
        return args;
      },
      findUnique: async () => ({ lifetimeXp: 30 }),
      update: async (args) => {
        calls.push({ model: "userXpBalance", method: "update", args });
        return args;
      },
    },
    teamXpBalance: {
      upsert: async (args) => {
        calls.push({ model: "teamXpBalance", method: "upsert", args });
        return args;
      },
    },
    coinTransaction: {
      create: async (args) => {
        calls.push({ model: "coinTransaction", method: "create", args });
        return { id: "coin-new", ...args.data };
      },
    },
    userCoinBalance: {
      upsert: async (args) => {
        calls.push({ model: "userCoinBalance", method: "upsert", args });
        return args;
      },
    },
    quest: {
      findMany: async (args) => {
        calls.push({ model: "quest", method: "findMany", args });
        return quests.filter((quest) => quest.metric === args.where.metric);
      },
    },
    userQuestProgress: {
      upsert: async (args) => {
        calls.push({ model: "userQuestProgress", method: "upsert", args });
        return {
          id: `${args.create.questId}:${args.create.userId}`,
          questId: args.create.questId,
          userId: args.create.userId,
          windowKey: args.create.windowKey,
          currentValue: args.create.currentValue ?? args.update.currentValue.increment,
          completedAt: null,
        };
      },
      update: async (args) => {
        calls.push({ model: "userQuestProgress", method: "update", args });
        return args;
      },
    },
    gamificationAuditLog: {
      create: async (args) => {
        calls.push({ model: "gamificationAuditLog", method: "create", args });
        return args;
      },
    },
    notification: {
      create: async (args) => {
        calls.push({ model: "notification", method: "create", args });
        return { id: `notification-${calls.length}`, ...args.data };
      },
    },
    user: {
      findUnique: async () => ({ email: null, settings: { emailNotifications: false } }),
    },
    team: {
      findUnique: async (args) => {
        calls.push({ model: "team", method: "findUnique", args });
        if (args.select?.members) {
          return {
            leaderId: "leader-1",
            members: teamMembers.map((userId) => ({ userId })),
          };
        }
        return { leaderId: "leader-1", name: "Compiler Crew" };
      },
    },
    badgeDefinition: {
      findMany: async () => [],
    },
  };

  return { tx, calls };
}

test("getFlatXpForEvent returns deterministic flat awards", () => {
  assert.equal(getFlatXpForEvent({ eventType: "TASK_APPROVED", payload: { storyPoints: 3 } }), 30);
  assert.equal(getFlatXpForEvent({ eventType: "TASK_APPROVED", payload: { storyPoints: 0 } }), 50);
  assert.equal(getFlatXpForEvent({ eventType: "SUBMISSION_APPROVED" }), 100);
  assert.equal(getFlatXpForEvent({ eventType: "WEEKLY_REPORT_APPROVED" }), 50);
  assert.equal(getFlatXpForEvent({ eventType: "GITHUB_PR_MERGED" }), 20);
  assert.equal(getFlatXpForEvent({ eventType: "GITHUB_PR_REVIEWED" }), 10);
  assert.equal(getFlatXpForEvent({ eventType: "SPRINT_COMPLETED" }), 100);
  assert.equal(getFlatXpForEvent({ eventType: "TEAM_STAGE_ADVANCED" }), 150);
  assert.equal(getFlatXpForEvent({ eventType: "GITHUB_RELEASE_CREATED" }), 0);
});

test("processPendingEvents does not award XP when worker flag is disabled", async () => {
  const previousEnabled = env.gamificationEnabled;
  const previousWorkerEnabled = env.gamificationWorkerEnabled;

  env.gamificationEnabled = true;
  env.gamificationWorkerEnabled = false;

  try {
    const result = await processPendingEvents();

    assert.equal(result.processed, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.skipped, 0);
    assert.equal(result.disabled, true);
    assert.match(result.reason, /GAMIFICATION_WORKER_ENABLED=true/);
  } finally {
    env.gamificationEnabled = previousEnabled;
    env.gamificationWorkerEnabled = previousWorkerEnabled;
  }
});

test("processPendingEvents can reset failed events for an admin retry", async (t) => {
  const previousEnabled = env.gamificationEnabled;
  const previousWorkerEnabled = env.gamificationWorkerEnabled;
  env.gamificationEnabled = true;
  env.gamificationWorkerEnabled = true;

  const calls = [];
  overridePrismaProperty(t, "gamificationEvent", {
    updateMany: async (args) => {
      calls.push({ model: "gamificationEvent", method: "updateMany", args });
      return { count: 1 };
    },
    findMany: async (args) => {
      calls.push({ model: "gamificationEvent", method: "findMany", args });
      return [];
    },
  });

  try {
    const result = await processPendingEvents({
      retryFailed: true,
      eventIds: ["event-failed-1"],
    });

    assert.equal(result.retried, 1);
    const retryUpdate = calls.find((call) => call.model === "gamificationEvent" && call.method === "updateMany");
    assert.deepEqual(retryUpdate.args.where, {
      status: "FAILED",
      id: { in: ["event-failed-1"] },
    });
    assert.deepEqual(retryUpdate.args.data, {
      status: "PENDING",
      attempts: 0,
      lastError: null,
      processedAt: null,
    });
  } finally {
    env.gamificationEnabled = previousEnabled;
    env.gamificationWorkerEnabled = previousWorkerEnabled;
  }
});

test("processPendingEvents filters manual processing by explicit event IDs", async (t) => {
  const previousEnabled = env.gamificationEnabled;
  const previousWorkerEnabled = env.gamificationWorkerEnabled;
  env.gamificationEnabled = true;
  env.gamificationWorkerEnabled = true;

  const calls = [];
  overridePrismaProperty(t, "gamificationEvent", {
    findMany: async (args) => {
      calls.push({ model: "gamificationEvent", method: "findMany", args });
      return [];
    },
  });

  try {
    const result = await processPendingEvents({ eventIds: ["event-1", "event-2"] });

    assert.deepEqual(result, { processed: 0, failed: 0, skipped: 0, retried: 0 });
    const findMany = calls.find((call) => call.model === "gamificationEvent" && call.method === "findMany");
    assert.deepEqual(findMany.args.where.id, { in: ["event-1", "event-2"] });
  } finally {
    env.gamificationEnabled = previousEnabled;
    env.gamificationWorkerEnabled = previousWorkerEnabled;
  }
});

test("processFlatAwardForEvent awards user XP, coins, and quest progress immediately", async (t) => {
  const { tx, calls } = createProcessorTx();
  let receivedOptions = "not-called";
  mockTransaction(t, tx, (options) => {
    receivedOptions = options;
  });

  const result = await processFlatAwardForEvent({
    id: "event-task-1",
    eventType: "TASK_APPROVED",
    sourceType: "Task",
    sourceId: "task-1",
    teamId: "team-1",
    actorUserId: "leader-1",
    payload: { assigneeUserId: "student-1", storyPoints: 3 },
  });

  assert.equal(result.awarded, true);
  assert.equal(receivedOptions, undefined);

  const transactionCreate = calls.find((call) => call.model === "xpTransaction" && call.method === "create");
  assert.equal(transactionCreate.args.data.amount, 30);
  assert.equal(transactionCreate.args.data.status, "AWARDED");
  assert.equal(transactionCreate.args.data.userId, "student-1");
  assert.equal(transactionCreate.args.data.ruleCode, null);

  const coinCreate = calls.find((call) => call.model === "coinTransaction" && call.method === "create");
  assert.equal(coinCreate.args.data.amount, 3);
  assert.equal(coinCreate.args.data.sourceType, "XP_AWARD");

  const questMetrics = calls
    .filter((call) => call.model === "quest" && call.method === "findMany")
    .map((call) => call.args.where.metric);
  assert.deepEqual(questMetrics, ["XP_EARNED", "TASKS_DONE"]);

  assert.equal(calls.some((call) => call.model === "suspiciousActivityCase"), false);
});

test("processFlatAwardForEvent awards team XP and increments quests for all team members", async (t) => {
  const { tx, calls } = createProcessorTx({ teamMembers: ["student-1", "student-2"] });
  mockTransaction(t, tx);

  const result = await processFlatAwardForEvent({
    id: "event-submission-1",
    eventType: "SUBMISSION_APPROVED",
    sourceType: "Submission",
    sourceId: "submission-1",
    teamId: "team-1",
    actorUserId: "doctor-1",
    payload: { submittedByUserId: "student-1" },
  });

  assert.equal(result.awarded, true);

  const transactionCreate = calls.find((call) => call.model === "xpTransaction" && call.method === "create");
  assert.equal(transactionCreate.args.data.amount, 100);
  assert.equal(transactionCreate.args.data.recipientType, "TEAM");
  assert.equal(transactionCreate.args.data.teamId, "team-1");

  const balanceUpsert = calls.find((call) => call.model === "teamXpBalance" && call.method === "upsert");
  assert.equal(balanceUpsert.args.create.lifetimeTeamXp, 100);

  assert.equal(calls.some((call) => call.model === "coinTransaction"), false);

  const progressUsers = calls
    .filter((call) => call.model === "userQuestProgress" && call.method === "upsert")
    .map((call) => call.args.create.userId);
  assert.deepEqual([...new Set(progressUsers)].sort(), ["leader-1", "student-1", "student-2"]);

  const questMetrics = calls
    .filter((call) => call.model === "quest" && call.method === "findMany")
    .map((call) => call.args.where.metric);
  assert.deepEqual([...new Set(questMetrics)], ["XP_EARNED", "SUBMISSIONS_APPROVED"]);
});

test("buildXpTransactionNotification targets team leaders with team-safe copy", () => {
  const notification = buildXpTransactionNotification({
    transaction: {
      recipientType: "TEAM",
      amount: 120,
    },
    kind: "AWARDED",
    teamName: "Compiler Crew",
    userId: "leader-1",
  });

  assert.deepEqual(notification, {
    userId: "leader-1",
    type: "XP_AWARDED",
    title: "Team XP Awarded",
    message: "120 team XP was awarded to Compiler Crew.",
    actionUrl: "/dashboard/gamification",
  });
});
