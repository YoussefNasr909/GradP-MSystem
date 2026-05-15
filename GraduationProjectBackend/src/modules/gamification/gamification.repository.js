import { prisma } from "../../loaders/dbLoader.js";
import { evaluateBadgesForTeam, evaluateBadgesForUser } from "./gamification.badges.js";

// ─── Select shapes (safe DTOs — no sensitive anti-cheat internals) ───

const userMiniSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  role: true,
};

const transactionSelect = {
  id: true,
  recipientType: true,
  userId: true,
  teamId: true,
  amount: true,
  direction: true,
  status: true,
  reason: true,
  sourceType: true,
  sourceId: true,
  ruleCode: true,
  baseXp: true,
  qualityMultiplier: true,
  timelinessMultiplier: true,
  evidenceMultiplier: true,
  difficultyMultiplier: true,
  createdAt: true,
};

const badgeDefinitionSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  category: true,
  rarity: true,
  targetType: true,
  level: true,
  criteria: true,
  xpReward: true,
  icon: true,
  isHidden: true,
  isSeasonal: true,
  isActive: true,
};

const adjustmentRequestSelect = {
  id: true,
  requestedByUserId: true,
  targetUserId: true,
  targetTeamId: true,
  amount: true,
  reason: true,
  sourceReference: true,
  status: true,
  reviewComment: true,
  createdEventId: true,
  createdTransactionId: true,
  createdAt: true,
  reviewedAt: true,
  requestedBy: { select: userMiniSelect },
  targetUser: { select: userMiniSelect },
  targetTeam: { select: { id: true, name: true, leaderId: true } },
  approvedBy: { select: userMiniSelect },
};

const RESOLVABLE_CASE_STATUSES = new Set(["OPEN", "UNDER_REVIEW", "ESCALATED"]);

// ─── User Balance ────────────────────────────────────────────

export async function findUserXpBalance(userId) {
  return prisma.userXpBalance.findUnique({ where: { userId } });
}

// ─── Team Balance ────────────────────────────────────────────

export async function findTeamXpBalance(teamId) {
  return prisma.teamXpBalance.findUnique({ where: { teamId } });
}

// ─── XP Transactions ────────────────────────────────────────

export async function listUserTransactions(userId, { page, limit, status, sourceType }) {
  const where = {
    userId,
    recipientType: "USER",
    ...(status ? { status } : {}),
    ...(sourceType ? { sourceType } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.xpTransaction.findMany({
      where,
      select: transactionSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.xpTransaction.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function listTeamTransactions(teamId, { page, limit, status }) {
  const where = {
    teamId,
    recipientType: "TEAM",
    ...(status ? { status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.xpTransaction.findMany({
      where,
      select: transactionSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.xpTransaction.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Badges ──────────────────────────────────────────────────

export async function listUserBadges(userId) {
  return prisma.userBadge.findMany({
    where: { userId },
    select: {
      id: true,
      unlockedAt: true,
      progress: true,
      createdAt: true,
      badgeDefinition: { select: badgeDefinitionSelect },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllBadgeDefinitions() {
  return prisma.badgeDefinition.findMany({
    where: { isActive: true },
    select: badgeDefinitionSelect,
    orderBy: [{ rarity: "asc" }, { name: "asc" }],
  });
}

// ─── Leaderboards ────────────────────────────────────────────

export async function listLeaderboardSnapshots(type, { page, limit }) {
  const where = { leaderboardType: type };

  const [items, total] = await Promise.all([
    prisma.leaderboardSnapshot.findMany({
      where,
      select: {
        id: true,
        rank: true,
        score: true,
        breakdown: true,
        generatedAt: true,
        userId: true,
        teamId: true,
        user: { select: userMiniSelect },
        team: { select: { id: true, name: true } },
      },
      orderBy: { rank: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.leaderboardSnapshot.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Balance-derived leaderboard fallback when no snapshots exist.
 * For individual types → sort by UserXpBalance field.
 * For team types → sort by TeamXpBalance field.
 */
export async function deriveLeaderboardFromBalances(type, { page, limit }) {
  const isTeam = type.startsWith("TEAM_");

  if (isTeam) {
    const orderField = type === "TEAM_SEMESTER" ? "semesterTeamXp" : "weeklyTeamXp";
    const [items, total] = await Promise.all([
      prisma.teamXpBalance.findMany({
        orderBy: { [orderField]: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          teamId: true,
          lifetimeTeamXp: true,
          semesterTeamXp: true,
          weeklyTeamXp: true,
          team: { select: { id: true, name: true } },
        },
      }),
      prisma.teamXpBalance.count(),
    ]);

    return {
      items: items.map((row, i) => ({
        rank: (page - 1) * limit + i + 1,
        score: row[orderField],
        teamId: row.teamId,
        team: row.team,
        userId: null,
        user: null,
        breakdown: {
          lifetimeXp: row.lifetimeTeamXp,
          semesterXp: row.semesterTeamXp,
          weeklyXp: row.weeklyTeamXp,
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Individual leaderboard
  const orderField =
    type === "INDIVIDUAL_SEMESTER"
      ? "semesterXp"
      : type === "INDIVIDUAL_LIFETIME"
        ? "lifetimeXp"
        : "weeklyXp";

  const [items, total] = await Promise.all([
    prisma.userXpBalance.findMany({
      orderBy: { [orderField]: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        userId: true,
        lifetimeXp: true,
        semesterXp: true,
        weeklyXp: true,
        level: true,
        user: { select: userMiniSelect },
      },
    }),
    prisma.userXpBalance.count(),
  ]);

  return {
    items: items.map((row, i) => ({
      rank: (page - 1) * limit + i + 1,
      score: row[orderField],
      userId: row.userId,
      user: row.user,
      teamId: null,
      team: null,
      breakdown: {
        lifetimeXp: row.lifetimeXp,
        semesterXp: row.semesterXp,
        weeklyXp: row.weeklyXp,
        level: row.level,
      },
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── Rules ───────────────────────────────────────────────────

export async function listActiveRules({ eventType, activeOnly }) {
  const where = {
    ...(activeOnly !== false ? { isActive: true } : {}),
    ...(eventType ? { eventType } : {}),
  };

  return prisma.gamificationRule.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      eventType: true,
      targetType: true,
      baseXp: true,
      conditions: true,
      multipliers: true,
      caps: true,
      version: true,
      isActive: true,
    },
    orderBy: [{ eventType: "asc" }, { code: "asc" }],
  });
}

// ─── Admin: Suspicious Cases ─────────────────────────────────

export async function listSuspiciousCases({ page, limit, status, teamId, teamIds, userId }) {
  const normalizedTeamIds = Array.isArray(teamIds) ? teamIds.filter(Boolean) : [];
  const teamScope = teamId
    ? { teamId }
    : Array.isArray(teamIds)
      ? { teamId: { in: normalizedTeamIds } }
      : {};

  const where = {
    ...(status ? { status } : {}),
    ...teamScope,
    ...(userId ? { userId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.suspiciousActivityCase.findMany({
      where,
      select: {
        id: true,
        userId: true,
        teamId: true,
        eventId: true,
        transactionId: true,
        score: true,
        status: true,
        reason: true,
        signals: true,
        resolution: true,
        studentVisibleReason: true,
        assignedReviewerId: true,
        createdAt: true,
        resolvedAt: true,
        user: { select: userMiniSelect },
        team: { select: { id: true, name: true } },
        assignedReviewer: { select: userMiniSelect },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.suspiciousActivityCase.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Admin: Adjustment Requests ──────────────────────────────

export async function findSuspiciousCaseForResolution(caseId) {
  return prisma.suspiciousActivityCase.findUnique({
    where: { id: caseId },
    include: {
      transaction: true,
      team: {
        select: {
          id: true,
          name: true,
          doctorId: true,
          taId: true,
        },
      },
      user: { select: userMiniSelect },
    },
  });
}

export async function findTeamGamificationNotificationTarget(teamId) {
  return prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      leaderId: true,
    },
  });
}

export function resolveSuspiciousCaseTransaction({
  caseId,
  actorUserId,
  decision,
  resolution,
  studentVisibleReason,
}) {
  return prisma.$transaction(async (tx) => {
    const suspiciousCase = await tx.suspiciousActivityCase.findUnique({
      where: { id: caseId },
      include: { transaction: true },
    });

    if (!suspiciousCase || !suspiciousCase.transaction) {
      return {
        outcome: suspiciousCase ? "TRANSACTION_MISSING" : "NOT_FOUND",
        case: suspiciousCase ?? null,
      };
    }

    const transaction = suspiciousCase.transaction;
    if (transaction.status !== "FROZEN") {
      return { outcome: "NOT_FROZEN", case: suspiciousCase };
    }

    if (!RESOLVABLE_CASE_STATUSES.has(suspiciousCase.status)) {
      return { outcome: "ALREADY_RESOLVED", case: suspiciousCase };
    }

    const approved = decision === "APPROVE";
    const nextTransactionStatus = approved ? "AWARDED" : "REJECTED";
    const nextCaseStatus = approved ? "APPROVED" : "REJECTED";

    await tx.xpTransaction.update({
      where: { id: transaction.id },
      data: {
        status: nextTransactionStatus,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
      },
    });

    if (transaction.recipientType === "USER" && transaction.userId) {
      await resolveUserFrozenTransaction(tx, transaction.userId, transaction.amount, approved);
    } else if (transaction.recipientType === "TEAM" && transaction.teamId) {
      await resolveTeamFrozenTransaction(tx, transaction.teamId, transaction.amount, approved);
    }

    const resolvedCase = await tx.suspiciousActivityCase.update({
      where: { id: caseId },
      data: {
        status: nextCaseStatus,
        assignedReviewerId: actorUserId,
        resolution,
        studentVisibleReason: studentVisibleReason || resolution,
        resolvedAt: new Date(),
      },
      include: {
        transaction: true,
        user: { select: userMiniSelect },
        team: { select: { id: true, name: true } },
        assignedReviewer: { select: userMiniSelect },
      },
    });

    await tx.gamificationAuditLog.create({
      data: {
        actorUserId,
        action: "CASE_RESOLVED",
        targetType: "SuspiciousActivityCase",
        targetId: caseId,
        before: {
          caseStatus: suspiciousCase.status,
          transactionStatus: transaction.status,
          frozenAmount: transaction.amount,
        },
        after: {
          caseStatus: nextCaseStatus,
          transactionStatus: nextTransactionStatus,
          decision,
        },
        reason: resolution,
      },
    });

    return { outcome: "RESOLVED", case: resolvedCase };
  });
}

async function resolveUserFrozenTransaction(tx, userId, amount, approved) {
  const balance = await tx.userXpBalance.findUnique({
    where: { userId },
    select: {
      lifetimeXp: true,
      frozenXp: true,
    },
  });

  await tx.userXpBalance.upsert(
    buildUserFrozenResolutionBalanceData({ userId, balance, amount, approved }),
  );
}

export function buildUserFrozenResolutionBalanceData({ userId, balance, amount, approved }) {
  const currentLifetimeXp = balance?.lifetimeXp ?? 0;
  const nextFrozenXp = Math.max(0, (balance?.frozenXp ?? 0) - amount);
  const nextLifetimeXp = currentLifetimeXp + (approved ? amount : 0);

  const create = approved
    ? {
        userId,
        lifetimeXp: amount,
        semesterXp: amount,
        monthlyXp: amount,
        weeklyXp: amount,
        frozenXp: nextFrozenXp,
        level: computeLevel(nextLifetimeXp),
      }
    : {
        userId,
        frozenXp: nextFrozenXp,
      };

  const update = approved
    ? {
        lifetimeXp: { increment: amount },
        semesterXp: { increment: amount },
        monthlyXp: { increment: amount },
        weeklyXp: { increment: amount },
        frozenXp: nextFrozenXp,
        level: computeLevel(nextLifetimeXp),
      }
    : {
        frozenXp: nextFrozenXp,
      };

  return {
    where: { userId },
    create,
    update,
  };
}

async function resolveTeamFrozenTransaction(tx, teamId, amount, approved) {
  const balance = await tx.teamXpBalance.findUnique({
    where: { teamId },
    select: { frozenTeamXp: true },
  });

  await tx.teamXpBalance.upsert(
    buildTeamFrozenResolutionBalanceData({ teamId, balance, amount, approved }),
  );
}

export function buildTeamFrozenResolutionBalanceData({ teamId, balance, amount, approved }) {
  const nextFrozenTeamXp = Math.max(0, (balance?.frozenTeamXp ?? 0) - amount);

  const create = approved
    ? {
        teamId,
        lifetimeTeamXp: amount,
        semesterTeamXp: amount,
        monthlyTeamXp: amount,
        weeklyTeamXp: amount,
        frozenTeamXp: nextFrozenTeamXp,
      }
    : {
        teamId,
        frozenTeamXp: nextFrozenTeamXp,
      };

  const update = approved
    ? {
        lifetimeTeamXp: { increment: amount },
        semesterTeamXp: { increment: amount },
        monthlyTeamXp: { increment: amount },
        weeklyTeamXp: { increment: amount },
        frozenTeamXp: nextFrozenTeamXp,
      }
    : {
        frozenTeamXp: nextFrozenTeamXp,
      };

  return {
    where: { teamId },
    create,
    update,
  };
}

function computeLevel(lifetimeXp) {
  return Math.floor(Math.sqrt(Math.max(0, lifetimeXp) / 100)) + 1;
}

export async function listAdjustmentRequests({ page, limit, status }) {
  return listAdjustmentRequestsScoped({ page, limit, status });
}

export async function listAdjustmentRequestsScoped({ page, limit, status, teamIds, requestedByUserId }) {
  const normalizedTeamIds = Array.isArray(teamIds) ? teamIds.filter(Boolean) : [];
  const scopeOr = [];
  if (normalizedTeamIds.length > 0) {
    scopeOr.push(
      { targetTeamId: { in: normalizedTeamIds } },
      { targetUser: { ledTeam: { id: { in: normalizedTeamIds } } } },
      { targetUser: { teamMembership: { teamId: { in: normalizedTeamIds } } } },
    );
  }
  if (requestedByUserId) {
    scopeOr.push({ requestedByUserId });
  }

  const where = {
    ...(status ? { status } : {}),
    ...(Array.isArray(teamIds) || requestedByUserId ? { OR: scopeOr } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.xpAdjustmentRequest.findMany({
      where,
      select: adjustmentRequestSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.xpAdjustmentRequest.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Admin: Audit Logs ───────────────────────────────────────

export async function findUserAdjustmentTarget(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...userMiniSelect,
      ledTeam: { select: { id: true, name: true, doctorId: true, taId: true } },
      teamMembership: {
        select: {
          team: { select: { id: true, name: true, doctorId: true, taId: true } },
        },
      },
    },
  });
}

export async function findTeamAdjustmentTarget(teamId) {
  return prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      leaderId: true,
      doctorId: true,
      taId: true,
    },
  });
}

export async function createAdjustmentRequest({
  requestedByUserId,
  targetUserId,
  targetTeamId,
  amount,
  reason,
  sourceReference,
}) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.xpAdjustmentRequest.create({
      data: {
        requestedByUserId,
        targetUserId,
        targetTeamId,
        amount,
        reason,
        sourceReference,
      },
      select: adjustmentRequestSelect,
    });

    await tx.gamificationAuditLog.create({
      data: {
        actorUserId: requestedByUserId,
        action: "ADJUSTMENT_REQUESTED",
        targetType: "XpAdjustmentRequest",
        targetId: request.id,
        after: {
          targetUserId,
          targetTeamId,
          amount,
          sourceReference,
        },
        reason,
      },
    });

    return request;
  });
}

export async function findAdjustmentRequestForReview(adjustmentId) {
  return prisma.xpAdjustmentRequest.findUnique({
    where: { id: adjustmentId },
    include: {
      targetUser: {
        select: {
          ...userMiniSelect,
          ledTeam: { select: { id: true, name: true, doctorId: true, taId: true } },
          teamMembership: {
            select: {
              team: { select: { id: true, name: true, doctorId: true, taId: true } },
            },
          },
        },
      },
      targetTeam: {
        select: { id: true, name: true, leaderId: true, doctorId: true, taId: true },
      },
      requestedBy: { select: userMiniSelect },
      approvedBy: { select: userMiniSelect },
    },
  });
}

export function buildUserAdjustmentBalanceData({ userId, balance, amount }) {
  if (amount >= 0) {
    const nextLifetimeXp = (balance?.lifetimeXp ?? 0) + amount;
    return {
      where: { userId },
      create: {
        userId,
        lifetimeXp: amount,
        semesterXp: amount,
        monthlyXp: amount,
        weeklyXp: amount,
        level: computeLevel(nextLifetimeXp),
      },
      update: {
        lifetimeXp: { increment: amount },
        semesterXp: { increment: amount },
        monthlyXp: { increment: amount },
        weeklyXp: { increment: amount },
        level: computeLevel(nextLifetimeXp),
      },
    };
  }

  const deduction = Math.abs(amount);
  const nextLifetimeXp = Math.max(0, (balance?.lifetimeXp ?? 0) - deduction);
  return {
    where: { userId },
    create: { userId, level: 1 },
    update: {
      lifetimeXp: nextLifetimeXp,
      semesterXp: Math.max(0, (balance?.semesterXp ?? 0) - deduction),
      monthlyXp: Math.max(0, (balance?.monthlyXp ?? 0) - deduction),
      weeklyXp: Math.max(0, (balance?.weeklyXp ?? 0) - deduction),
      level: computeLevel(nextLifetimeXp),
    },
  };
}

export function buildTeamAdjustmentBalanceData({ teamId, balance, amount }) {
  if (amount >= 0) {
    return {
      where: { teamId },
      create: {
        teamId,
        lifetimeTeamXp: amount,
        semesterTeamXp: amount,
        monthlyTeamXp: amount,
        weeklyTeamXp: amount,
      },
      update: {
        lifetimeTeamXp: { increment: amount },
        semesterTeamXp: { increment: amount },
        monthlyTeamXp: { increment: amount },
        weeklyTeamXp: { increment: amount },
      },
    };
  }

  const deduction = Math.abs(amount);
  return {
    where: { teamId },
    create: { teamId },
    update: {
      lifetimeTeamXp: Math.max(0, (balance?.lifetimeTeamXp ?? 0) - deduction),
      semesterTeamXp: Math.max(0, (balance?.semesterTeamXp ?? 0) - deduction),
      monthlyTeamXp: Math.max(0, (balance?.monthlyTeamXp ?? 0) - deduction),
      weeklyTeamXp: Math.max(0, (balance?.weeklyTeamXp ?? 0) - deduction),
    },
  };
}

async function applyUserAdjustmentBalance(tx, userId, amount) {
  const balance = await tx.userXpBalance.findUnique({
    where: { userId },
    select: { lifetimeXp: true, semesterXp: true, monthlyXp: true, weeklyXp: true },
  });

  await tx.userXpBalance.upsert(buildUserAdjustmentBalanceData({ userId, balance, amount }));
}

async function applyTeamAdjustmentBalance(tx, teamId, amount) {
  const balance = await tx.teamXpBalance.findUnique({
    where: { teamId },
    select: {
      lifetimeTeamXp: true,
      semesterTeamXp: true,
      monthlyTeamXp: true,
      weeklyTeamXp: true,
    },
  });

  await tx.teamXpBalance.upsert(buildTeamAdjustmentBalanceData({ teamId, balance, amount }));
}

export function reviewAdjustmentRequestTransaction({
  adjustmentId,
  reviewerUserId,
  decision,
  reviewComment,
}) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.xpAdjustmentRequest.findUnique({
      where: { id: adjustmentId },
      include: {
        targetUser: { select: userMiniSelect },
        targetTeam: { select: { id: true, name: true, leaderId: true } },
        requestedBy: { select: userMiniSelect },
        approvedBy: { select: userMiniSelect },
      },
    });

    if (!request) return { outcome: "NOT_FOUND", request: null };
    if (request.status !== "PENDING") return { outcome: "ALREADY_REVIEWED", request };

    const approved = decision === "APPROVE";
    const reviewedAt = new Date();
    let event = null;
    let transaction = null;

    if (approved) {
      event = await tx.gamificationEvent.create({
        data: {
          eventType: "MANUAL_XP_ADJUSTMENT_APPROVED",
          sourceType: "XpAdjustmentRequest",
          sourceId: request.id,
          teamId: request.targetTeamId,
          actorUserId: reviewerUserId,
          payload: {
            adjustmentRequestId: request.id,
            requestedByUserId: request.requestedByUserId,
            targetUserId: request.targetUserId,
            targetTeamId: request.targetTeamId,
            amount: request.amount,
            reviewComment,
          },
          processedAt: reviewedAt,
          status: "PROCESSED",
          idempotencyKey: `MANUAL_XP_ADJUSTMENT_APPROVED:${request.id}`,
        },
      });

      const direction = request.amount >= 0 ? "CREDIT" : "DEBIT";
      const absoluteAmount = Math.abs(request.amount);
      transaction = await tx.xpTransaction.create({
        data: {
          idempotencyKey: `XP_ADJUSTMENT:${request.id}`,
          recipientType: request.targetTeamId ? "TEAM" : "USER",
          userId: request.targetUserId,
          teamId: request.targetTeamId,
          amount: absoluteAmount,
          direction,
          status: "AWARDED",
          reason: request.reason,
          eventId: event.id,
          sourceType: "XpAdjustmentRequest",
          sourceId: request.id,
          ruleCode: "MANUAL_XP_ADJUSTMENT",
          ruleVersion: 1,
          baseXp: absoluteAmount,
          createdByType: "USER",
          createdByUserId: request.requestedByUserId,
          reviewedByUserId: reviewerUserId,
          reviewedAt,
          metadata: {
            adjustmentRequestId: request.id,
            sourceReference: request.sourceReference,
            reviewComment,
            signedAmount: request.amount,
          },
        },
      });

      if (request.targetTeamId) {
        await applyTeamAdjustmentBalance(tx, request.targetTeamId, request.amount);
      } else if (request.targetUserId) {
        await applyUserAdjustmentBalance(tx, request.targetUserId, request.amount);
      }

      if (request.amount > 0) {
        if (request.targetTeamId) {
          await evaluateBadgesForTeam(tx, {
            teamId: request.targetTeamId,
            event,
            triggeringTransaction: transaction,
          });
        } else if (request.targetUserId) {
          await evaluateBadgesForUser(tx, {
            userId: request.targetUserId,
            event,
            triggeringTransaction: transaction,
          });
        }
      }
    }

    const nextStatus = approved ? "APPROVED" : "REJECTED";
    const updatedRequest = await tx.xpAdjustmentRequest.update({
      where: { id: request.id },
      data: {
        status: nextStatus,
        approvedByUserId: reviewerUserId,
        reviewedAt,
        reviewComment,
        ...(event ? { createdEventId: event.id } : {}),
        ...(transaction ? { createdTransactionId: transaction.id } : {}),
      },
      select: adjustmentRequestSelect,
    });

    await tx.gamificationAuditLog.create({
      data: {
        actorUserId: reviewerUserId,
        action: approved ? "ADJUSTMENT_APPROVED" : "ADJUSTMENT_REJECTED",
        targetType: "XpAdjustmentRequest",
        targetId: request.id,
        before: { status: request.status },
        after: {
          status: nextStatus,
          createdEventId: event?.id ?? null,
          createdTransactionId: transaction?.id ?? null,
          amount: request.amount,
        },
        reason: reviewComment,
      },
    });

    return { outcome: nextStatus, request: updatedRequest, transaction };
  });
}

export async function listAuditLogs({ page, limit, action, targetType, targetId }) {
  const where = {
    ...(action ? { action } : {}),
    ...(targetType ? { targetType } : {}),
    ...(targetId ? { targetId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.gamificationAuditLog.findMany({
      where,
      select: {
        id: true,
        actorUserId: true,
        action: true,
        targetType: true,
        targetId: true,
        before: true,
        after: true,
        reason: true,
        createdAt: true,
        actorUser: { select: userMiniSelect },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.gamificationAuditLog.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Team membership helpers (for permission checks) ─────────

export async function findTeamWithAccess(teamId) {
  return prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      leaderId: true,
      doctorId: true,
      taId: true,
      members: { select: { userId: true } },
    },
  });
}

export async function listStaffAssignedTeamIds(userId, role) {
  if (role === "TA") {
    const teams = await prisma.team.findMany({
      where: { taId: userId },
      select: { id: true },
    });
    return teams.map((team) => team.id);
  }

  if (role === "DOCTOR") {
    const teams = await prisma.team.findMany({
      where: { doctorId: userId },
      select: { id: true },
    });
    return teams.map((team) => team.id);
  }

  return [];
}
