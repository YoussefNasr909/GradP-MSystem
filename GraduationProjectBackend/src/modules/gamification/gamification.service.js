import { AppError } from "../../common/errors/AppError.js";
import { ROLES } from "../../common/constants/roles.js";
import { notify } from "../../common/utils/notify.js";
import * as repo from "./gamification.repository.js";

const STAFF_ROLES = new Set([ROLES.TA, ROLES.DOCTOR, ROLES.ADMIN]);
const RESOLVABLE_CASE_STATUSES = new Set(["OPEN", "UNDER_REVIEW", "ESCALATED"]);
const DEFAULT_USER_BALANCE = {
  lifetimeXp: 0,
  semesterXp: 0,
  monthlyXp: 0,
  weeklyXp: 0,
  pendingXp: 0,
  frozenXp: 0,
  level: 1,
  qualityScore: null,
  lastRecalculatedAt: null,
};

const DEFAULT_TEAM_BALANCE = {
  lifetimeTeamXp: 0,
  semesterTeamXp: 0,
  monthlyTeamXp: 0,
  weeklyTeamXp: 0,
  pendingTeamXp: 0,
  frozenTeamXp: 0,
  teamHealthScore: null,
  leaderboardScore: null,
  lastRecalculatedAt: null,
};

async function assertTeamAccess(actor, teamId) {
  if (actor.role === ROLES.ADMIN) return;

  const team = await repo.findTeamWithAccess(teamId);
  if (!team) {
    throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
  }

  const memberIds = team.members.map((m) => m.userId);
  const isTeamMember = team.leaderId === actor.id || memberIds.includes(actor.id);
  const isAssignedStaff =
    (actor.role === ROLES.TA && team.taId === actor.id) ||
    (actor.role === ROLES.DOCTOR && team.doctorId === actor.id);

  if (!isTeamMember && !isAssignedStaff) {
    throw new AppError(
      "You do not have access to this team's gamification data.",
      403,
      "GAMIFICATION_TEAM_ACCESS_DENIED",
    );
  }
}

function sanitizeCasesForRole(cases, role) {
  if (role === ROLES.ADMIN) return cases;
  return cases.map(({ signals, ...rest }) => rest);
}

export function assertSuspiciousCaseCanBeResolved(suspiciousCase) {
  if (!suspiciousCase.transaction) {
    throw new AppError(
      "This case is not linked to a transaction.",
      409,
      "GAMIFICATION_CASE_TRANSACTION_MISSING",
    );
  }

  if (suspiciousCase.transaction.status !== "FROZEN") {
    throw new AppError(
      "Only frozen transactions can be resolved through this flow.",
      409,
      "GAMIFICATION_CASE_NOT_FROZEN",
    );
  }

  if (!RESOLVABLE_CASE_STATUSES.has(suspiciousCase.status)) {
    throw new AppError(
      "This case has already been resolved.",
      409,
      "GAMIFICATION_CASE_ALREADY_RESOLVED",
    );
  }
}

export function assertCanResolveSuspiciousCase(actor, suspiciousCase) {
  assertCaseResolverRole(actor);

  if (actor.role === ROLES.DOCTOR) {
    if (!suspiciousCase.teamId || suspiciousCase.team?.doctorId !== actor.id) {
      throw new AppError(
        "You can only resolve cases for your assigned teams.",
        403,
        "GAMIFICATION_CASE_ACCESS_DENIED",
      );
    }
  }
}

export function buildCaseResolutionNotification({ decision, transaction, team, studentVisibleReason }) {
  if (!transaction) return null;

  const amount = transaction.amount ?? 0;
  const isTeamAward = transaction.recipientType === "TEAM";
  const userId = isTeamAward ? team?.leaderId : transaction.userId;

  if (!userId) return null;

  if (decision === "APPROVE") {
    return {
      userId,
      type: "XP_AWARDED",
      title: isTeamAward ? "Team XP Approved" : "XP Approved",
      message: isTeamAward
        ? `${amount} team XP for ${team?.name ?? "your team"} has been approved after review.`
        : `${amount} XP has been approved after review.`,
      actionUrl: "/dashboard/gamification",
    };
  }

  return {
    userId,
    type: "XP_ADJUSTMENT_REVIEWED",
    title: isTeamAward ? "Team XP Review Resolved" : "XP Review Resolved",
    message:
      studentVisibleReason ||
      (isTeamAward
        ? `Reviewed team XP for ${team?.name ?? "your team"} was not approved.`
        : "Reviewed XP was not approved."),
    actionUrl: "/dashboard/gamification",
  };
}

async function notifyCaseResolution({ decision, resolvedCase }) {
  const transaction = resolvedCase?.transaction;
  if (!transaction) return;

  const team =
    transaction.recipientType === "TEAM" && transaction.teamId
      ? await repo.findTeamGamificationNotificationTarget(transaction.teamId)
      : resolvedCase.team;

  const notification = buildCaseResolutionNotification({
    decision,
    transaction,
    team,
    studentVisibleReason: resolvedCase.studentVisibleReason,
  });

  if (notification) {
    await notify(notification);
  }
}

function assertCaseResolverRole(actor) {
  if (![ROLES.DOCTOR, ROLES.ADMIN].includes(actor.role)) {
    throw new AppError(
      "Only doctors and administrators can resolve suspicious activity cases.",
      403,
      "GAMIFICATION_CASE_RESOLVE_DENIED",
    );
  }
}

function getAdjustmentTargetTeams({ targetUser, targetTeam }) {
  return [targetTeam, targetUser?.ledTeam, targetUser?.teamMembership?.team].filter(Boolean);
}

function assertAdjustmentTargetAccess(actor, { targetUser, targetTeam }) {
  if (actor.role === ROLES.ADMIN) return;

  const teams = getAdjustmentTargetTeams({ targetUser, targetTeam });
  const hasAssignedTeam = teams.some(
    (team) =>
      (actor.role === ROLES.DOCTOR && team.doctorId === actor.id) ||
      (actor.role === ROLES.TA && team.taId === actor.id),
  );

  if (!hasAssignedTeam) {
    throw new AppError(
      "You can only create or review adjustment requests for your assigned teams.",
      403,
      "GAMIFICATION_ADJUSTMENT_ACCESS_DENIED",
    );
  }
}

function assertAdjustmentReviewerRole(actor) {
  if (![ROLES.DOCTOR, ROLES.ADMIN].includes(actor.role)) {
    throw new AppError(
      "Only doctors and administrators can review XP adjustment requests.",
      403,
      "GAMIFICATION_ADJUSTMENT_REVIEW_DENIED",
    );
  }
}

export function assertCanReviewAdjustment(actor, adjustmentRequest) {
  assertAdjustmentReviewerRole(actor);

  if (adjustmentRequest.status !== "PENDING") {
    throw new AppError(
      "This adjustment request has already been reviewed.",
      409,
      "GAMIFICATION_ADJUSTMENT_ALREADY_REVIEWED",
    );
  }

  if (actor.role !== ROLES.ADMIN && adjustmentRequest.requestedByUserId === actor.id) {
    throw new AppError(
      "You cannot review your own XP adjustment request.",
      403,
      "GAMIFICATION_ADJUSTMENT_SELF_REVIEW_DENIED",
    );
  }

  assertAdjustmentTargetAccess(actor, {
    targetUser: adjustmentRequest.targetUser,
    targetTeam: adjustmentRequest.targetTeam,
  });
}

export function buildAdjustmentReviewedNotification({ request, decision }) {
  const isTeam = Boolean(request?.targetTeamId);
  const userId = isTeam ? request?.targetTeam?.leaderId : request?.targetUserId;
  if (!userId) return null;

  if (decision === "APPROVE") {
    const amount = Math.abs(request.amount ?? 0);
    const verb = (request.amount ?? 0) >= 0 ? "awarded" : "deducted";
    return {
      userId,
      type: "XP_ADJUSTMENT_REVIEWED",
      title: isTeam ? "Team XP Adjustment Approved" : "XP Adjustment Approved",
      message: isTeam
        ? `${amount} team XP was ${verb} for ${request.targetTeam?.name ?? "your team"}.`
        : `${amount} XP was ${verb} after staff review.`,
      actionUrl: "/dashboard/gamification",
    };
  }

  return {
    userId,
    type: "XP_ADJUSTMENT_REVIEWED",
    title: isTeam ? "Team XP Adjustment Rejected" : "XP Adjustment Rejected",
    message: isTeam
      ? `An XP adjustment request for ${request.targetTeam?.name ?? "your team"} was not approved.`
      : "An XP adjustment request was not approved.",
    actionUrl: "/dashboard/gamification",
  };
}

async function notifyAdjustmentReview({ request, decision }) {
  const notification = buildAdjustmentReviewedNotification({ request, decision });
  if (notification) {
    await notify(notification);
  }
}

export async function getMyOverviewService(actor) {
  const balance = await repo.findUserXpBalance(actor.id);
  const badges = await repo.listUserBadges(actor.id);
  const recentTx = await repo.listUserTransactions(actor.id, {
    page: 1,
    limit: 5,
    status: undefined,
    sourceType: undefined,
  });

  return {
    balance: balance ?? DEFAULT_USER_BALANCE,
    badges: badges.map(formatUserBadge),
    recentTransactions: recentTx.items,
  };
}

export async function getMyHistoryService(actor, query) {
  return repo.listUserTransactions(actor.id, query);
}

export async function getMyBadgesService(actor) {
  const [earned, allDefinitions] = await Promise.all([
    repo.listUserBadges(actor.id),
    repo.listAllBadgeDefinitions(),
  ]);

  const earnedMap = new Map(earned.map((b) => [b.badgeDefinition.code, b]));

  return allDefinitions.map((def) => {
    const earnedBadge = earnedMap.get(def.code);
    if (earnedBadge) {
      return {
        ...formatBadgeDefinition(def),
        earned: true,
        unlockedAt: earnedBadge.unlockedAt,
        progress: earnedBadge.progress ?? 1,
      };
    }

    if (def.isHidden) {
      return {
        code: def.code,
        name: "???",
        description: "Hidden badge",
        earned: false,
        isHidden: true,
        rarity: def.rarity,
        icon: "help-circle",
        progress: 0,
      };
    }

    return {
      ...formatBadgeDefinition(def),
      earned: false,
      unlockedAt: null,
      progress: 0,
    };
  });
}

export async function getTeamSummaryService(actor, teamId) {
  await assertTeamAccess(actor, teamId);

  const balance = await repo.findTeamXpBalance(teamId);

  return {
    teamId,
    balance: balance ?? DEFAULT_TEAM_BALANCE,
  };
}

export async function getTeamHistoryService(actor, teamId, query) {
  await assertTeamAccess(actor, teamId);
  return repo.listTeamTransactions(teamId, query);
}

export async function getLeaderboardsService(_actor, query) {
  const { type, page, limit } = query;
  const derived = await repo.deriveLeaderboardFromBalances(type, { page, limit });
  return { type, source: "balance", ...derived };
}

export async function getAdminCasesService(actor, query) {
  assertStaffRole(actor, "view suspicious activity cases");

  const scopedQuery = await applyScopeForStaff(actor, query);
  const result = await repo.listSuspiciousCases(scopedQuery);

  return {
    ...result,
    items: sanitizeCasesForRole(result.items, actor.role),
  };
}

export async function resolveAdminCaseService(actor, caseId, payload) {
  assertCaseResolverRole(actor);

  const suspiciousCase = await repo.findSuspiciousCaseForResolution(caseId);
  if (!suspiciousCase) {
    throw new AppError("Suspicious activity case not found.", 404, "GAMIFICATION_CASE_NOT_FOUND");
  }

  assertSuspiciousCaseCanBeResolved(suspiciousCase);
  assertCanResolveSuspiciousCase(actor, suspiciousCase);

  const resolutionResult = await repo.resolveSuspiciousCaseTransaction({
    caseId,
    actorUserId: actor.id,
    decision: payload.decision,
    resolution: payload.resolution,
    studentVisibleReason: payload.studentVisibleReason,
  });

  if (!resolutionResult || resolutionResult.outcome === "NOT_FOUND") {
    throw new AppError("Suspicious activity case not found.", 404, "GAMIFICATION_CASE_NOT_FOUND");
  }
  if (resolutionResult.outcome === "TRANSACTION_MISSING") {
    throw new AppError(
      "This case is not linked to a transaction.",
      409,
      "GAMIFICATION_CASE_TRANSACTION_MISSING",
    );
  }
  if (resolutionResult.outcome === "NOT_FROZEN") {
    throw new AppError(
      "Only frozen transactions can be resolved through this flow.",
      409,
      "GAMIFICATION_CASE_NOT_FROZEN",
    );
  }
  if (resolutionResult.outcome === "ALREADY_RESOLVED") {
    throw new AppError(
      "This case has already been resolved.",
      409,
      "GAMIFICATION_CASE_ALREADY_RESOLVED",
    );
  }

  await notifyCaseResolution({
    decision: payload.decision,
    resolvedCase: resolutionResult.case,
  });

  return sanitizeCasesForRole([resolutionResult.case], actor.role)[0];
}

export async function getAdminAdjustmentsService(actor, query) {
  assertStaffRole(actor, "view adjustment requests");

  if (actor.role === ROLES.ADMIN) {
    return repo.listAdjustmentRequests(query);
  }

  const assignedTeamIds = await repo.listStaffAssignedTeamIds(actor.id, actor.role);
  return repo.listAdjustmentRequestsScoped({
    ...query,
    teamIds: assignedTeamIds,
    requestedByUserId: actor.id,
  });
}

export async function createAdminAdjustmentService(actor, payload) {
  assertStaffRole(actor, "create XP adjustment requests");

  const [targetUser, targetTeam] = await Promise.all([
    payload.targetUserId ? repo.findUserAdjustmentTarget(payload.targetUserId) : null,
    payload.targetTeamId ? repo.findTeamAdjustmentTarget(payload.targetTeamId) : null,
  ]);

  if (payload.targetUserId && !targetUser) {
    throw new AppError("Target user not found.", 404, "GAMIFICATION_ADJUSTMENT_TARGET_NOT_FOUND");
  }
  if (payload.targetTeamId && !targetTeam) {
    throw new AppError("Target team not found.", 404, "GAMIFICATION_ADJUSTMENT_TARGET_NOT_FOUND");
  }

  assertAdjustmentTargetAccess(actor, { targetUser, targetTeam });

  return repo.createAdjustmentRequest({
    requestedByUserId: actor.id,
    targetUserId: payload.targetUserId ?? null,
    targetTeamId: payload.targetTeamId ?? null,
    amount: payload.amount,
    reason: payload.reason,
    sourceReference: payload.sourceReference ?? null,
  });
}

export async function reviewAdminAdjustmentService(actor, adjustmentId, payload) {
  assertAdjustmentReviewerRole(actor);

  const adjustmentRequest = await repo.findAdjustmentRequestForReview(adjustmentId);
  if (!adjustmentRequest) {
    throw new AppError("XP adjustment request not found.", 404, "GAMIFICATION_ADJUSTMENT_NOT_FOUND");
  }

  assertCanReviewAdjustment(actor, adjustmentRequest);

  const result = await repo.reviewAdjustmentRequestTransaction({
    adjustmentId,
    reviewerUserId: actor.id,
    decision: payload.decision,
    reviewComment: payload.reviewComment,
  });

  if (!result || result.outcome === "NOT_FOUND") {
    throw new AppError("XP adjustment request not found.", 404, "GAMIFICATION_ADJUSTMENT_NOT_FOUND");
  }
  if (result.outcome === "ALREADY_REVIEWED") {
    throw new AppError(
      "This adjustment request has already been reviewed.",
      409,
      "GAMIFICATION_ADJUSTMENT_ALREADY_REVIEWED",
    );
  }

  await notifyAdjustmentReview({
    request: result.request,
    decision: payload.decision,
  });

  return result.request;
}

export async function getAdminAuditLogsService(actor, query) {
  if (actor.role !== ROLES.ADMIN) {
    throw new AppError(
      "Only administrators can view audit logs.",
      403,
      "GAMIFICATION_AUDIT_ACCESS_DENIED",
    );
  }
  return repo.listAuditLogs(query);
}

function assertStaffRole(actor, actionLabel) {
  if (!STAFF_ROLES.has(actor.role)) {
    throw new AppError(
      `You do not have permission to ${actionLabel}.`,
      403,
      "GAMIFICATION_STAFF_ACCESS_DENIED",
    );
  }
}

async function applyScopeForStaff(actor, query) {
  if (actor.role === ROLES.ADMIN) return query;

  const assignedTeamIds = await repo.listStaffAssignedTeamIds(actor.id, actor.role);

  if (query.teamId) {
    if (!assignedTeamIds.includes(query.teamId)) {
      throw new AppError(
        "You do not have access to this team's suspicious activity cases.",
        403,
        "GAMIFICATION_CASE_ACCESS_DENIED",
      );
    }
    return query;
  }

  return {
    ...query,
    teamIds: assignedTeamIds,
  };
}

function formatUserBadge(badge) {
  return {
    ...formatBadgeDefinition(badge.badgeDefinition),
    earned: true,
    unlockedAt: badge.unlockedAt,
    progress: badge.progress ?? 1,
  };
}

function formatBadgeDefinition(def) {
  return {
    code: def.code,
    name: def.name,
    description: def.description,
    category: def.category,
    rarity: def.rarity,
    targetType: def.targetType,
    xpReward: def.xpReward,
    icon: def.icon,
    isHidden: def.isHidden,
  };
}
