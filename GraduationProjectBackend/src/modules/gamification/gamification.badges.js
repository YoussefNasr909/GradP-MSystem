import { notify } from "../../common/utils/notify.js";
import { computeLevel } from "./gamification.math.js";

const BADGE_REWARD_RULE_CODE = "BADGE_REWARD";

export async function evaluateBadgesForUser(tx, { userId, event, triggeringTransaction = null }) {
  if (!userId || !event) return [];

  const definitions = await tx.badgeDefinition.findMany({
    where: buildActiveBadgeWhere("USER"),
    orderBy: [{ level: "asc" }, { createdAt: "asc" }],
  });

  const unlocked = [];
  for (const definition of definitions) {
    const eligibility = await evaluateUserBadgeEligibility(tx, {
      userId,
      definition,
      event,
      triggeringTransaction,
    });

    if (!eligibility.eligible) continue;

    const unlock = await unlockUserBadge(tx, {
      userId,
      definition,
      event,
      progress: eligibility.progress,
      metadata: eligibility.metadata,
    });

    if (unlock) unlocked.push(unlock);
  }

  return unlocked;
}

export async function evaluateBadgesForTeam(tx, { teamId, event, triggeringTransaction = null }) {
  if (!teamId || !event) return [];

  const definitions = await tx.badgeDefinition.findMany({
    where: buildActiveBadgeWhere("TEAM"),
    orderBy: [{ level: "asc" }, { createdAt: "asc" }],
  });

  const unlocked = [];
  for (const definition of definitions) {
    const eligibility = await evaluateTeamBadgeEligibility(tx, {
      teamId,
      definition,
      event,
      triggeringTransaction,
    });

    if (!eligibility.eligible) continue;

    const unlock = await unlockTeamBadge(tx, {
      teamId,
      definition,
      event,
      progress: eligibility.progress,
      metadata: eligibility.metadata,
    });

    if (unlock) unlocked.push(unlock);
  }

  return unlocked;
}

export function buildBadgeUnlockedNotification({ badgeDefinition, userId, teamName = null }) {
  if (!badgeDefinition || !userId) return null;

  const isTeamBadge = badgeDefinition.targetType === "TEAM";
  const xpReward = Math.max(0, badgeDefinition.xpReward ?? 0);
  const rewardText = xpReward > 0 ? ` You also earned ${xpReward} bonus XP.` : "";

  return {
    userId,
    type: "BADGE_UNLOCKED",
    title: isTeamBadge ? "Team Badge Unlocked" : "Badge Unlocked",
    message: isTeamBadge
      ? `${teamName ?? "Your team"} unlocked ${badgeDefinition.name}.${rewardText}`
      : `You unlocked ${badgeDefinition.name}.${rewardText}`,
    actionUrl: "/dashboard/gamification",
  };
}

function buildActiveBadgeWhere(targetType) {
  const now = new Date();
  return {
    targetType,
    isActive: true,
    OR: [{ activeFrom: null }, { activeFrom: { lte: now } }],
    AND: [{ OR: [{ activeTo: null }, { activeTo: { gte: now } }] }],
  };
}

async function evaluateUserBadgeEligibility(tx, { userId, definition, event, triggeringTransaction }) {
  const criteria = normalizeCriteria(definition.criteria);
  if (!matchesEventCriteria(criteria, event)) {
    return { eligible: false, progress: 0, metadata: { criteria } };
  }

  if (criteria.gradeEquals !== undefined && Number(event.payload?.grade) !== Number(criteria.gradeEquals)) {
    return { eligible: false, progress: 0, metadata: { criteria } };
  }

  const lifetimeThreshold = toPositiveInteger(criteria.lifetimeXp ?? criteria.minLifetimeXp);
  if (lifetimeThreshold) {
    const balance = await tx.userXpBalance.findUnique({
      where: { userId },
      select: { lifetimeXp: true },
    });
    const lifetimeXp = balance?.lifetimeXp ?? triggeringTransaction?.amount ?? 0;
    return {
      eligible: lifetimeXp >= lifetimeThreshold,
      progress: Math.min(1, lifetimeXp / lifetimeThreshold),
      metadata: { criteria, lifetimeXp },
    };
  }

  const countThreshold = toPositiveInteger(criteria.count);
  if (countThreshold) {
    const count = await tx.xpTransaction.count({
      where: {
        recipientType: "USER",
        userId,
        direction: "CREDIT",
        status: "AWARDED",
        event: { is: { eventType: criteria.event } },
      },
    });

    return {
      eligible: count >= countThreshold,
      progress: Math.min(1, count / countThreshold),
      metadata: { criteria, count },
    };
  }

  return { eligible: true, progress: 1, metadata: { criteria } };
}

async function evaluateTeamBadgeEligibility(tx, { teamId, definition, event, triggeringTransaction }) {
  const criteria = normalizeCriteria(definition.criteria);
  if (!matchesEventCriteria(criteria, event)) {
    return { eligible: false, progress: 0, metadata: { criteria } };
  }

  const expectedStage = criteria.stage;
  if (expectedStage) {
    const actualStage = event.payload?.stage ?? event.payload?.newStage;
    if (actualStage !== expectedStage) {
      return { eligible: false, progress: 0, metadata: { criteria } };
    }
  }

  const lifetimeThreshold = toPositiveInteger(criteria.lifetimeTeamXp ?? criteria.minLifetimeTeamXp);
  if (lifetimeThreshold) {
    const balance = await tx.teamXpBalance.findUnique({
      where: { teamId },
      select: { lifetimeTeamXp: true },
    });
    const lifetimeTeamXp = balance?.lifetimeTeamXp ?? triggeringTransaction?.amount ?? 0;
    return {
      eligible: lifetimeTeamXp >= lifetimeThreshold,
      progress: Math.min(1, lifetimeTeamXp / lifetimeThreshold),
      metadata: { criteria, lifetimeTeamXp },
    };
  }

  const countThreshold = toPositiveInteger(criteria.count);
  if (countThreshold) {
    const count = await tx.xpTransaction.count({
      where: {
        recipientType: "TEAM",
        teamId,
        direction: "CREDIT",
        status: "AWARDED",
        event: { is: { eventType: criteria.event } },
      },
    });

    return {
      eligible: count >= countThreshold,
      progress: Math.min(1, count / countThreshold),
      metadata: { criteria, count },
    };
  }

  return { eligible: true, progress: 1, metadata: { criteria } };
}

function matchesEventCriteria(criteria, event) {
  if (criteria.event && criteria.event !== event.eventType) return false;
  return true;
}

async function unlockUserBadge(tx, { userId, definition, event, progress, metadata }) {
  const existing = await tx.userBadge.findUnique({
    where: { userId_badgeDefinitionId: { userId, badgeDefinitionId: definition.id } },
    select: { id: true },
  });
  if (existing) return null;

  const reward = await createBadgeRewardTransaction(tx, {
    definition,
    event,
    recipientType: "USER",
    userId,
    teamId: null,
  });

  const badge = await tx.userBadge.create({
    data: {
      userId,
      badgeDefinitionId: definition.id,
      unlockedAt: new Date(),
      progress,
      metadata,
      createdTransactionId: reward?.transaction?.id ?? null,
    },
  });

  await appendBadgeAuditLog(tx, {
    targetType: "UserBadge",
    targetId: badge.id,
    definition,
    userId,
    teamId: null,
    event,
    transaction: reward?.transaction ?? null,
  });

  await notifyBadgeUnlocked(tx, { definition, userId });
  return badge;
}

async function unlockTeamBadge(tx, { teamId, definition, event, progress, metadata }) {
  const existing = await tx.teamBadge.findUnique({
    where: { teamId_badgeDefinitionId: { teamId, badgeDefinitionId: definition.id } },
    select: { id: true },
  });
  if (existing) return null;

  const reward = await createBadgeRewardTransaction(tx, {
    definition,
    event,
    recipientType: "TEAM",
    userId: null,
    teamId,
  });

  const badge = await tx.teamBadge.create({
    data: {
      teamId,
      badgeDefinitionId: definition.id,
      unlockedAt: new Date(),
      progress,
      metadata,
      createdTransactionId: reward?.transaction?.id ?? null,
    },
  });

  await appendBadgeAuditLog(tx, {
    targetType: "TeamBadge",
    targetId: badge.id,
    definition,
    userId: null,
    teamId,
    event,
    transaction: reward?.transaction ?? null,
  });

  const team = await tx.team.findUnique({
    where: { id: teamId },
    select: { leaderId: true, name: true },
  });
  await notifyBadgeUnlocked(tx, { definition, userId: team?.leaderId, teamName: team?.name });
  return badge;
}

async function createBadgeRewardTransaction(tx, { definition, event, recipientType, userId, teamId }) {
  const amount = Math.max(0, definition.xpReward ?? 0);
  if (amount === 0) return null;

  const recipientId = userId ?? teamId;
  const eventIdempotencyKey = [
    "BADGE_UNLOCKED",
    "BadgeDefinition",
    definition.id,
    recipientType,
    recipientId,
  ].join(":");
  const transactionIdempotencyKey = [
    "BADGE_REWARD",
    definition.id,
    recipientType,
    recipientId,
  ].join(":");

  const existingTransaction = await tx.xpTransaction.findUnique({
    where: { idempotencyKey: transactionIdempotencyKey },
    select: { id: true },
  });
  if (existingTransaction) return { transaction: existingTransaction, duplicate: true };

  const badgeEvent = await tx.gamificationEvent.upsert({
    where: { idempotencyKey: eventIdempotencyKey },
    create: {
      eventType: "BADGE_UNLOCKED",
      sourceType: "BadgeDefinition",
      sourceId: definition.id,
      teamId,
      actorUserId: userId,
      payload: {
        badgeDefinitionId: definition.id,
        badgeCode: definition.code,
        triggeringEventId: event.id,
        recipientType,
        userId,
        teamId,
      },
      processedAt: new Date(),
      status: "PROCESSED",
      idempotencyKey: eventIdempotencyKey,
    },
    update: {
      status: "PROCESSED",
      processedAt: new Date(),
      lastError: null,
    },
  });

  const transaction = await tx.xpTransaction.create({
    data: {
      idempotencyKey: transactionIdempotencyKey,
      recipientType,
      userId,
      teamId,
      amount,
      direction: "CREDIT",
      status: "AWARDED",
      reason: `Badge unlocked: ${definition.name}`,
      eventId: badgeEvent.id,
      sourceType: "BadgeDefinition",
      sourceId: definition.id,
      ruleCode: BADGE_REWARD_RULE_CODE,
      ruleVersion: 1,
      baseXp: amount,
      createdByType: "SYSTEM",
      metadata: {
        badgeDefinitionId: definition.id,
        badgeCode: definition.code,
        triggeringEventId: event.id,
      },
    },
  });

  if (recipientType === "TEAM" && teamId) {
    await applyTeamBadgeRewardBalance(tx, teamId, amount);
  } else if (userId) {
    await applyUserBadgeRewardBalance(tx, userId, amount);
  }

  return { event: badgeEvent, transaction, duplicate: false };
}

async function applyUserBadgeRewardBalance(tx, userId, amount) {
  const balance = await tx.userXpBalance.findUnique({
    where: { userId },
    select: { lifetimeXp: true },
  });
  const nextLifetimeXp = (balance?.lifetimeXp ?? 0) + amount;

  await tx.userXpBalance.upsert({
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
  });
}

async function applyTeamBadgeRewardBalance(tx, teamId, amount) {
  await tx.teamXpBalance.upsert({
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
  });
}

async function appendBadgeAuditLog(tx, { targetType, targetId, definition, userId, teamId, event, transaction }) {
  await tx.gamificationAuditLog.create({
    data: {
      action: "EVENT_PROCESSED",
      targetType,
      targetId,
      after: {
        badgeDefinitionId: definition.id,
        badgeCode: definition.code,
        userId,
        teamId,
        triggeringEventId: event.id,
        rewardTransactionId: transaction?.id ?? null,
        xpReward: definition.xpReward ?? 0,
      },
      reason: `Unlocked badge ${definition.code}.`,
    },
  });
}

async function notifyBadgeUnlocked(tx, { definition, userId, teamName = null }) {
  const notification = buildBadgeUnlockedNotification({
    badgeDefinition: definition,
    userId,
    teamName,
  });

  if (notification) {
    await notify(notification, tx);
  }
}

function normalizeCriteria(criteria) {
  if (!criteria || typeof criteria !== "object" || Array.isArray(criteria)) return {};
  return criteria;
}

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}
