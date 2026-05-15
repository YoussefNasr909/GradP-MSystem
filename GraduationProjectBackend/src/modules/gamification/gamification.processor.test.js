import assert from "node:assert/strict";
import test from "node:test";
import { env } from "../../config/env.js";
import { prisma } from "../../loaders/dbLoader.js";
import {
  buildXpTransactionNotification,
  processPendingEvents,
  processRuleForEvent,
  processTaskReopenedEvent,
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

function createProcessorTx() {
  const calls = [];
  const tx = {
    xpTransaction: {
      findUnique: async () => null,
      count: async () => 0,
      create: async (args) => {
        calls.push({ model: "xpTransaction", method: "create", args });
        return { id: "tx-new", ...args.data };
      },
      update: async (args) => {
        calls.push({ model: "xpTransaction", method: "update", args });
        return args;
      },
    },
    userXpBalance: {
      upsert: async (args) => {
        calls.push({ model: "userXpBalance", method: "upsert", args });
        return args;
      },
      findUnique: async () => ({ lifetimeXp: 100, semesterXp: 100, monthlyXp: 100, weeklyXp: 100 }),
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
      findUnique: async () => ({
        lifetimeTeamXp: 100,
        semesterTeamXp: 100,
        monthlyTeamXp: 100,
        weeklyTeamXp: 100,
      }),
      update: async (args) => {
        calls.push({ model: "teamXpBalance", method: "update", args });
        return args;
      },
    },
    suspiciousActivityCase: {
      create: async (args) => {
        calls.push({ model: "suspiciousActivityCase", method: "create", args });
        return { id: "case-new", ...args.data };
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
      findUnique: async () => ({
        leaderId: "leader-1",
        name: "Compiler Crew",
      }),
    },
    badgeDefinition: {
      findMany: async () => [],
    },
    userBadge: {
      findUnique: async () => null,
      create: async (args) => {
        calls.push({ model: "userBadge", method: "create", args });
        return { id: "user-badge-new", ...args.data };
      },
    },
    teamBadge: {
      findUnique: async () => null,
      create: async (args) => {
        calls.push({ model: "teamBadge", method: "create", args });
        return { id: "team-badge-new", ...args.data };
      },
    },
    gamificationEvent: {
      upsert: async (args) => {
        calls.push({ model: "gamificationEvent", method: "upsert", args });
        return { id: "badge-event-new", ...args.create };
      },
    },
  };

  return { tx, calls };
}

function mockTransaction(t, tx) {
  overridePrismaProperty(t, "$transaction", async (callback) => callback(tx));
}

const userRule = {
  code: "SUBMISSION_APPROVED_XP",
  name: "Submission approved",
  eventType: "SUBMISSION_APPROVED",
  targetType: "USER",
  baseXp: 100,
  version: 1,
  caps: null,
  multipliers: null,
};

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

test("processRuleForEvent freezes duplicate approved submissions and opens a suspicious case", async (t) => {
  const { tx, calls } = createProcessorTx();
  mockTransaction(t, tx);
  overridePrismaProperty(t, "submission", {
    findUnique: async () => ({
      id: "submission-2",
      teamId: "team-2",
      deliverableType: "SRS",
      version: 1,
      fileHash: "same-file",
      normalizedTextHash: "same-text",
      contentFingerprint: "same-content",
    }),
    findFirst: async () => ({
      id: "submission-1",
      teamId: "team-1",
      deliverableType: "SRS",
      version: 1,
      fileHash: "same-file",
      normalizedTextHash: "same-text",
      contentFingerprint: "same-content",
    }),
  });

  await processRuleForEvent(
    {
      id: "event-1",
      eventType: "SUBMISSION_APPROVED",
      sourceType: "Submission",
      sourceId: "submission-2",
      actorUserId: "doctor-1",
      teamId: "team-2",
      payload: { submittedByUserId: "student-2" },
    },
    userRule,
  );

  const transactionCreate = calls.find((call) => call.model === "xpTransaction");
  assert.equal(transactionCreate.args.data.status, "FROZEN");
  assert.equal(transactionCreate.args.data.userId, "student-2");
  assert.equal(transactionCreate.args.data.amount, 100);

  const frozenBalance = calls.find((call) => call.model === "userXpBalance");
  assert.deepEqual(frozenBalance.args.update, { frozenXp: { increment: 100 } });

  const suspiciousCase = calls.find((call) => call.model === "suspiciousActivityCase");
  assert.equal(suspiciousCase.args.data.transactionId, "tx-new");
  assert.equal(suspiciousCase.args.data.userId, "student-2");
  assert.equal(suspiciousCase.args.data.signals.type, "DUPLICATE_SUBMISSION_HASH");
  assert.equal(suspiciousCase.args.data.signals.matchedSubmissionId, "submission-1");
  assert.equal(suspiciousCase.args.data.signals.normalizedTextHashMatched, true);

  const audit = calls.find((call) => call.model === "gamificationAuditLog");
  assert.equal(audit.args.data.action, "TRANSACTION_FROZEN");

  const notification = calls.find((call) => call.model === "notification");
  assert.equal(notification.args.data.userId, "student-2");
  assert.equal(notification.args.data.type, "XP_FROZEN");
  assert.doesNotMatch(notification.args.data.message, /duplicate|hash|fingerprint|signal/i);
});

test("processRuleForEvent notifies recipients when XP is awarded", async (t) => {
  const { tx, calls } = createProcessorTx();
  mockTransaction(t, tx);

  await processRuleForEvent(
    {
      id: "event-award-1",
      eventType: "TASK_APPROVED",
      sourceType: "Task",
      sourceId: "task-1",
      actorUserId: "doctor-1",
      teamId: "team-1",
      payload: { assigneeUserId: "student-1" },
    },
    {
      ...userRule,
      code: "TASK_APPROVED_XP",
      name: "Task approved",
      eventType: "TASK_APPROVED",
    },
  );

  const transactionCreate = calls.find((call) => call.model === "xpTransaction");
  assert.equal(transactionCreate.args.data.status, "AWARDED");

  const notification = calls.find((call) => call.model === "notification");
  assert.equal(notification.args.data.userId, "student-1");
  assert.equal(notification.args.data.type, "XP_AWARDED");
  assert.equal(notification.args.data.message, "100 XP was added to your gamification balance.");
});

test("processRuleForEvent skips duplicate transaction idempotency keys", async (t) => {
  const { tx, calls } = createProcessorTx();
  tx.xpTransaction.findUnique = async () => ({ id: "existing-tx" });
  mockTransaction(t, tx);

  await processRuleForEvent(
    {
      id: "event-2",
      eventType: "TASK_APPROVED",
      sourceType: "Task",
      sourceId: "task-1",
      actorUserId: "doctor-1",
      teamId: "team-1",
      payload: { assigneeUserId: "student-1" },
    },
    {
      ...userRule,
      code: "TASK_APPROVED_XP",
      name: "Task approved",
      eventType: "TASK_APPROVED",
    },
  );

  assert.equal(calls.length, 0);
});

test("processTaskReopenedEvent notifies recipients when XP is reversed", async (t) => {
  const { tx, calls } = createProcessorTx();
  mockTransaction(t, tx);
  overridePrismaProperty(t, "gamificationEvent", {
    findFirst: async () => ({
      id: "approved-event-1",
      eventType: "TASK_APPROVED",
      sourceType: "Task",
      sourceId: "task-1",
      status: "PROCESSED",
    }),
    update: async (args) => {
      calls.push({ model: "gamificationEvent", method: "update", args });
      return args;
    },
  });
  overridePrismaProperty(t, "xpTransaction", {
    findMany: async () => [
      {
        id: "original-tx-1",
        recipientType: "USER",
        userId: "student-1",
        teamId: null,
        amount: 100,
        direction: "CREDIT",
        status: "AWARDED",
        reason: "Task approved",
        ruleCode: "TASK_APPROVED_XP",
        ruleVersion: 1,
        baseXp: 100,
      },
    ],
  });
  overridePrismaProperty(t, "gamificationAuditLog", {
    create: async (args) => {
      calls.push({ model: "gamificationAuditLog", method: "create", args });
      return args;
    },
  });

  await processTaskReopenedEvent({
    id: "reopen-event-2",
    eventType: "TASK_REOPENED",
    sourceType: "Task",
    sourceId: "task-1",
    actorUserId: "doctor-1",
    payload: { assigneeUserId: "student-1" },
  });

  const reversalCreate = calls.find(
    (call) =>
      call.model === "xpTransaction" &&
      call.method === "create" &&
      call.args.data.direction === "DEBIT",
  );
  assert.equal(reversalCreate.args.data.reversalOfTransactionId, "original-tx-1");

  const notification = calls.find((call) => call.model === "notification");
  assert.equal(notification.args.data.userId, "student-1");
  assert.equal(notification.args.data.type, "XP_REVERSED");
  assert.equal(
    notification.args.data.message,
    "100 XP was reversed because the source activity changed.",
  );
});

test("processTaskReopenedEvent does not create a second reversal for the same reopen event", async (t) => {
  const { tx, calls } = createProcessorTx();
  tx.xpTransaction.findUnique = async () => ({ id: "existing-reversal" });
  mockTransaction(t, tx);
  overridePrismaProperty(t, "gamificationEvent", {
    findFirst: async () => ({
      id: "approved-event-1",
      eventType: "TASK_APPROVED",
      sourceType: "Task",
      sourceId: "task-1",
      status: "PROCESSED",
    }),
    update: async (args) => {
      calls.push({ model: "gamificationEvent", method: "update", args });
      return args;
    },
  });
  overridePrismaProperty(t, "xpTransaction", {
    findMany: async () => [
      {
        id: "original-tx-1",
        idempotencyKey: "XP_AWARD:approved-event-1:TASK_APPROVED_XP:v1:USER:student-1",
        recipientType: "USER",
        userId: "student-1",
        teamId: null,
        amount: 100,
        direction: "CREDIT",
        status: "AWARDED",
        reason: "Task approved",
        ruleCode: "TASK_APPROVED_XP",
        ruleVersion: 1,
        baseXp: 100,
      },
    ],
  });
  overridePrismaProperty(t, "gamificationAuditLog", {
    create: async (args) => {
      calls.push({ model: "gamificationAuditLog", method: "create", args });
      return args;
    },
  });

  await processTaskReopenedEvent({
    id: "reopen-event-1",
    eventType: "TASK_REOPENED",
    sourceType: "Task",
    sourceId: "task-1",
    actorUserId: "doctor-1",
    payload: { assigneeUserId: "student-1" },
  });

  assert.equal(calls.some((call) => call.model === "xpTransaction"), false);
  assert.equal(calls.some((call) => call.model === "userXpBalance"), false);
  assert.equal(
    calls.some(
      (call) =>
        call.model === "gamificationAuditLog" &&
        call.args.data.action === "TRANSACTION_REVERSED",
    ),
    false,
  );
  assert.equal(
    calls.some(
      (call) =>
        call.model === "gamificationEvent" &&
        call.args.data.status === "PROCESSED",
    ),
    true,
  );
});

test("buildXpTransactionNotification targets team leaders with team-safe copy", () => {
  const notification = buildXpTransactionNotification({
    transaction: {
      recipientType: "TEAM",
      teamId: "team-1",
      amount: 75,
    },
    kind: "AWARDED",
    teamName: "Compiler Crew",
    userId: "leader-1",
  });

  assert.deepEqual(notification, {
    userId: "leader-1",
    type: "XP_AWARDED",
    title: "Team XP Awarded",
    message: "75 team XP was awarded to Compiler Crew.",
    actionUrl: "/dashboard/gamification",
  });
});
