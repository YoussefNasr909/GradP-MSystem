import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminAdjustmentSchema,
  resolveAdminCaseSchema,
  reviewAdminAdjustmentSchema,
} from "./gamification.schema.js";

test("resolveAdminCaseSchema accepts approve and reject decisions", () => {
  const approve = resolveAdminCaseSchema.parse({
    params: { caseId: "case-1" },
    body: {
      decision: "APPROVE",
      resolution: "Reviewed by doctor and accepted as legitimate work.",
    },
  });
  const reject = resolveAdminCaseSchema.parse({
    params: { caseId: "case-2" },
    body: {
      decision: "REJECT",
      resolution: "Duplicate content confirmed after review.",
      studentVisibleReason: "Duplicate submission content was confirmed.",
    },
  });

  assert.equal(approve.body.decision, "APPROVE");
  assert.equal(reject.body.decision, "REJECT");
});

test("resolveAdminCaseSchema rejects unsupported decisions", () => {
  assert.throws(() =>
    resolveAdminCaseSchema.parse({
      params: { caseId: "case-1" },
      body: {
        decision: "DISMISS",
        resolution: "Not a supported resolution.",
      },
    }),
  );
});

test("createAdminAdjustmentSchema accepts one user or team target and non-zero amount", () => {
  const userAdjustment = createAdminAdjustmentSchema.parse({
    body: {
      targetUserId: "user-1",
      amount: 75,
      reason: "Verified extra contribution during milestone review.",
    },
  });
  const teamAdjustment = createAdminAdjustmentSchema.parse({
    body: {
      targetTeamId: "team-1",
      amount: -50,
      reason: "Correction after duplicate manual award was found.",
      sourceReference: "audit-log-1",
    },
  });

  assert.equal(userAdjustment.body.targetUserId, "user-1");
  assert.equal(teamAdjustment.body.amount, -50);
});

test("createAdminAdjustmentSchema rejects ambiguous targets and zero amount", () => {
  assert.throws(() =>
    createAdminAdjustmentSchema.parse({
      body: {
        targetUserId: "user-1",
        targetTeamId: "team-1",
        amount: 25,
        reason: "Ambiguous target should not be allowed.",
      },
    }),
  );
  assert.throws(() =>
    createAdminAdjustmentSchema.parse({
      body: {
        targetUserId: "user-1",
        amount: 0,
        reason: "Zero adjustment should not be allowed.",
      },
    }),
  );
});

test("reviewAdminAdjustmentSchema accepts approve and reject decisions", () => {
  const parsed = reviewAdminAdjustmentSchema.parse({
    params: { adjustmentId: "adjustment-1" },
    body: {
      decision: "APPROVE",
      reviewComment: "Evidence verified.",
    },
  });

  assert.equal(parsed.params.adjustmentId, "adjustment-1");
  assert.equal(parsed.body.decision, "APPROVE");
});
