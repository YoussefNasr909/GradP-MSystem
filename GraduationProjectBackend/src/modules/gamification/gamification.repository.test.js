import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../loaders/dbLoader.js";
import {
  buildTeamAdjustmentBalanceData,
  buildTeamFrozenResolutionBalanceData,
  buildUserAdjustmentBalanceData,
  buildUserFrozenResolutionBalanceData,
  listLeaderboardSnapshots,
  reviewAdjustmentRequestTransaction,
  resolveSuspiciousCaseTransaction,
} from "./gamification.repository.js";

function assertNoUndefinedValues(value) {
  if (!value || typeof value !== "object") return;

  for (const [key, nestedValue] of Object.entries(value)) {
    assert.notEqual(nestedValue, undefined, `${key} should not be undefined`);
    assertNoUndefinedValues(nestedValue);
  }
}

test("listLeaderboardSnapshots returns only the latest snapshot period", async (t) => {
  const calls = [];
  const latestPeriod = {
    periodStart: new Date("2026-05-18T00:00:00.000Z"),
    periodEnd: new Date("2026-05-24T23:59:59.999Z"),
  };

  const descriptor = Object.getOwnPropertyDescriptor(prisma, "leaderboardSnapshot");
  Object.defineProperty(prisma, "leaderboardSnapshot", {
    configurable: true,
    writable: true,
    value: {
      findFirst: async (args) => {
        calls.push({ method: "findFirst", args });
        return latestPeriod;
      },
      findMany: async (args) => {
        calls.push({ method: "findMany", args });
        return [{ id: "snapshot-current", rank: 1, score: 230 }];
      },
      count: async (args) => {
        calls.push({ method: "count", args });
        return 1;
      },
    },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(prisma, "leaderboardSnapshot", descriptor);
    else delete prisma.leaderboardSnapshot;
  });

  const result = await listLeaderboardSnapshots("INDIVIDUAL_WEEKLY", { page: 1, limit: 25 });

  assert.equal(result.total, 1);
  assert.deepEqual(calls.find((call) => call.method === "findMany").args.where, {
    leaderboardType: "INDIVIDUAL_WEEKLY",
    scopeType: "GLOBAL",
    scopeId: null,
    periodStart: latestPeriod.periodStart,
    periodEnd: latestPeriod.periodEnd,
  });
  assert.deepEqual(calls.find((call) => call.method === "count").args.where, {
    leaderboardType: "INDIVIDUAL_WEEKLY",
    scopeType: "GLOBAL",
    scopeId: null,
    periodStart: latestPeriod.periodStart,
    periodEnd: latestPeriod.periodEnd,
  });
});

function createResolutionTx({ suspiciousCase, userBalance = null, teamBalance = null }) {
  const calls = [];
  const resolvedCase = {
    ...suspiciousCase,
    status: "APPROVED",
    signals: { internal: true },
  };

  const tx = {
    suspiciousActivityCase: {
      findUnique: async () => suspiciousCase,
      update: async (args) => {
        calls.push({ model: "suspiciousActivityCase", method: "update", args });
        return {
          ...resolvedCase,
          status: args.data.status,
          assignedReviewerId: args.data.assignedReviewerId,
          resolution: args.data.resolution,
          studentVisibleReason: args.data.studentVisibleReason,
          resolvedAt: args.data.resolvedAt,
        };
      },
    },
    xpTransaction: {
      update: async (args) => {
        calls.push({ model: "xpTransaction", method: "update", args });
        return { ...suspiciousCase.transaction, ...args.data };
      },
    },
    userXpBalance: {
      findUnique: async () => userBalance,
      upsert: async (args) => {
        calls.push({ model: "userXpBalance", method: "upsert", args });
        return args;
      },
    },
    teamXpBalance: {
      findUnique: async () => teamBalance,
      upsert: async (args) => {
        calls.push({ model: "teamXpBalance", method: "upsert", args });
        return args;
      },
    },
    gamificationAuditLog: {
      create: async (args) => {
        calls.push({ model: "gamificationAuditLog", method: "create", args });
        return args;
      },
    },
  };

  return { tx, calls };
}

function createAdjustmentReviewTx({ adjustmentRequest, userBalance = null, teamBalance = null }) {
  const calls = [];
  const tx = {
    xpAdjustmentRequest: {
      findUnique: async () => adjustmentRequest,
      update: async (args) => {
        calls.push({ model: "xpAdjustmentRequest", method: "update", args });
        return {
          ...adjustmentRequest,
          ...args.data,
          targetUser: adjustmentRequest.targetUser,
          targetTeam: adjustmentRequest.targetTeam,
          requestedBy: adjustmentRequest.requestedBy,
          approvedBy: { id: args.data.approvedByUserId },
        };
      },
    },
    gamificationEvent: {
      create: async (args) => {
        calls.push({ model: "gamificationEvent", method: "create", args });
        return { id: "event-new", ...args.data };
      },
    },
    xpTransaction: {
      findUnique: async () => null,
      count: async () => 0,
      create: async (args) => {
        calls.push({ model: "xpTransaction", method: "create", args });
        return { id: "tx-new", ...args.data };
      },
    },
    userXpBalance: {
      findUnique: async () => userBalance,
      upsert: async (args) => {
        calls.push({ model: "userXpBalance", method: "upsert", args });
        return args;
      },
    },
    teamXpBalance: {
      findUnique: async () => teamBalance,
      upsert: async (args) => {
        calls.push({ model: "teamXpBalance", method: "upsert", args });
        return args;
      },
    },
    gamificationAuditLog: {
      create: async (args) => {
        calls.push({ model: "gamificationAuditLog", method: "create", args });
        return args;
      },
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
    notification: {
      create: async (args) => {
        calls.push({ model: "notification", method: "create", args });
        return { id: "notification-new", ...args.data };
      },
    },
    user: {
      findUnique: async () => ({ email: null, settings: { emailNotifications: false } }),
    },
    team: {
      findUnique: async () => ({ leaderId: "leader-1", name: "Compiler Crew" }),
    },
  };

  return { tx, calls };
}

function mockPrismaTransaction(t, tx) {
  const originalTransaction = prisma.$transaction;
  Object.defineProperty(prisma, "$transaction", {
    configurable: true,
    writable: true,
    value: async (callback) => callback(tx),
  });
  t.after(() => {
    Object.defineProperty(prisma, "$transaction", {
      configurable: true,
      writable: true,
      value: originalTransaction,
    });
  });
}

test("buildUserFrozenResolutionBalanceData approves frozen XP into all awarded user totals", () => {
  const data = buildUserFrozenResolutionBalanceData({
    userId: "user-1",
    balance: { lifetimeXp: 375, frozenXp: 200 },
    amount: 125,
    approved: true,
  });

  assert.deepEqual(data.where, { userId: "user-1" });
  assert.deepEqual(data.update.lifetimeXp, { increment: 125 });
  assert.deepEqual(data.update.semesterXp, { increment: 125 });
  assert.deepEqual(data.update.monthlyXp, { increment: 125 });
  assert.deepEqual(data.update.weeklyXp, { increment: 125 });
  assert.equal(data.update.frozenXp, 75);
  assert.equal(data.update.level, 3);
  assertNoUndefinedValues(data);
});

test("buildUserFrozenResolutionBalanceData rejects frozen XP without awarded increments", () => {
  const data = buildUserFrozenResolutionBalanceData({
    userId: "user-1",
    balance: { lifetimeXp: 375, frozenXp: 100 },
    amount: 125,
    approved: false,
  });

  assert.deepEqual(data.update, { frozenXp: 0 });
  assert.deepEqual(data.create, { userId: "user-1", frozenXp: 0 });
  assertNoUndefinedValues(data);
});

test("buildTeamFrozenResolutionBalanceData approves frozen XP into all awarded team totals", () => {
  const data = buildTeamFrozenResolutionBalanceData({
    teamId: "team-1",
    balance: { frozenTeamXp: 150 },
    amount: 80,
    approved: true,
  });

  assert.deepEqual(data.where, { teamId: "team-1" });
  assert.deepEqual(data.update.lifetimeTeamXp, { increment: 80 });
  assert.deepEqual(data.update.semesterTeamXp, { increment: 80 });
  assert.deepEqual(data.update.monthlyTeamXp, { increment: 80 });
  assert.deepEqual(data.update.weeklyTeamXp, { increment: 80 });
  assert.equal(data.update.frozenTeamXp, 70);
  assertNoUndefinedValues(data);
});

test("buildUserAdjustmentBalanceData applies positive manual XP to all user totals", () => {
  const data = buildUserAdjustmentBalanceData({
    userId: "user-1",
    balance: { lifetimeXp: 390 },
    amount: 110,
  });

  assert.deepEqual(data.update.lifetimeXp, { increment: 110 });
  assert.deepEqual(data.update.semesterXp, { increment: 110 });
  assert.deepEqual(data.update.monthlyXp, { increment: 110 });
  assert.deepEqual(data.update.weeklyXp, { increment: 110 });
  assert.equal(data.update.level, 3);
  assertNoUndefinedValues(data);
});

test("buildUserAdjustmentBalanceData clamps negative manual XP at zero", () => {
  const data = buildUserAdjustmentBalanceData({
    userId: "user-1",
    balance: { lifetimeXp: 80, semesterXp: 50, monthlyXp: 30, weeklyXp: 10 },
    amount: -125,
  });

  assert.deepEqual(data.update, {
    lifetimeXp: 0,
    semesterXp: 0,
    monthlyXp: 0,
    weeklyXp: 0,
    level: 1,
  });
  assertNoUndefinedValues(data);
});

test("buildTeamAdjustmentBalanceData clamps negative manual team XP at zero", () => {
  const data = buildTeamAdjustmentBalanceData({
    teamId: "team-1",
    balance: {
      lifetimeTeamXp: 200,
      semesterTeamXp: 70,
      monthlyTeamXp: 20,
      weeklyTeamXp: 10,
    },
    amount: -80,
  });

  assert.deepEqual(data.update, {
    lifetimeTeamXp: 120,
    semesterTeamXp: 0,
    monthlyTeamXp: 0,
    weeklyTeamXp: 0,
  });
  assertNoUndefinedValues(data);
});

test("resolveSuspiciousCaseTransaction approves a frozen user transaction atomically", async (t) => {
  const suspiciousCase = {
    id: "case-1",
    status: "OPEN",
    transaction: {
      id: "tx-1",
      status: "FROZEN",
      recipientType: "USER",
      userId: "user-1",
      teamId: null,
      amount: 125,
    },
  };
  const { tx, calls } = createResolutionTx({
    suspiciousCase,
    userBalance: { lifetimeXp: 375, frozenXp: 200 },
  });
  mockPrismaTransaction(t, tx);

  const result = await resolveSuspiciousCaseTransaction({
    caseId: "case-1",
    actorUserId: "doctor-1",
    decision: "APPROVE",
    resolution: "Reviewed and approved.",
  });

  assert.equal(result.outcome, "RESOLVED");
  assert.equal(result.case.status, "APPROVED");
  assert.deepEqual(
    calls.find((call) => call.model === "xpTransaction").args.data.status,
    "AWARDED",
  );
  assert.deepEqual(
    calls.find((call) => call.model === "userXpBalance").args.update,
    {
      lifetimeXp: { increment: 125 },
      semesterXp: { increment: 125 },
      monthlyXp: { increment: 125 },
      weeklyXp: { increment: 125 },
      frozenXp: 75,
      level: 3,
    },
  );
  assert.equal(calls.at(-1).model, "gamificationAuditLog");
});

test("resolveSuspiciousCaseTransaction rejects frozen XP without awarding balances", async (t) => {
  const suspiciousCase = {
    id: "case-2",
    status: "UNDER_REVIEW",
    transaction: {
      id: "tx-2",
      status: "FROZEN",
      recipientType: "USER",
      userId: "user-1",
      teamId: null,
      amount: 60,
    },
  };
  const { tx, calls } = createResolutionTx({
    suspiciousCase,
    userBalance: { lifetimeXp: 300, frozenXp: 40 },
  });
  mockPrismaTransaction(t, tx);

  const result = await resolveSuspiciousCaseTransaction({
    caseId: "case-2",
    actorUserId: "doctor-1",
    decision: "REJECT",
    resolution: "Duplicate confirmed.",
    studentVisibleReason: "Duplicate content was confirmed.",
  });

  assert.equal(result.outcome, "RESOLVED");
  assert.equal(result.case.status, "REJECTED");
  assert.equal(calls.find((call) => call.model === "xpTransaction").args.data.status, "REJECTED");
  assert.deepEqual(calls.find((call) => call.model === "userXpBalance").args.update, {
    frozenXp: 0,
  });
});

test("resolveSuspiciousCaseTransaction reports already resolved cases without balance movement", async (t) => {
  const suspiciousCase = {
    id: "case-3",
    status: "APPROVED",
    transaction: {
      id: "tx-3",
      status: "FROZEN",
      recipientType: "USER",
      userId: "user-1",
      teamId: null,
      amount: 30,
    },
  };
  const { tx, calls } = createResolutionTx({ suspiciousCase });
  mockPrismaTransaction(t, tx);

  const result = await resolveSuspiciousCaseTransaction({
    caseId: "case-3",
    actorUserId: "admin-1",
    decision: "APPROVE",
    resolution: "Second review attempt.",
  });

  assert.equal(result.outcome, "ALREADY_RESOLVED");
  assert.equal(calls.length, 0);
});

test("reviewAdjustmentRequestTransaction approves manual user XP atomically", async (t) => {
  const adjustmentRequest = {
    id: "adjustment-1",
    requestedByUserId: "doctor-1",
    targetUserId: "student-1",
    targetTeamId: null,
    amount: 120,
    reason: "Manual correction for verified extra work.",
    sourceReference: "weekly-report-1",
    status: "PENDING",
    targetUser: { id: "student-1" },
    targetTeam: null,
    requestedBy: { id: "doctor-1" },
  };
  const { tx, calls } = createAdjustmentReviewTx({
    adjustmentRequest,
    userBalance: { lifetimeXp: 380, semesterXp: 300, monthlyXp: 100, weeklyXp: 40 },
  });
  mockPrismaTransaction(t, tx);

  const result = await reviewAdjustmentRequestTransaction({
    adjustmentId: "adjustment-1",
    reviewerUserId: "admin-1",
    decision: "APPROVE",
    reviewComment: "Approved after checking the source evidence.",
  });

  assert.equal(result.outcome, "APPROVED");
  assert.equal(calls.find((call) => call.model === "gamificationEvent").args.data.status, "PROCESSED");

  const transaction = calls.find((call) => call.model === "xpTransaction");
  assert.equal(transaction.args.data.direction, "CREDIT");
  assert.equal(transaction.args.data.amount, 120);
  assert.equal(transaction.args.data.userId, "student-1");
  assert.equal(transaction.args.data.ruleCode, "MANUAL_XP_ADJUSTMENT");

  const balance = calls.find((call) => call.model === "userXpBalance");
  assert.deepEqual(balance.args.update.lifetimeXp, { increment: 120 });
  assert.equal(balance.args.update.level, 3);

  const requestUpdate = calls.find((call) => call.model === "xpAdjustmentRequest");
  assert.equal(requestUpdate.args.data.status, "APPROVED");
  assert.equal(requestUpdate.args.data.createdEventId, "event-new");
  assert.equal(requestUpdate.args.data.createdTransactionId, "tx-new");
});

test("reviewAdjustmentRequestTransaction rejects without creating event, transaction, or balance updates", async (t) => {
  const adjustmentRequest = {
    id: "adjustment-2",
    requestedByUserId: "ta-1",
    targetUserId: null,
    targetTeamId: "team-1",
    amount: -50,
    reason: "Manual deduction request.",
    sourceReference: null,
    status: "PENDING",
    targetUser: null,
    targetTeam: { id: "team-1", leaderId: "leader-1" },
    requestedBy: { id: "ta-1" },
  };
  const { tx, calls } = createAdjustmentReviewTx({ adjustmentRequest });
  mockPrismaTransaction(t, tx);

  const result = await reviewAdjustmentRequestTransaction({
    adjustmentId: "adjustment-2",
    reviewerUserId: "doctor-1",
    decision: "REJECT",
    reviewComment: "Insufficient evidence.",
  });

  assert.equal(result.outcome, "REJECTED");
  assert.equal(calls.some((call) => call.model === "gamificationEvent"), false);
  assert.equal(calls.some((call) => call.model === "xpTransaction"), false);
  assert.equal(calls.some((call) => call.model === "teamXpBalance"), false);
  assert.equal(calls.find((call) => call.model === "xpAdjustmentRequest").args.data.status, "REJECTED");
});
