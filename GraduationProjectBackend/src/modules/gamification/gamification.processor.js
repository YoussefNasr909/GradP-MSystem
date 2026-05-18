import { Prisma } from "@prisma/client";
import { prisma } from "../../loaders/dbLoader.js";
import { env } from "../../config/env.js";
import { notify } from "../../common/utils/notify.js";
import { matchRules, calculateXp } from "./gamification.rules-engine.js";
import { evaluateBadgesForTeam, evaluateBadgesForUser } from "./gamification.badges.js";
import { computeLevel } from "./gamification.math.js";
import { awardCoinsForXpTransaction } from "../economy/economy.repository.js";

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 3;
const PROCESSING_STALE_MS = 10 * 60 * 1000;

export async function processPendingEvents() {
  if (!env.gamificationEnabled) {
    return {
      processed: 0,
      failed: 0,
      skipped: 0,
      disabled: true,
      reason: "Gamification is disabled. Set GAMIFICATION_ENABLED=true to enable it.",
    };
  }

  if (!env.gamificationWorkerEnabled) {
    return {
      processed: 0,
      failed: 0,
      skipped: 0,
      disabled: true,
      reason: "Gamification processing is disabled. Set GAMIFICATION_WORKER_ENABLED=true to award XP.",
    };
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
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  if (events.length === 0) {
    return { processed: 0, failed: 0, skipped: 0 };
  }

  const activeRules = await prisma.gamificationRule.findMany({
    where: { isActive: true },
  });

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

      const matchedRules = matchRules(activeRules, event);
      if (matchedRules.length === 0) {
        await prisma.gamificationEvent.update({
          where: { id: event.id },
          data: {
            status: "IGNORED",
            processedAt: new Date(),
            lastError: "No matching active rules found.",
          },
        });
        skipped++;
        continue;
      }

      for (const rule of matchedRules) {
        await processRuleForEvent(event, rule);
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
          matchedRuleCodes: matchedRules.map((rule) => rule.code),
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

  return { processed, failed, skipped };
}

export async function processRuleForEvent(event, rule) {
  const payload = event.payload ?? {};
  const { amount, breakdown } = calculateXp(rule, payload);

  if (amount === 0) return;
  if (
    event.eventType === "TASK_APPROVED" &&
    payload.storyPoints !== undefined &&
    Number(payload.storyPoints) < 1
  ) {
    console.warn(
      `[gamification] Skipping task XP for event ${event.id}: storyPoints must be at least 1.`,
    );
    return;
  }
  if (
    event.eventType === "TASK_APPROVED" &&
    payload.assigneeUserId &&
    event.actorUserId &&
    payload.assigneeUserId === event.actorUserId
  ) {
    console.warn(
      `[gamification] Skipping task XP for event ${event.id}: self-approved tasks are not XP eligible.`,
    );
    return;
  }

  const isTeamTarget = rule.targetType === "TEAM";
  const recipientUserId = isTeamTarget
    ? null
    : payload.assigneeUserId ?? payload.submittedByUserId ?? event.actorUserId;
  const recipientTeamId = isTeamTarget ? event.teamId : null;

  if (!isTeamTarget && !recipientUserId) {
    console.warn(
      `[gamification] Skipping rule ${rule.code}: no user recipient for event ${event.id}`,
    );
    return;
  }
  if (isTeamTarget && !recipientTeamId) {
    console.warn(
      `[gamification] Skipping rule ${rule.code}: no team recipient for event ${event.id}`,
    );
    return;
  }

  const suspicion = await evaluateAwardSuspicion(event);
  const transactionIdempotencyKey = buildAwardTransactionKey({
    event,
    rule,
    recipientUserId,
    recipientTeamId,
  });

  const MAX_SERIALIZATION_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_SERIALIZATION_RETRIES) {
    try {
      await prisma.$transaction(async (tx) => {
        const existingTransaction = await tx.xpTransaction.findUnique({
          where: { idempotencyKey: transactionIdempotencyKey },
          select: { id: true },
        });

        if (existingTransaction) {
          return;
        }

        const capped = await isAwardBlockedByCaps({
          client: tx,
          event,
          rule,
          recipientUserId,
          recipientTeamId,
          amount,
        });
        if (capped) return;

        const transaction = await tx.xpTransaction.create({
          data: {
            idempotencyKey: transactionIdempotencyKey,
            recipientType: rule.targetType,
            userId: recipientUserId,
            teamId: recipientTeamId,
            amount,
            direction: "CREDIT",
            status: suspicion ? "FROZEN" : "AWARDED",
            reason: `${rule.name} - ${event.eventType}`,
            eventId: event.id,
            sourceType: event.sourceType,
            sourceId: event.sourceId,
            ruleCode: rule.code,
            ruleVersion: rule.version,
            baseXp: rule.baseXp,
            qualityMultiplier: breakdown.qualityMultiplier ?? null,
            timelinessMultiplier: breakdown.timelinessMultiplier ?? null,
            evidenceMultiplier: breakdown.evidenceMultiplier ?? null,
            difficultyMultiplier: breakdown.difficultyMultiplier ?? null,
            createdByType: "SYSTEM",
            metadata: { breakdown, eventPayload: payload },
          },
        });

        if (suspicion) {
          if (isTeamTarget) {
            await upsertTeamFrozenBalance(tx, recipientTeamId, amount);
          } else {
            await upsertUserFrozenBalance(tx, recipientUserId, amount);
          }

          await tx.suspiciousActivityCase.create({
            data: {
              userId: recipientUserId,
              teamId: event.teamId ?? recipientTeamId,
              eventId: event.id,
              transactionId: transaction.id,
              score: suspicion.score,
              reason: suspicion.reason,
              signals: suspicion.signals,
              studentVisibleReason:
                suspicion.studentVisibleReason ??
                "This XP is pending staff review before it can be added to your balance.",
            },
          });

          await appendAuditLog(tx, {
            action: "TRANSACTION_FROZEN",
            targetType: "XpTransaction",
            targetId: transaction.id,
            after: {
              idempotencyKey: transactionIdempotencyKey,
              recipientType: rule.targetType,
              userId: recipientUserId,
              teamId: recipientTeamId,
              amount,
              reason: suspicion.reason,
              signals: suspicion.signals,
            },
            reason: `Frozen while processing ${event.eventType} event ${event.id}.`,
          });
          await notifyXpTransaction(tx, { transaction, kind: "FROZEN" });
          return;
        }

        if (isTeamTarget) {
          await upsertTeamBalance(tx, recipientTeamId, amount);
        } else {
          await upsertUserBalance(tx, recipientUserId, amount);
          await awardCoinsForXpTransaction(tx, transaction);
        }

        await appendAuditLog(tx, {
          action: "TRANSACTION_CREATED",
          targetType: "XpTransaction",
          targetId: transaction.id,
          after: {
            idempotencyKey: transactionIdempotencyKey,
            recipientType: rule.targetType,
            userId: recipientUserId,
            teamId: recipientTeamId,
            amount,
            ruleCode: rule.code,
            ruleVersion: rule.version,
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
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      break; // Success, exit retry loop
    } catch (error) {
      if (error.code === "P2034") {
        attempt++;
        if (attempt >= MAX_SERIALIZATION_RETRIES) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
      } else {
        throw error;
      }
    }
  }
}

async function evaluateAwardSuspicion(event) {
  return (await evaluateSubmissionDuplicateSuspicion(event)) ?? evaluateTaskApprovalSuspicion(event);
}

async function evaluateSubmissionDuplicateSuspicion(event) {
  if (event.eventType !== "SUBMISSION_APPROVED" || event.sourceType !== "Submission") {
    return null;
  }

  const submission = await prisma.submission.findUnique({
    where: { id: event.sourceId },
    select: {
      id: true,
      teamId: true,
      deliverableType: true,
      version: true,
      fileHash: true,
      normalizedTextHash: true,
      contentFingerprint: true,
    },
  });

  if (!submission?.fileHash && !submission?.normalizedTextHash && !submission?.contentFingerprint) {
    return null;
  }

  const duplicate = await prisma.submission.findFirst({
    where: {
      id: { not: submission.id },
      status: "APPROVED",
      OR: [
        ...(submission.fileHash ? [{ fileHash: submission.fileHash }] : []),
        ...(submission.normalizedTextHash
          ? [{ normalizedTextHash: submission.normalizedTextHash }]
          : []),
        ...(submission.contentFingerprint
          ? [{ contentFingerprint: submission.contentFingerprint }]
          : []),
      ],
    },
    select: {
      id: true,
      teamId: true,
      deliverableType: true,
      version: true,
      fileHash: true,
      normalizedTextHash: true,
      contentFingerprint: true,
    },
    orderBy: { reviewedAt: "desc" },
  });

  if (!duplicate) return null;

  return {
    score: 85,
    reason: "Duplicate submission content detected.",
    studentVisibleReason: "This XP is pending staff review because a similar submission was detected.",
    signals: {
      type: "DUPLICATE_SUBMISSION_HASH",
      submissionId: submission.id,
      matchedSubmissionId: duplicate.id,
      matchedTeamId: duplicate.teamId,
      sameTeam: duplicate.teamId === submission.teamId,
      sameDeliverableType: duplicate.deliverableType === submission.deliverableType,
      fileHashMatched: Boolean(submission.fileHash && submission.fileHash === duplicate.fileHash),
      normalizedTextHashMatched: Boolean(
        submission.normalizedTextHash &&
          submission.normalizedTextHash === duplicate.normalizedTextHash
      ),
      contentFingerprintMatched: Boolean(
        submission.contentFingerprint &&
          submission.contentFingerprint === duplicate.contentFingerprint
      ),
    },
  };
}

function evaluateTaskApprovalSuspicion(event) {
  if (event.eventType !== "TASK_APPROVED" || event.sourceType !== "Task") {
    return null;
  }

  const payload = event.payload ?? {};
  const createdAt = parseEventDate(payload.createdAt);
  const acceptedAt = parseEventDate(payload.acceptedAt);
  const submittedAt = parseEventDate(payload.submittedForReviewAt);
  const reviewedAt = parseEventDate(payload.reviewedAt);
  if (!reviewedAt) return null;

  const signals = [];
  if (createdAt && minutesBetween(createdAt, reviewedAt) < 10) {
    signals.push({
      type: "RAPID_CREATE_TO_APPROVAL",
      minutes: minutesBetween(createdAt, reviewedAt),
      thresholdMinutes: 10,
    });
  }
  if (acceptedAt && submittedAt && minutesBetween(acceptedAt, submittedAt) < 5) {
    signals.push({
      type: "RAPID_ACCEPT_TO_SUBMISSION",
      minutes: minutesBetween(acceptedAt, submittedAt),
      thresholdMinutes: 5,
    });
  }

  if (signals.length === 0) return null;

  return {
    score: signals.some((signal) => signal.type === "RAPID_CREATE_TO_APPROVAL") ? 65 : 45,
    reason: "Task was approved unusually quickly.",
    studentVisibleReason: "This task XP is pending staff review because the task moved through review unusually quickly.",
    signals: {
      type: "RAPID_TASK_APPROVAL",
      taskId: event.sourceId,
      createdAt: payload.createdAt ?? null,
      acceptedAt: payload.acceptedAt ?? null,
      submittedForReviewAt: payload.submittedForReviewAt ?? null,
      reviewedAt: payload.reviewedAt ?? null,
      checks: signals,
    },
  };
}

function parseEventDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minutesBetween(start, end) {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
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

function buildAwardTransactionKey({ event, rule, recipientUserId, recipientTeamId }) {
  const recipientId = recipientUserId ?? recipientTeamId;
  return [
    "XP_AWARD",
    event.id,
    rule.code,
    `v${rule.version}`,
    rule.targetType,
    recipientId,
  ].join(":");
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

  if (kind === "FROZEN") {
    return {
      userId,
      type: "XP_FROZEN",
      title: isTeam ? "Team XP Pending Review" : "XP Pending Review",
      message: isTeam
        ? `${amount} team XP for ${teamLabel} is pending staff review.`
        : `${amount} XP is pending staff review.`,
      actionUrl: "/dashboard/gamification",
    };
  }

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

function getAwardFilter({ rule, recipientUserId, recipientTeamId }) {
  return {
    recipientType: rule.targetType,
    userId: recipientUserId,
    teamId: recipientTeamId,
    direction: "CREDIT",
    status: "AWARDED",
    ruleCode: rule.code,
    ruleVersion: rule.version,
  };
}

function getRecipientAwardFilter({ rule, recipientUserId, recipientTeamId }) {
  return {
    recipientType: rule.targetType,
    userId: recipientUserId,
    teamId: recipientTeamId,
    direction: "CREDIT",
    status: "AWARDED",
  };
}

function toPositiveCap(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

async function isAwardBlockedByCaps({ client = prisma, event, rule, recipientUserId, recipientTeamId, amount }) {
  const caps = rule.caps;
  if (!caps || typeof caps !== "object") return false;

  const baseFilter = getAwardFilter({ rule, recipientUserId, recipientTeamId });
  const recipientAwardFilter = getRecipientAwardFilter({ rule, recipientUserId, recipientTeamId });

  const maxPerTask = toPositiveCap(caps.maxPerTask);
  if (maxPerTask) {
    const count = await client.xpTransaction.count({
      where: {
        ...baseFilter,
        sourceType: "Task",
        sourceId: event.sourceId,
      },
    });
    if (count >= maxPerTask) return true;
  }

  const maxPerSubmissionVersion = toPositiveCap(caps.maxPerSubmissionVersion);
  if (maxPerSubmissionVersion) {
    const count = await client.xpTransaction.count({
      where: {
        ...baseFilter,
        sourceType: "Submission",
        sourceId: event.sourceId,
      },
    });
    if (count >= maxPerSubmissionVersion) return true;
  }

  const maxPerRelease = toPositiveCap(caps.maxPerRelease);
  if (maxPerRelease) {
    const count = await client.xpTransaction.count({
      where: {
        ...baseFilter,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
      },
    });
    if (count >= maxPerRelease) return true;
  }

  const maxPerSprint = toPositiveCap(caps.maxPerSprint);
  if (maxPerSprint) {
    const count = await client.xpTransaction.count({
      where: {
        ...baseFilter,
        sourceType: "Sprint",
        sourceId: event.sourceId,
      },
    });
    if (count >= maxPerSprint) return true;
  }

  const maxPerWeeklyReport = toPositiveCap(caps.maxPerWeeklyReport);
  if (maxPerWeeklyReport) {
    const count = await client.xpTransaction.count({
      where: {
        ...baseFilter,
        sourceType: "WeeklyReport",
        sourceId: event.sourceId,
      },
    });
    if (count >= maxPerWeeklyReport) return true;
  }

  const maxPerBadgePerRecipient = toPositiveCap(caps.maxPerBadgePerRecipient);
  if (maxPerBadgePerRecipient) {
    const count = await client.xpTransaction.count({
      where: {
        ...baseFilter,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
      },
    });
    if (count >= maxPerBadgePerRecipient) return true;
  }

  const maxPerStageTransition = toPositiveCap(caps.maxPerStageTransition);
  if (maxPerStageTransition) {
    const transitionKey =
      event.payload?.transitionKey ??
      (event.payload?.previousStage && event.payload?.newStage
        ? `${event.payload.previousStage}->${event.payload.newStage}`
        : null);

    if (transitionKey) {
      const count = await client.xpTransaction.count({
        where: {
          ...baseFilter,
          sourceType: "Team",
          sourceId: event.sourceId,
          metadata: {
            path: ["eventPayload", "transitionKey"],
            equals: transitionKey,
          },
        },
      });
      if (count >= maxPerStageTransition) return true;
    }
  }

  const maxPerUserPerDay = toPositiveCap(caps.maxPerUserPerDay);
  if (maxPerUserPerDay && recipientUserId) {
    const since = new Date();
    since.setDate(since.getDate() - 1);
    const count = await client.xpTransaction.count({
      where: {
        ...baseFilter,
        createdAt: { gte: since },
      },
    });
    if (count >= maxPerUserPerDay) return true;
  }

  const maxXpPerUserPerDay = toPositiveCap(caps.maxXpPerUserPerDay);
  if (maxXpPerUserPerDay && recipientUserId) {
    const since = new Date();
    since.setDate(since.getDate() - 1);
    const aggregate = await client.xpTransaction.aggregate({
      where: {
        ...recipientAwardFilter,
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });
    const awardedSoFar = aggregate._sum.amount ?? 0;
    if (awardedSoFar + amount > maxXpPerUserPerDay) return true;
  }

  const maxPerUserPerWeek = toPositiveCap(caps.maxPerUserPerWeek);
  if (maxPerUserPerWeek && recipientUserId) {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const count = await client.xpTransaction.count({
      where: {
        ...baseFilter,
        createdAt: { gte: since },
      },
    });
    if (count >= maxPerUserPerWeek) return true;
  }

  const maxXpPerUserPerWeek = toPositiveCap(caps.maxXpPerUserPerWeek);
  if (maxXpPerUserPerWeek && recipientUserId) {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const aggregate = await client.xpTransaction.aggregate({
      where: {
        ...recipientAwardFilter,
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });
    const awardedSoFar = aggregate._sum.amount ?? 0;
    if (awardedSoFar + amount > maxXpPerUserPerWeek) return true;
  }

  const maxXpPerPr = toPositiveCap(caps.maxXpPerPR);
  if (maxXpPerPr) {
    const aggregate = await client.xpTransaction.aggregate({
      where: {
        ...baseFilter,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
      },
      _sum: { amount: true },
    });
    const awardedSoFar = aggregate._sum.amount ?? 0;
    if (awardedSoFar + amount > maxXpPerPr) return true;
  }

  return false;
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

async function upsertUserFrozenBalance(tx, userId, amount) {
  await tx.userXpBalance.upsert({
    where: { userId },
    create: {
      userId,
      frozenXp: amount,
    },
    update: {
      frozenXp: { increment: amount },
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

async function upsertTeamFrozenBalance(tx, teamId, amount) {
  await tx.teamXpBalance.upsert({
    where: { teamId },
    create: {
      teamId,
      frozenTeamXp: amount,
    },
    update: {
      frozenTeamXp: { increment: amount },
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
