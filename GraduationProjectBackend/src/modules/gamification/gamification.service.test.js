import assert from "node:assert/strict";
import test from "node:test";
import { ROLES } from "../../common/constants/roles.js";
import {
  assertCanResolveSuspiciousCase,
  assertCanReviewAdjustment,
  assertSuspiciousCaseCanBeResolved,
  buildAdjustmentReviewedNotification,
  buildCaseResolutionNotification,
  getXpMutationLeaderboardRefreshTypes,
} from "./gamification.service.js";

const openFrozenCase = {
  id: "case-1",
  teamId: "team-1",
  status: "OPEN",
  team: { doctorId: "doctor-1" },
  transaction: { status: "FROZEN" },
};

test("getXpMutationLeaderboardRefreshTypes returns valid leaderboard snapshot types", () => {
  assert.deepEqual(getXpMutationLeaderboardRefreshTypes(), [
    "INDIVIDUAL_WEEKLY",
    "INDIVIDUAL_SEMESTER",
    "INDIVIDUAL_LIFETIME",
    "TEAM_WEEKLY",
    "TEAM_SEMESTER",
  ]);
});

test("assertSuspiciousCaseCanBeResolved rejects already resolved cases with conflict", () => {
  assert.throws(
    () =>
      assertSuspiciousCaseCanBeResolved({
        ...openFrozenCase,
        status: "APPROVED",
      }),
    (err) =>
      err.statusCode === 409 && err.code === "GAMIFICATION_CASE_ALREADY_RESOLVED",
  );
});

test("assertCanResolveSuspiciousCase allows admins to resolve any team case", () => {
  assert.doesNotThrow(() =>
    assertCanResolveSuspiciousCase(
      { id: "admin-1", role: ROLES.ADMIN },
      { ...openFrozenCase, team: { doctorId: "doctor-9" } },
    ),
  );
});

test("assertCanResolveSuspiciousCase allows doctors only for assigned teams", () => {
  assert.doesNotThrow(() =>
    assertCanResolveSuspiciousCase({ id: "doctor-1", role: ROLES.DOCTOR }, openFrozenCase),
  );

  assert.throws(
    () =>
      assertCanResolveSuspiciousCase(
        { id: "doctor-2", role: ROLES.DOCTOR },
        openFrozenCase,
      ),
    (err) => err.statusCode === 403 && err.code === "GAMIFICATION_CASE_ACCESS_DENIED",
  );
});

test("assertCanResolveSuspiciousCase rejects TAs", () => {
  assert.throws(
    () => assertCanResolveSuspiciousCase({ id: "ta-1", role: ROLES.TA }, openFrozenCase),
    (err) => err.statusCode === 403 && err.code === "GAMIFICATION_CASE_RESOLVE_DENIED",
  );
});

test("buildCaseResolutionNotification notifies user XP approval without sensitive signals", () => {
  const notification = buildCaseResolutionNotification({
    decision: "APPROVE",
    transaction: {
      recipientType: "USER",
      userId: "user-1",
      amount: 125,
      metadata: { signals: { fileHashMatched: true } },
    },
    studentVisibleReason: "Internal review note.",
  });

  assert.deepEqual(notification, {
    userId: "user-1",
    type: "XP_AWARDED",
    title: "XP Approved",
    message: "125 XP has been approved after review.",
    actionUrl: "/dashboard/gamification",
  });
  assert.doesNotMatch(notification.message, /hash|duplicate|signal/i);
});

test("buildCaseResolutionNotification notifies team leader for rejected team XP", () => {
  const notification = buildCaseResolutionNotification({
    decision: "REJECT",
    transaction: {
      recipientType: "TEAM",
      teamId: "team-1",
      amount: 80,
    },
    team: {
      name: "Compiler Crew",
      leaderId: "leader-1",
    },
    studentVisibleReason: "Reviewed XP was not approved.",
  });

  assert.deepEqual(notification, {
    userId: "leader-1",
    type: "XP_ADJUSTMENT_REVIEWED",
    title: "Team XP Review Resolved",
    message: "Reviewed XP was not approved.",
    actionUrl: "/dashboard/gamification",
  });
});

test("assertCanReviewAdjustment allows doctors only for assigned target teams", () => {
  const request = {
    status: "PENDING",
    requestedByUserId: "ta-1",
    targetUser: null,
    targetTeam: { id: "team-1", doctorId: "doctor-1", taId: "ta-1" },
  };

  assert.doesNotThrow(() =>
    assertCanReviewAdjustment({ id: "doctor-1", role: ROLES.DOCTOR }, request),
  );
  assert.throws(
    () => assertCanReviewAdjustment({ id: "doctor-2", role: ROLES.DOCTOR }, request),
    (err) => err.statusCode === 403 && err.code === "GAMIFICATION_ADJUSTMENT_ACCESS_DENIED",
  );
});

test("assertCanReviewAdjustment rejects TAs and self-review", () => {
  const request = {
    status: "PENDING",
    requestedByUserId: "doctor-1",
    targetUser: {
      id: "student-1",
      ledTeam: null,
      teamMembership: { team: { id: "team-1", doctorId: "doctor-1", taId: "ta-1" } },
    },
    targetTeam: null,
  };

  assert.throws(
    () => assertCanReviewAdjustment({ id: "ta-1", role: ROLES.TA }, request),
    (err) => err.statusCode === 403 && err.code === "GAMIFICATION_ADJUSTMENT_REVIEW_DENIED",
  );
  assert.throws(
    () => assertCanReviewAdjustment({ id: "doctor-1", role: ROLES.DOCTOR }, request),
    (err) => err.statusCode === 403 && err.code === "GAMIFICATION_ADJUSTMENT_SELF_REVIEW_DENIED",
  );
});

test("buildAdjustmentReviewedNotification describes approved deductions safely", () => {
  const notification = buildAdjustmentReviewedNotification({
    decision: "APPROVE",
    request: {
      targetUserId: "student-1",
      targetTeamId: null,
      amount: -45,
    },
  });

  assert.deepEqual(notification, {
    userId: "student-1",
    type: "XP_ADJUSTMENT_REVIEWED",
    title: "XP Adjustment Approved",
    message: "45 XP was deducted after staff review.",
    actionUrl: "/dashboard/gamification",
  });
});
