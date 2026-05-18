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

test("processPendingEvents retries transient processing failures before marking failed", async (t) => {
  const previousEnabled = env.gamificationEnabled;
  const previousWorkerEnabled = env.gamificationWorkerEnabled;
  env.gamificationEnabled = true;
  env.gamificationWorkerEnabled = true;

  const calls = [];
  overridePrismaProperty(t, "gamificationEvent", {
    findMany: async () => [
      {
        id: "event-retry-1",
        eventType: "TASK_APPROVED",
        sourceType: "Task",
        sourceId: "task-1",
        status: "PENDING",
        attempts: 0,
        actorUserId: "ta-1",
        payload: { assigneeUserId: "student-1", storyPoints: 3 },
      },
    ],
    updateMany: async (args) => {
      calls.push({ model: "gamificationEvent", method: "updateMany", args });
      return { count: 1 };
    },
    update: async (args) => {
      calls.push({ model: "gamificationEvent", method: "update", args });
      return args;
    },
  });
  overridePrismaProperty(t, "gamificationRule", {
    findMany: async () => [
      {
        code: "TASK_APPROVED_XP",
        name: "Task approved",
        eventType: "TASK_APPROVED",
        targetType: "USER",
        baseXp: 100,
        version: 1,
        conditions: {},
        caps: null,
        multipliers: null,
      },
    ],
  });
  overridePrismaProperty(t, "$transaction", async () => {
    throw new Error("temporary database outage");
  });

  try {
    const result = await processPendingEvents();

    assert.equal(result.failed, 1);
    const statusUpdate = calls.find((call) => call.model === "gamificationEvent" && call.method === "update");
    assert.equal(statusUpdate.args.data.status, "PENDING");
    assert.equal(statusUpdate.args.data.lastError, "temporary database outage");
  } finally {
    env.gamificationEnabled = previousEnabled;
    env.gamificationWorkerEnabled = previousWorkerEnabled;
  }
});

test("processPendingEvents marks an event failed after max attempts", async (t) => {
  const previousEnabled = env.gamificationEnabled;
  const previousWorkerEnabled = env.gamificationWorkerEnabled;
  env.gamificationEnabled = true;
  env.gamificationWorkerEnabled = true;

  const calls = [];
  overridePrismaProperty(t, "gamificationEvent", {
    findMany: async () => [
      {
        id: "event-retry-3",
        eventType: "TASK_APPROVED",
        sourceType: "Task",
        sourceId: "task-1",
        status: "PENDING",
        attempts: 2,
        actorUserId: "ta-1",
        payload: { assigneeUserId: "student-1", storyPoints: 3 },
      },
    ],
    updateMany: async () => ({ count: 1 }),
    update: async (args) => {
      calls.push({ model: "gamificationEvent", method: "update", args });
      return args;
    },
  });
  overridePrismaProperty(t, "gamificationRule", {
    findMany: async () => [
      {
        code: "TASK_APPROVED_XP",
        name: "Task approved",
        eventType: "TASK_APPROVED",
        targetType: "USER",
        baseXp: 100,
        version: 1,
        conditions: {},
        caps: null,
        multipliers: null,
      },
    ],
  });
  overridePrismaProperty(t, "$transaction", async () => {
    throw new Error("still down");
  });

  try {
    await processPendingEvents();

    const statusUpdate = calls.find((call) => call.model === "gamificationEvent" && call.method === "update");
    assert.equal(statusUpdate.args.data.status, "FAILED");
  } finally {
    env.gamificationEnabled = previousEnabled;
    env.gamificationWorkerEnabled = previousWorkerEnabled;
  }
});

test("processPendingEvents reclaims stale processing events", async (t) => {
  const previousEnabled = env.gamificationEnabled;
  const previousWorkerEnabled = env.gamificationWorkerEnabled;
  env.gamificationEnabled = true;
  env.gamificationWorkerEnabled = true;

  const { tx } = createProcessorTx();
  const calls = [];
  overridePrismaProperty(t, "gamificationEvent", {
    findMany: async (args) => {
      calls.push({ model: "gamificationEvent", method: "findMany", args });
      return [
        {
          id: "event-stale-processing-1",
          eventType: "TASK_APPROVED",
          sourceType: "Task",
          sourceId: "task-1",
          status: "PROCESSING",
          attempts: 1,
          actorUserId: "ta-1",
          teamId: "team-1",
          payload: { assigneeUserId: "student-1", storyPoints: 3 },
          createdAt: new Date("2026-05-16T09:00:00.000Z"),
          updatedAt: new Date("2026-05-16T09:01:00.000Z"),
        },
      ];
    },
    updateMany: async (args) => {
      calls.push({ model: "gamificationEvent", method: "updateMany", args });
      return { count: 1 };
    },
    update: async (args) => {
      calls.push({ model: "gamificationEvent", method: "update", args });
      return args;
    },
  });
  overridePrismaProperty(t, "gamificationRule", {
    findMany: async () => [
      {
        code: "TASK_APPROVED_XP",
        name: "Task approved",
        eventType: "TASK_APPROVED",
        targetType: "USER",
        baseXp: 100,
        version: 1,
        conditions: {},
        caps: null,
        multipliers: null,
      },
    ],
  });
  overridePrismaProperty(t, "gamificationAuditLog", {
    create: async (args) => {
      calls.push({ model: "gamificationAuditLog", method: "create", args });
      return args;
    },
  });
  mockTransaction(t, tx);

  try {
    const result = await processPendingEvents();

    assert.equal(result.processed, 1);
    const findMany = calls.find((call) => call.model === "gamificationEvent" && call.method === "findMany");
    assert.equal(findMany.args.where.OR.some((condition) => condition.status === "PROCESSING"), true);
    const claim = calls.find((call) => call.model === "gamificationEvent" && call.method === "updateMany");
    assert.equal(claim.args.where.OR.some((condition) => condition.status === "PROCESSING"), true);
    const processedUpdate = calls.find(
      (call) => call.model === "gamificationEvent" && call.method === "update" && call.args.data.status === "PROCESSED",
    );
    assert.ok(processedUpdate);
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

test("processRuleForEvent freezes unusually rapid task approvals", async (t) => {
  const { tx, calls } = createProcessorTx();
  mockTransaction(t, tx);

  await processRuleForEvent(
    {
      id: "event-rapid-task-1",
      eventType: "TASK_APPROVED",
      sourceType: "Task",
      sourceId: "task-rapid-1",
      actorUserId: "ta-1",
      teamId: "team-1",
      payload: {
        assigneeUserId: "student-1",
        taskType: "CODE",
        storyPoints: 3,
        createdAt: "2026-05-16T10:00:00.000Z",
        acceptedAt: "2026-05-16T10:01:00.000Z",
        submittedForReviewAt: "2026-05-16T10:03:00.000Z",
        reviewedAt: "2026-05-16T10:05:00.000Z",
      },
    },
    {
      ...userRule,
      code: "TASK_APPROVED_CODE",
      name: "Code task approved",
      eventType: "TASK_APPROVED",
      baseXp: 80,
    },
  );

  const transactionCreate = calls.find((call) => call.model === "xpTransaction");
  assert.equal(transactionCreate.args.data.status, "FROZEN");

  const suspiciousCase = calls.find((call) => call.model === "suspiciousActivityCase");
  assert.equal(suspiciousCase.args.data.reason, "Task was approved unusually quickly.");
  assert.equal(suspiciousCase.args.data.signals.type, "RAPID_TASK_APPROVAL");
  assert.match(suspiciousCase.args.data.studentVisibleReason, /pending staff review/i);
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

test("processRuleForEvent enforces daily XP caps across rule codes", async (t) => {
  const { tx, calls } = createProcessorTx();
  const aggregateCalls = [];
  tx.xpTransaction.aggregate = async (args) => {
    aggregateCalls.push(args);
    return { _sum: { amount: 290 } };
  };
  mockTransaction(t, tx);

  await processRuleForEvent(
    {
      id: "event-cap-1",
      eventType: "TASK_APPROVED",
      sourceType: "Task",
      sourceId: "task-1",
      actorUserId: "doctor-1",
      teamId: "team-1",
      payload: { assigneeUserId: "student-1", storyPoints: 3 },
    },
    {
      ...userRule,
      code: "TASK_APPROVED_CODE",
      name: "Code task approved",
      eventType: "TASK_APPROVED",
      baseXp: 25,
      caps: { maxXpPerUserPerDay: 300 },
    },
  );

  assert.equal(aggregateCalls.length, 1);
  assert.equal(aggregateCalls[0].where.userId, "student-1");
  assert.equal(aggregateCalls[0].where.ruleCode, undefined);
  assert.equal(calls.some((call) => call.model === "xpTransaction" && call.method === "create"), false);
});

test("processRuleForEvent awards sprint completion XP to the team", async (t) => {
  const { tx, calls } = createProcessorTx();
  mockTransaction(t, tx);

  await processRuleForEvent(
    {
      id: "event-sprint-1",
      eventType: "SPRINT_COMPLETED",
      sourceType: "Sprint",
      sourceId: "sprint-1",
      actorUserId: "leader-1",
      teamId: "team-1",
      payload: { grade: 95, completionPercent: 95 },
    },
    {
      code: "SPRINT_COMPLETED_TEAM",
      name: "Sprint completed",
      eventType: "SPRINT_COMPLETED",
      targetType: "TEAM",
      baseXp: 120,
      version: 1,
      conditions: {},
      caps: { maxPerSprint: 1 },
      multipliers: {
        quality: { "90-100": 1.25, "80-89": 1.0, "70-79": 0.7, "60-69": 0.4, below60: 0 },
      },
    },
  );

  const transactionCreate = calls.find((call) => call.model === "xpTransaction" && call.method === "create");
  assert.equal(transactionCreate.args.data.recipientType, "TEAM");
  assert.equal(transactionCreate.args.data.teamId, "team-1");
  assert.equal(transactionCreate.args.data.amount, 150);
});

test("processRuleForEvent awards approved weekly report XP once per report", async (t) => {
  const { tx, calls } = createProcessorTx();
  const countQueries = [];
  tx.xpTransaction.count = async (args) => {
    countQueries.push(args);
    return 0;
  };
  mockTransaction(t, tx);

  await processRuleForEvent(
    {
      id: "event-weekly-report-1",
      eventType: "WEEKLY_REPORT_APPROVED",
      sourceType: "WeeklyReport",
      sourceId: "weekly-report-1",
      actorUserId: "ta-1",
      teamId: "team-1",
      payload: { weeklyReportId: "weekly-report-1" },
    },
    {
      code: "WEEKLY_REPORT_APPROVED_TEAM",
      name: "Weekly report approved",
      eventType: "WEEKLY_REPORT_APPROVED",
      targetType: "TEAM",
      baseXp: 75,
      version: 1,
      conditions: {},
      caps: { maxPerWeeklyReport: 1 },
      multipliers: {},
    },
  );

  const transactionCreate = calls.find((call) => call.model === "xpTransaction" && call.method === "create");
  assert.equal(countQueries[0].where.sourceType, "WeeklyReport");
  assert.equal(countQueries[0].where.sourceId, "weekly-report-1");
  assert.equal(transactionCreate.args.data.recipientType, "TEAM");
  assert.equal(transactionCreate.args.data.teamId, "team-1");
  assert.equal(transactionCreate.args.data.amount, 75);
});

test("processRuleForEvent skips duplicate approved weekly report XP", async (t) => {
  const { tx, calls } = createProcessorTx();
  tx.xpTransaction.count = async () => 1;
  mockTransaction(t, tx);

  await processRuleForEvent(
    {
      id: "event-weekly-report-duplicate",
      eventType: "WEEKLY_REPORT_APPROVED",
      sourceType: "WeeklyReport",
      sourceId: "weekly-report-1",
      actorUserId: "ta-1",
      teamId: "team-1",
      payload: { weeklyReportId: "weekly-report-1" },
    },
    {
      code: "WEEKLY_REPORT_APPROVED_TEAM",
      name: "Weekly report approved",
      eventType: "WEEKLY_REPORT_APPROVED",
      targetType: "TEAM",
      baseXp: 75,
      version: 1,
      conditions: {},
      caps: { maxPerWeeklyReport: 1 },
      multipliers: {},
    },
  );

  assert.equal(calls.some((call) => call.model === "xpTransaction" && call.method === "create"), false);
});

test("processRuleForEvent skips XP for self-approved tasks", async (t) => {
  const { tx, calls } = createProcessorTx();
  mockTransaction(t, tx);

  await processRuleForEvent(
    {
      id: "event-self-approval-1",
      eventType: "TASK_APPROVED",
      sourceType: "Task",
      sourceId: "task-1",
      actorUserId: "student-1",
      teamId: "team-1",
      payload: { assigneeUserId: "student-1", storyPoints: 3 },
    },
    {
      ...userRule,
      code: "TASK_APPROVED_CODE",
      name: "Code task approved",
      eventType: "TASK_APPROVED",
      baseXp: 80,
    },
  );

  assert.equal(calls.length, 0);
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

test("processRuleForEvent retries serialization failures (P2034)", async (t) => {
  const { tx, calls } = createProcessorTx();
  let attemptCount = 0;
  overridePrismaProperty(t, "$transaction", async (callback) => {
    attemptCount++;
    if (attemptCount === 1) {
      const error = new Error("Serialization failure");
      error.code = "P2034";
      throw error;
    }
    return callback(tx);
  });

  await processRuleForEvent(
    {
      id: "event-retry-p2034",
      eventType: "TASK_APPROVED",
      sourceType: "Task",
      sourceId: "task-1",
      actorUserId: "doctor-1",
      teamId: "team-1",
      payload: { assigneeUserId: "student-1", storyPoints: 3 },
    },
    {
      ...userRule,
      code: "TASK_APPROVED_XP",
      name: "Task approved",
      eventType: "TASK_APPROVED",
    },
  );

  assert.equal(attemptCount, 2);
  const transactionCreate = calls.find((call) => call.model === "xpTransaction");
  assert.equal(transactionCreate.args.data.status, "AWARDED");
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
