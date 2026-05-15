import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBadgeUnlockedNotification,
  evaluateBadgesForUser,
} from "./gamification.badges.js";

function createBadgeTx({
  definitions,
  existingUserBadges = [],
  existingTransactions = [],
  awardedCount = 0,
  lifetimeXp = 0,
}) {
  const calls = [];
  const userBadges = [...existingUserBadges];
  const transactions = [...existingTransactions];

  const tx = {
    badgeDefinition: {
      findMany: async (args) => {
        calls.push({ model: "badgeDefinition", method: "findMany", args });
        return definitions;
      },
    },
    xpTransaction: {
      count: async (args) => {
        calls.push({ model: "xpTransaction", method: "count", args });
        return awardedCount;
      },
      findUnique: async (args) => {
        calls.push({ model: "xpTransaction", method: "findUnique", args });
        return (
          transactions.find(
            (transaction) => transaction.idempotencyKey === args.where.idempotencyKey,
          ) ?? null
        );
      },
      create: async (args) => {
        calls.push({ model: "xpTransaction", method: "create", args });
        const transaction = { id: `tx-${transactions.length + 1}`, ...args.data };
        transactions.push(transaction);
        return transaction;
      },
    },
    userBadge: {
      findUnique: async (args) => {
        calls.push({ model: "userBadge", method: "findUnique", args });
        const key = args.where.userId_badgeDefinitionId;
        return (
          userBadges.find(
            (badge) =>
              badge.userId === key.userId && badge.badgeDefinitionId === key.badgeDefinitionId,
          ) ?? null
        );
      },
      create: async (args) => {
        calls.push({ model: "userBadge", method: "create", args });
        const badge = { id: `badge-${userBadges.length + 1}`, ...args.data };
        userBadges.push(badge);
        return badge;
      },
    },
    gamificationEvent: {
      upsert: async (args) => {
        calls.push({ model: "gamificationEvent", method: "upsert", args });
        return { id: "badge-event-1", ...args.create };
      },
    },
    userXpBalance: {
      findUnique: async (args) => {
        calls.push({ model: "userXpBalance", method: "findUnique", args });
        return { lifetimeXp };
      },
      upsert: async (args) => {
        calls.push({ model: "userXpBalance", method: "upsert", args });
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
  };

  return { tx, calls, userBadges, transactions };
}

const taskApprovedEvent = {
  id: "event-1",
  eventType: "TASK_APPROVED",
  sourceType: "Task",
  sourceId: "task-1",
  teamId: "team-1",
  payload: { assigneeUserId: "student-1" },
};

test("evaluateBadgesForUser unlocks a lifetime XP badge", async () => {
  const definition = {
    id: "badge-def-1",
    code: "LIFETIME_100",
    name: "Century Club",
    targetType: "USER",
    criteria: { event: "TASK_APPROVED", lifetimeXp: 100 },
    xpReward: 0,
  };
  const { tx, calls } = createBadgeTx({ definitions: [definition], lifetimeXp: 125 });

  const unlocked = await evaluateBadgesForUser(tx, {
    userId: "student-1",
    event: taskApprovedEvent,
  });

  assert.equal(unlocked.length, 1);
  assert.equal(calls.some((call) => call.model === "userBadge" && call.method === "create"), true);
});

test("evaluateBadgesForUser does not duplicate an existing badge", async () => {
  const definition = {
    id: "badge-def-1",
    code: "FIRST_TASK_APPROVED",
    name: "First Steps",
    targetType: "USER",
    criteria: { event: "TASK_APPROVED", count: 1 },
    xpReward: 15,
  };
  const { tx, calls } = createBadgeTx({
    definitions: [definition],
    existingUserBadges: [{ id: "badge-existing", userId: "student-1", badgeDefinitionId: "badge-def-1" }],
    awardedCount: 1,
  });

  const unlocked = await evaluateBadgesForUser(tx, {
    userId: "student-1",
    event: taskApprovedEvent,
  });

  assert.equal(unlocked.length, 0);
  assert.equal(calls.some((call) => call.model === "userBadge" && call.method === "create"), false);
  assert.equal(calls.some((call) => call.model === "xpTransaction" && call.method === "create"), false);
});

test("evaluateBadgesForUser creates one XP reward transaction and balance update", async () => {
  const definition = {
    id: "badge-def-1",
    code: "FIRST_TASK_APPROVED",
    name: "First Steps",
    targetType: "USER",
    criteria: { event: "TASK_APPROVED", count: 1 },
    xpReward: 15,
  };
  const { tx, calls } = createBadgeTx({
    definitions: [definition],
    awardedCount: 1,
    lifetimeXp: 100,
  });

  await evaluateBadgesForUser(tx, {
    userId: "student-1",
    event: taskApprovedEvent,
  });

  const rewardTransaction = calls.find(
    (call) => call.model === "xpTransaction" && call.method === "create",
  );
  assert.equal(rewardTransaction.args.data.idempotencyKey, "BADGE_REWARD:badge-def-1:USER:student-1");
  assert.equal(rewardTransaction.args.data.amount, 15);
  assert.equal(rewardTransaction.args.data.sourceType, "BadgeDefinition");

  const balanceUpdate = calls.find((call) => call.model === "userXpBalance" && call.method === "upsert");
  assert.deepEqual(balanceUpdate.args.update.lifetimeXp, { increment: 15 });

  const badgeCreate = calls.find((call) => call.model === "userBadge" && call.method === "create");
  assert.equal(badgeCreate.args.data.createdTransactionId, "tx-1");
});

test("evaluateBadgesForUser is idempotent across repeated evaluations", async () => {
  const definition = {
    id: "badge-def-1",
    code: "FIRST_TASK_APPROVED",
    name: "First Steps",
    targetType: "USER",
    criteria: { event: "TASK_APPROVED", count: 1 },
    xpReward: 15,
  };
  const { tx, calls, userBadges } = createBadgeTx({
    definitions: [definition],
    awardedCount: 1,
    lifetimeXp: 100,
  });

  await evaluateBadgesForUser(tx, { userId: "student-1", event: taskApprovedEvent });
  await evaluateBadgesForUser(tx, { userId: "student-1", event: taskApprovedEvent });

  assert.equal(userBadges.length, 1);
  assert.equal(
    calls.filter((call) => call.model === "xpTransaction" && call.method === "create").length,
    1,
  );
});

test("buildBadgeUnlockedNotification is student-safe", () => {
  const notification = buildBadgeUnlockedNotification({
    userId: "student-1",
    badgeDefinition: {
      name: "First Steps",
      targetType: "USER",
      xpReward: 15,
      criteria: { fileHashMatched: true },
    },
  });

  assert.equal(notification.type, "BADGE_UNLOCKED");
  assert.equal(notification.message, "You unlocked First Steps. You also earned 15 bonus XP.");
  assert.doesNotMatch(notification.message, /hash|fingerprint|duplicate|signal/i);
});
