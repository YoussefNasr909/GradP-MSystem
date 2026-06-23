import { prisma } from "../../loaders/dbLoader.js";
import { env } from "../../config/env.js";
import { notify } from "../../common/utils/notify.js";
import { evaluateBadgesForTeam, evaluateBadgesForUser } from "./gamification.badges.js";
import { computeLevel } from "./gamification.math.js";
import { awardCoinsForXpTransaction } from "../economy/economy.repository.js";

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 3;
const PROCESSING_STALE_MS = 10 * 60 * 1000;

const TEAM_AWARD_EVENTS = new Set([
  "SUBMISSION_APPROVED",
  "WEEKLY_REPORT_APPROVED",
  "SPRINT_COMPLETED",
  "TEAM_STAGE_ADVANCED",
]);

const EVENT_QUEST_METRICS = {
  TASK_APPROVED: "TASKS_DONE",
  SUBMISSION_APPROVED: "SUBMISSIONS_APPROVED",
  WEEKLY_REPORT_APPROVED: "WEEKLY_REPORTS_APPROVED",
  GITHUB_PR_MERGED: "PRS_MERGED",
  GITHUB_PR_REVIEWED: "REVIEWS_GIVEN",
  SPRINT_COMPLETED: "SPRINTS_COMPLETED",
};

export async function processPendingEvents({ retryFailed = false, eventIds = [] } = {}) {
  if (!env.gamificationEnabled) {
    return {
      processed: 0,
      failed: 0,
      skipped: 0,
      retried: 0,
      disabled: true,
      reason: "Gamification is disabled. Set GAMIFICATION_ENABLED=true to enable it.",
    };
  }

  if (!env.gamificationWorkerEnabled) {
    return {
      processed: 0,
      failed: 0,
      skipped: 0,
      retried: 0,
      disabled: true,
      reason: "Gamification processing is disabled. Set GAMIFICATION_WORKER_ENABLED=true to award XP.",
    };
  }

  const eventIdWhere = eventIds.length > 0 ? { id: { in: eventIds } } : {};

  let retried = 0;
  if (retryFailed) {
    const retryResult = await prisma.gamificationEvent.updateMany({
      where: {
        status: "FAILED",
        ...eventIdWhere,
      },
      data: {
        status: "PENDING",
        attempts: 0,
        lastError: null,
        processedAt: null,
      },
    });
    retried = retryResult.count;
  }

  const staleProcessingBefore = new Date(Date.now() - PROCESSING_STALE_MS);
  const claimableEventWhere = {
    attempts: { lt: MAX_ATTEMPTS },
    OR: [
      { status: "PENDING" },
      {
        status: "PROCESSING",
        updatedAt: { lt: staleProcessingBefore },
      },
    ],
  };

  const events = await prisma.gamificationEvent.findMany({
    where: {
      ...claimableEventWhere,
      ...eventIdWhere,
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  if (events.length === 0) {
    return { processed: 0, failed: 0, skipped: 0, retried };
  }

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const event of events) {
    let claimed = false;

    try {
      const claimResult = await prisma.gamificationEvent.updateMany({
        where: {
          id: event.id,
          ...claimableEventWhere,
        },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
        },
      });

      if (claimResult.count === 0) {
        skipped++;
        continue;
      }
      claimed = true;

      if (event.eventType === "TASK_REOPENED") {
        await processTaskReopenedEvent(event);
        processed++;
        continue;
      }

      const result = await processFlatAwardForEvent(event);
      if (!result.awarded && !result.duplicate) {
        await prisma.gamificationEvent.update({
          where: { id: event.id },
          data: {
            status: "IGNORED",
            processedAt: new Date(),
            lastError: result.reason,
          },
        });
        skipped++;
        continue;
      }

      await prisma.gamificationEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
      });
      await appendAuditLog(prisma, {
        action: "EVENT_PROCESSED",
        targetType: "GamificationEvent",
        targetId: event.id,
        after: {
          status: "PROCESSED",
          eventType: event.eventType,
          flatXp: result.amount ?? 0,
          duplicate: Boolean(result.duplicate),
        },
        reason: `Processed ${event.eventType}.`,
      });

      processed++;
    } catch (err) {
      console.error(
        `[gamification] Failed to process event ${event.id} (${event.eventType}):`,
        err?.message,
      );

      if (claimed) {
        try {
          const nextAttempts = (event.attempts ?? 0) + 1;
          await prisma.gamificationEvent.update({
            where: { id: event.id },
            data: {
              status: nextAttempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
              lastError: String(err?.message ?? "Unknown error").slice(0, 500),
            },
          });
        } catch {
          // Ignore secondary failures while recording the error.
        }
      }

      failed++;
    }
  }

  return { processed, failed, skipped, retried };
}

export function getFlatXpForEvent(event) {
  const payload = event?.payload ?? {};

  switch (event?.eventType) {
    case "TASK_APPROVED": {
      const storyPoints = Number(payload.storyPoints ?? payload.actualPoints ?? 0);
      return storyPoints >= 1 ? storyPoints * 10 : 50;
    }
    case "SUBMISSION_APPROVED":
      return 100;
    case "WEEKLY_REPORT_APPROVED":
      return 50;
    case "GITHUB_PR_MERGED":
      return 20;
    case "GITHUB_PR_REVIEWED":
      return 10;
    case "SPRINT_COMPLETED":
      return 100;
    case "TEAM_STAGE_ADVANCED":
      return 150;
    default:
      return 0;
  }
}

export async function processFlatAwardForEvent(event) {
  const payload = event.payload ?? {};
  const amount = getFlatXpForEvent(event);
  if (amount <= 0) {
    return { awarded: false, duplicate: false, amount, reason: "No flat XP mapping found." };
  }

  const isTeamTarget = TEAM_AWARD_EVENTS.has(event.eventType);
  const recipientUserId = isTeamTarget ? null : resolveUserRecipient(event, payload);
  const recipientTeamId = isTeamTarget ? event.teamId ?? payload.teamId ?? null : null;

  if (!isTeamTarget && !recipientUserId) {
    return { awarded: false, duplicate: false, amount, reason: "No user recipient for flat XP award." };
  }
  if (isTeamTarget && !recipientTeamId) {
    return { awarded: false, duplicate: false, amount, reason: "No team recipient for flat XP award." };
  }

  const transactionIdempotencyKey = buildAwardTransactionKey({
    event,
    recipientUserId,
    recipientTeamId,
    recipientType: isTeamTarget ? "TEAM" : "USER",
  });

  return prisma.$transaction(async (tx) => {
    const existingTransaction = await tx.xpTransaction.findUnique({
      where: { idempotencyKey: transactionIdempotencyKey },
      select: { id: true },
    });

    if (existingTransaction) {
      return { awarded: false, duplicate: true, amount, transaction: existingTransaction };
    }

    const transaction = await tx.xpTransaction.create({
      data: {
        idempotencyKey: transactionIdempotencyKey,
        recipientType: isTeamTarget ? "TEAM" : "USER",
        userId: recipientUserId,
        teamId: recipientTeamId,
        amount,
        direction: "CREDIT",
        status: "AWARDED",
        reason: buildFlatAwardReason(event),
        eventId: event.id,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        ruleCode: null,
        ruleVersion: null,
        baseXp: amount,
        createdByType: "SYSTEM",
        metadata: { flatXp: true, eventPayload: payload },
      },
    });

    if (isTeamTarget) {
      await upsertTeamBalance(tx, recipientTeamId, amount);
    } else {
      await upsertUserBalance(tx, recipientUserId, amount);
      await awardCoinsForXpTransaction(tx, transaction);
    }

    const questRecipientUserIds = await resolveQuestRecipientUserIds(tx, {
      recipientType: isTeamTarget ? "TEAM" : "USER",
      userId: recipientUserId,
      teamId: recipientTeamId,
    });
    await incrementQuestProgressForUsers(tx, {
      userIds: questRecipientUserIds,
      metric: "XP_EARNED",
      incrementValue: amount,
    });

    const eventMetric = EVENT_QUEST_METRICS[event.eventType];
    if (eventMetric) {
      await incrementQuestProgressForUsers(tx, {
        userIds: questRecipientUserIds,
        metric: eventMetric,
        incrementValue: 1,
      });
    }

    await appendAuditLog(tx, {
      action: "TRANSACTION_CREATED",
      targetType: "XpTransaction",
      targetId: transaction.id,
      after: {
        idempotencyKey: transactionIdempotencyKey,
        recipientType: isTeamTarget ? "TEAM" : "USER",
        userId: recipientUserId,
        teamId: recipientTeamId,
        amount,
        flatXp: true,
      },
      reason: `Processed ${event.eventType} event ${event.id}.`,
    });
    await notifyXpTransaction(tx, { transaction, kind: "AWARDED" });

    if (isTeamTarget) {
      await evaluateBadgesForTeam(tx, {
        teamId: recipientTeamId,
        event,
        triggeringTransaction: transaction,
      });
    } else {
      await evaluateBadgesForUser(tx, {
        userId: recipientUserId,
        event,
        triggeringTransaction: transaction,
      });
    }

    return { awarded: true, duplicate: false, amount, transaction };
  });
}

function resolveUserRecipient(event, payload) {
  if (event.eventType === "GITHUB_PR_REVIEWED") {
    return payload.reviewerUserId ?? event.actorUserId ?? null;
  }

  return (
    payload.assigneeUserId ??
    payload.submittedByUserId ??
    payload.userId ??
    payload.authorUserId ??
    event.actorUserId ??
    null
  );
}

function buildFlatAwardReason(event) {
  return `Flat XP award - ${event.eventType}`;
}

export async function processTaskReopenedEvent(event) {
  const payload = event.payload ?? {};
  const taskId = event.sourceId;

  const priorApprovedEvent = await prisma.gamificationEvent.findFirst({
    where: {
      eventType: "TASK_APPROVED",
      sourceType: "Task",
      sourceId: taskId,
      status: "PROCESSED",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!priorApprovedEvent) {
    await prisma.gamificationEvent.update({
      where: { id: event.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        lastError: "No prior TASK_APPROVED event found to reverse.",
      },
    });
    return;
  }

  const priorTransactions = await prisma.xpTransaction.findMany({
    where: {
      eventId: priorApprovedEvent.id,
      status: "AWARDED",
    },
  });

  if (priorTransactions.length === 0) {
    await prisma.gamificationEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const originalTransaction of priorTransactions) {
      const reversalIdempotencyKey = buildReversalTransactionKey(event, originalTransaction);
      const existingReversal = await tx.xpTransaction.findUnique({
        where: { idempotencyKey: reversalIdempotencyKey },
        select: { id: true },
      });

      if (existingReversal) {
        continue;
      }

      await tx.xpTransaction.update({
        where: { id: originalTransaction.id },
        data: { status: "REVERSED" },
      });

      const reversalTransaction = await tx.xpTransaction.create({
        data: {
          idempotencyKey: reversalIdempotencyKey,
          recipientType: originalTransaction.recipientType,
          userId: originalTransaction.userId,
          teamId: originalTransaction.teamId,
          amount: originalTransaction.amount,
          direction: "DEBIT",
          status: "AWARDED",
          reason: `Reversal: task reopened - ${originalTransaction.reason}`,
          eventId: event.id,
          sourceType: event.sourceType,
          sourceId: event.sourceId,
          ruleCode: originalTransaction.ruleCode,
          ruleVersion: originalTransaction.ruleVersion,
          baseXp: originalTransaction.baseXp,
          reversalOfTransactionId: originalTransaction.id,
          createdByType: "SYSTEM",
          metadata: {
            reversalOf: originalTransaction.id,
            originalAmount: originalTransaction.amount,
            taskReopenedBy: payload.assigneeUserId ?? event.actorUserId,
          },
        },
      });

      if (originalTransaction.recipientType === "TEAM" && originalTransaction.teamId) {
        await deductTeamBalance(tx, originalTransaction.teamId, originalTransaction.amount);
      } else if (originalTransaction.userId) {
        await deductUserBalance(tx, originalTransaction.userId, originalTransaction.amount);
      }

      await appendAuditLog(tx, {
        action: "TRANSACTION_REVERSED",
        targetType: "XpTransaction",
        targetId: originalTransaction.id,
        before: {
          status: originalTransaction.status,
          amount: originalTransaction.amount,
        },
        after: {
          status: "REVERSED",
          reversalTransactionId: reversalTransaction.id,
          reversalIdempotencyKey,
        },
        reason: `Task reopened by ${payload.assigneeUserId ?? event.actorUserId ?? "system"}.`,
      });
      await notifyXpTransaction(tx, { transaction: originalTransaction, kind: "REVERSED" });
    }
  });

  await prisma.gamificationEvent.update({
    where: { id: event.id },
    data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
  });
  await appendAuditLog(prisma, {
    action: "EVENT_PROCESSED",
    targetType: "GamificationEvent",
    targetId: event.id,
    after: { status: "PROCESSED", eventType: event.eventType },
    reason: "Processed task reopen reversal event.",
  });
}

function buildAwardTransactionKey({ event, recipientUserId, recipientTeamId, recipientType }) {
  const recipientId = recipientUserId ?? recipientTeamId;
  return ["XP_AWARD", event.id, event.eventType, recipientType, recipientId].join(":");
}

function buildReversalTransactionKey(event, originalTransaction) {
  return ["XP_REVERSAL", event.id, originalTransaction.id].join(":");
}

function appendAuditLog(tx, { action, targetType, targetId, before = null, after = null, reason = null }) {
  return tx.gamificationAuditLog.create({
    data: {
      action,
      targetType,
      targetId,
      before,
      after,
      reason,
    },
  });
}

export function buildXpTransactionNotification({ transaction, kind, teamName = null, userId }) {
  if (!transaction || !userId) return null;

  const amount = transaction.amount ?? 0;
  const isTeam = transaction.recipientType === "TEAM";
  const teamLabel = teamName ?? "your team";

  if (kind === "REVERSED") {
    return {
      userId,
      type: "XP_REVERSED",
      title: isTeam ? "Team XP Reversed" : "XP Reversed",
      message: isTeam
        ? `${amount} team XP for ${teamLabel} was reversed because the source activity changed.`
        : `${amount} XP was reversed because the source activity changed.`,
      actionUrl: "/dashboard/gamification",
    };
  }

  return {
    userId,
    type: "XP_AWARDED",
    title: isTeam ? "Team XP Awarded" : "XP Awarded",
    message: isTeam
      ? `${amount} team XP was awarded to ${teamLabel}.`
      : `${amount} XP was added to your gamification balance.`,
    actionUrl: "/dashboard/gamification",
  };
}

async function resolveNotificationTarget(tx, transaction) {
  if (transaction.recipientType === "USER" && transaction.userId) {
    return { userId: transaction.userId, teamName: null };
  }

  if (transaction.recipientType !== "TEAM" || !transaction.teamId) {
    return null;
  }

  const team = await tx.team.findUnique({
    where: { id: transaction.teamId },
    select: { leaderId: true, name: true },
  });

  if (!team?.leaderId) return null;
  return { userId: team.leaderId, teamName: team.name };
}

async function notifyXpTransaction(tx, { transaction, kind }) {
  const target = await resolveNotificationTarget(tx, transaction);
  const notification = buildXpTransactionNotification({
    transaction,
    kind,
    userId: target?.userId,
    teamName: target?.teamName,
  });

  if (notification) {
    await notify(notification, tx);
  }
}

async function resolveQuestRecipientUserIds(tx, { recipientType, userId, teamId }) {
  if (recipientType === "USER") {
    return userId ? [userId] : [];
  }

  if (!teamId) return [];

  const team = await tx.team.findUnique({
    where: { id: teamId },
    select: {
      leaderId: true,
      members: { select: { userId: true } },
    },
  });

  const ids = [team?.leaderId, ...(team?.members ?? []).map((member) => member.userId)].filter(Boolean);
  return [...new Set(ids)];
}

async function incrementQuestProgressForUsers(tx, { userIds, metric, incrementValue }) {
  for (const userId of userIds) {
    await incrementQuestProgress(tx, { userId, metric, incrementValue });
  }
}

async function incrementQuestProgress(tx, { userId, metric, incrementValue = 1 }) {
  if (!userId || !metric || incrementValue <= 0) return;

  const now = new Date();
  const activeQuests = await tx.quest.findMany({
    where: {
      isActive: true,
      metric,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
  });

  for (const quest of activeQuests) {
    const windowKey = getQuestWindowKey(quest, now);
    const progress = await tx.userQuestProgress.upsert({
      where: { questId_userId_windowKey: { questId: quest.id, userId, windowKey } },
      create: {
        questId: quest.id,
        userId,
        windowKey,
        currentValue: incrementValue,
        completedAt: null,
      },
      update: {
        currentValue: { increment: incrementValue },
      },
    });

    if (progress.currentValue >= quest.targetValue && !progress.completedAt) {
      await tx.userQuestProgress.update({
        where: { id: progress.id },
        data: { completedAt: now },
      });
      await notify(
        {
          userId,
          type: "SYSTEM",
          title: "Quest ready to claim",
          message: `${quest.title} is complete. Claim ${quest.coinReward} coins in the Gamification Hub.`,
          actionUrl: "/dashboard/gamification?tab=quests",
        },
        tx,
      );
    }
  }
}

function getQuestWindowKey(quest, now = new Date()) {
  if (quest.type === "DAILY") {
    return `daily:${getUtcDateKey(now)}`;
  }

  if (quest.type === "WEEKLY") {
    const day = now.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
    return `weekly:${getUtcDateKey(start)}`;
  }

  return "lifetime";
}

function getUtcDateKey(date) {
  const pad2 = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

async function upsertUserBalance(tx, userId, amount) {
  await tx.userXpBalance.upsert({
    where: { userId },
    create: {
      userId,
      lifetimeXp: amount,
      semesterXp: amount,
      monthlyXp: amount,
      weeklyXp: amount,
      level: computeLevel(amount),
    },
    update: {
      lifetimeXp: { increment: amount },
      semesterXp: { increment: amount },
      monthlyXp: { increment: amount },
      weeklyXp: { increment: amount },
    },
  });

  const balance = await tx.userXpBalance.findUnique({
    where: { userId },
    select: { lifetimeXp: true },
  });

  if (balance) {
    await tx.userXpBalance.update({
      where: { userId },
      data: { level: computeLevel(balance.lifetimeXp) },
    });
  }
}

async function deductUserBalance(tx, userId, amount) {
  const balance = await tx.userXpBalance.findUnique({
    where: { userId },
    select: { lifetimeXp: true, semesterXp: true, monthlyXp: true, weeklyXp: true },
  });

  if (!balance) return;

  await tx.userXpBalance.update({
    where: { userId },
    data: {
      lifetimeXp: Math.max(0, balance.lifetimeXp - amount),
      semesterXp: Math.max(0, balance.semesterXp - amount),
      monthlyXp: Math.max(0, balance.monthlyXp - amount),
      weeklyXp: Math.max(0, balance.weeklyXp - amount),
      level: computeLevel(Math.max(0, balance.lifetimeXp - amount)),
    },
  });
}

async function upsertTeamBalance(tx, teamId, amount) {
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

async function deductTeamBalance(tx, teamId, amount) {
  const balance = await tx.teamXpBalance.findUnique({
    where: { teamId },
    select: {
      lifetimeTeamXp: true,
      semesterTeamXp: true,
      monthlyTeamXp: true,
      weeklyTeamXp: true,
    },
  });

  if (!balance) return;

  await tx.teamXpBalance.update({
    where: { teamId },
    data: {
      lifetimeTeamXp: Math.max(0, balance.lifetimeTeamXp - amount),
      semesterTeamXp: Math.max(0, balance.semesterTeamXp - amount),
      monthlyTeamXp: Math.max(0, balance.monthlyTeamXp - amount),
      weeklyTeamXp: Math.max(0, balance.weeklyTeamXp - amount),
    },
  });
}
