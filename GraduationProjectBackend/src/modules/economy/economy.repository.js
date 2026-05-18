import { Prisma } from "@prisma/client";
import { prisma } from "../../loaders/dbLoader.js";

const MAX_SERIALIZATION_RETRIES = 3;

export const walletSelect = {
  id: true,
  userId: true,
  balance: true,
  lifetimeEarned: true,
  lifetimeSpent: true,
  updatedAt: true,
};

export const questSelect = {
  id: true,
  code: true,
  title: true,
  description: true,
  type: true,
  metric: true,
  targetValue: true,
  coinReward: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  sortOrder: true,
  metadata: true,
};

export const progressSelect = {
  id: true,
  questId: true,
  userId: true,
  windowKey: true,
  currentValue: true,
  completedAt: true,
  claimedAt: true,
  coinTransactionId: true,
  updatedAt: true,
  quest: { select: questSelect },
};

export const rewardItemSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  type: true,
  cost: true,
  status: true,
  inventory: true,
  imageUrl: true,
  metadata: true,
  sortOrder: true,
};

export const coinTransactionSelect = {
  id: true,
  amount: true,
  direction: true,
  status: true,
  sourceType: true,
  sourceId: true,
  reason: true,
  metadata: true,
  createdAt: true,
};

export const purchaseSelect = {
  id: true,
  userId: true,
  rewardItemId: true,
  status: true,
  isEquipped: true,
  equippedAt: true,
  metadata: true,
  createdAt: true,
  rewardItem: { select: rewardItemSelect },
  coinTransaction: { select: coinTransactionSelect },
};

export async function runSerializable(callback) {
  let attempt = 0;

  while (attempt < MAX_SERIALIZATION_RETRIES) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (error?.code === "P2034") {
        attempt += 1;
        if (attempt >= MAX_SERIALIZATION_RETRIES) throw error;
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
        continue;
      }
      throw error;
    }
  }

  return null;
}

export async function findOrCreateWallet(userId) {
  return prisma.userCoinBalance.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: walletSelect,
  });
}

export async function listActiveQuests(now = new Date()) {
  return prisma.quest.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    select: questSelect,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function findQuestProgress(userId, questId, windowKey) {
  return prisma.userQuestProgress.findUnique({
    where: { questId_userId_windowKey: { questId, userId, windowKey } },
    select: progressSelect,
  });
}

export async function upsertQuestProgress({ userId, quest, windowKey, currentValue, completedAt }) {
  return prisma.userQuestProgress.upsert({
    where: { questId_userId_windowKey: { questId: quest.id, userId, windowKey } },
    update: {
      currentValue,
      completedAt,
    },
    create: {
      questId: quest.id,
      userId,
      windowKey,
      currentValue,
      completedAt,
    },
    select: progressSelect,
  });
}

export async function listRewardItems(userId) {
  const [items, purchases] = await Promise.all([
    prisma.rewardItem.findMany({
      where: { status: "ACTIVE" },
      select: rewardItemSelect,
      orderBy: [{ sortOrder: "asc" }, { cost: "asc" }],
    }),
    prisma.rewardPurchase.findMany({
      where: { userId, status: "ACTIVE" },
      select: purchaseSelect,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { items, purchases };
}

export async function listEquippedRewards(userId) {
  return prisma.rewardPurchase.findMany({
    where: { userId, status: "ACTIVE", isEquipped: true },
    select: purchaseSelect,
    orderBy: { equippedAt: "desc" },
  });
}

export async function listCoinTransactions(userId, { page, limit }) {
  const where = { userId };
  const [items, total] = await Promise.all([
    prisma.coinTransaction.findMany({
      where,
      select: coinTransactionSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.coinTransaction.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function countMetricForUser(userId, metric, window) {
  const range = window.start && window.end ? { gte: window.start, lt: window.end } : undefined;

  switch (metric) {
    case "XP_EARNED":
      return prisma.xpTransaction.aggregate({
        where: {
          userId,
          recipientType: "USER",
          status: "AWARDED",
          direction: "CREDIT",
          ...(range ? { createdAt: range } : {}),
        },
        _sum: { amount: true },
      }).then((result) => result._sum.amount ?? 0);

    case "TASKS_DONE":
      return prisma.task.count({
        where: {
          assigneeUserId: userId,
          status: "DONE",
          ...(range
            ? {
                OR: [
                  { reviewedAt: range },
                  { reviewedAt: null, updatedAt: range },
                ],
              }
            : {}),
        },
      });

    case "SUBMISSIONS_APPROVED":
      return prisma.submission.count({
        where: {
          submittedByUserId: userId,
          status: "APPROVED",
          ...(range ? { reviewedAt: range } : {}),
        },
      });

    case "PRS_MERGED":
      return prisma.gamificationEvent.count({
        where: {
          eventType: "GITHUB_PR_MERGED",
          actorUserId: userId,
          status: "PROCESSED",
          ...(range ? { occurredAt: range } : {}),
        },
      });

    case "REVIEWS_GIVEN":
      return prisma.gamificationEvent.count({
        where: {
          eventType: "GITHUB_PR_REVIEWED",
          actorUserId: userId,
          status: "PROCESSED",
          ...(range ? { occurredAt: range } : {}),
        },
      });

    case "SPRINTS_COMPLETED":
      return prisma.gamificationEvent.count({
        where: {
          eventType: "SPRINT_COMPLETED",
          actorUserId: userId,
          status: "PROCESSED",
          ...(range ? { occurredAt: range } : {}),
        },
      });

    case "WEEKLY_REPORTS_APPROVED":
      return prisma.weeklyReport.count({
        where: {
          submittedById: userId,
          status: "APPROVED",
          ...(range ? { reviewedAt: range } : {}),
        },
      });

    case "LOGIN_STREAK":
    default:
      return 0;
  }
}

export async function claimQuestRewardTransaction({ userId, progressId, now }) {
  return runSerializable(async (tx) => {
    const progress = await tx.userQuestProgress.findUnique({
      where: { id: progressId },
      select: progressSelect,
    });

    if (!progress) return { kind: "NOT_FOUND" };
    if (progress.userId !== userId) return { kind: "FORBIDDEN" };
    if (!progress.completedAt) return { kind: "INCOMPLETE", progress };
    if (progress.claimedAt) return { kind: "ALREADY_CLAIMED", progress };
    if (!progress.quest?.coinReward || progress.quest.coinReward <= 0) {
      return { kind: "NO_REWARD", progress };
    }

    const idempotencyKey = `QUEST_CLAIM:${userId}:${progress.quest.code}:${progress.windowKey}`;
    const transaction = await tx.coinTransaction.create({
      data: {
        idempotencyKey,
        userId,
        amount: progress.quest.coinReward,
        direction: "CREDIT",
        status: "POSTED",
        sourceType: "QUEST",
        sourceId: progress.questId,
        reason: `Quest completed: ${progress.quest.title}`,
        metadata: {
          questCode: progress.quest.code,
          questType: progress.quest.type,
          windowKey: progress.windowKey,
        },
      },
      select: coinTransactionSelect,
    });

    const wallet = await tx.userCoinBalance.upsert({
      where: { userId },
      update: {
        balance: { increment: progress.quest.coinReward },
        lifetimeEarned: { increment: progress.quest.coinReward },
      },
      create: {
        userId,
        balance: progress.quest.coinReward,
        lifetimeEarned: progress.quest.coinReward,
      },
      select: walletSelect,
    });

    const updatedProgress = await tx.userQuestProgress.update({
      where: { id: progress.id },
      data: { claimedAt: now, coinTransactionId: transaction.id },
      select: progressSelect,
    });

    return { kind: "CLAIMED", progress: updatedProgress, transaction, wallet };
  });
}

export async function purchaseRewardTransaction({ userId, rewardItemId }) {
  return runSerializable(async (tx) => {
    const item = await tx.rewardItem.findUnique({
      where: { id: rewardItemId },
      select: rewardItemSelect,
    });

    if (!item || item.status !== "ACTIVE") return { kind: "NOT_FOUND" };

    const existingPurchase = await tx.rewardPurchase.findUnique({
      where: { userId_rewardItemId: { userId, rewardItemId } },
      select: purchaseSelect,
    });
    if (existingPurchase?.status === "ACTIVE") {
      return { kind: "ALREADY_OWNED", purchase: existingPurchase };
    }

    if (item.inventory !== null && item.inventory !== undefined) {
      const purchasedCount = await tx.rewardPurchase.count({
        where: { rewardItemId, status: "ACTIVE" },
      });
      if (purchasedCount >= item.inventory) return { kind: "SOLD_OUT", item };
    }

    await tx.userCoinBalance.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const debit = await tx.userCoinBalance.updateMany({
      where: { userId, balance: { gte: item.cost } },
      data: {
        balance: { decrement: item.cost },
        lifetimeSpent: { increment: item.cost },
      },
    });

    if (debit.count !== 1) return { kind: "INSUFFICIENT_FUNDS", item };

    const transaction = await tx.coinTransaction.create({
      data: {
        idempotencyKey: `REWARD_PURCHASE:${userId}:${rewardItemId}`,
        userId,
        amount: item.cost,
        direction: "DEBIT",
        status: "POSTED",
        sourceType: "REWARD_PURCHASE",
        sourceId: rewardItemId,
        reason: `Purchased reward: ${item.name}`,
        metadata: { rewardCode: item.code, rewardType: item.type },
      },
      select: coinTransactionSelect,
    });

    const purchase = await tx.rewardPurchase.create({
      data: {
        userId,
        rewardItemId,
        coinTransactionId: transaction.id,
        status: "ACTIVE",
      },
      select: purchaseSelect,
    });

    const wallet = await tx.userCoinBalance.findUnique({
      where: { userId },
      select: walletSelect,
    });

    return { kind: "PURCHASED", item, purchase, transaction, wallet };
  });
}

export async function equipRewardPurchaseTransaction({ userId, purchaseId, equipped }) {
  return runSerializable(async (tx) => {
    const purchase = await tx.rewardPurchase.findUnique({
      where: { id: purchaseId },
      select: purchaseSelect,
    });

    if (!purchase || purchase.status !== "ACTIVE") return { kind: "NOT_FOUND" };
    if (purchase.userId !== userId) return { kind: "FORBIDDEN" };

    if (!equipped) {
      const updated = await tx.rewardPurchase.update({
        where: { id: purchaseId },
        data: { isEquipped: false, equippedAt: null },
        select: purchaseSelect,
      });
      return { kind: "UPDATED", purchase: updated };
    }

    await tx.rewardPurchase.updateMany({
      where: {
        userId,
        status: "ACTIVE",
        rewardItem: { type: purchase.rewardItem.type },
        id: { not: purchase.id },
      },
      data: { isEquipped: false, equippedAt: null },
    });

    const updated = await tx.rewardPurchase.update({
      where: { id: purchaseId },
      data: { isEquipped: true, equippedAt: new Date() },
      select: purchaseSelect,
    });
    return { kind: "UPDATED", purchase: updated };
  });
}

export async function awardCoinsForXpTransaction(tx, xpTransaction) {
  if (!tx?.coinTransaction || !tx?.userCoinBalance) return null;
  if (xpTransaction?.recipientType !== "USER" || !xpTransaction.userId) return null;
  if (xpTransaction?.direction !== "CREDIT" || xpTransaction?.status !== "AWARDED") return null;

  const amount = Math.max(1, Math.floor(Number(xpTransaction.amount ?? 0) / 10));
  if (!Number.isInteger(amount) || amount <= 0) return null;

  try {
    const transaction = await tx.coinTransaction.create({
      data: {
        idempotencyKey: `XP_AWARD:${xpTransaction.id}`,
        userId: xpTransaction.userId,
        amount,
        direction: "CREDIT",
        status: "POSTED",
        sourceType: "XP_AWARD",
        sourceId: xpTransaction.id,
        reason: `Coins earned from XP: ${xpTransaction.reason}`,
        metadata: {
          xpTransactionId: xpTransaction.id,
          xpAmount: xpTransaction.amount,
          sourceType: xpTransaction.sourceType,
          sourceId: xpTransaction.sourceId,
        },
      },
      select: coinTransactionSelect,
    });

    await tx.userCoinBalance.upsert({
      where: { userId: xpTransaction.userId },
      update: {
        balance: { increment: amount },
        lifetimeEarned: { increment: amount },
      },
      create: {
        userId: xpTransaction.userId,
        balance: amount,
        lifetimeEarned: amount,
      },
    });

    return transaction;
  } catch (error) {
    if (error?.code === "P2002") return null;
    throw error;
  }
}

export async function listAdminQuests({ page, limit, status }) {
  const where = status === "ACTIVE" ? { isActive: true } : status === "INACTIVE" ? { isActive: false } : {};
  const [items, total] = await Promise.all([
    prisma.quest.findMany({
      where,
      select: questSelect,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.quest.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function upsertAdminQuest(data) {
  const payload = {
    code: data.code,
    title: data.title,
    description: data.description,
    type: data.type,
    metric: data.metric,
    targetValue: data.targetValue,
    coinReward: data.coinReward,
    startsAt: data.startsAt ?? null,
    endsAt: data.endsAt ?? null,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
    metadata: data.metadata ?? null,
  };

  if (data.id) {
    return prisma.quest.update({
      where: { id: data.id },
      data: payload,
      select: questSelect,
    });
  }

  return prisma.quest.create({ data: payload, select: questSelect });
}

export async function listAdminRewards({ page, limit, status }) {
  const where = status && status !== "ALL" ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.rewardItem.findMany({
      where,
      select: rewardItemSelect,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.rewardItem.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function upsertAdminReward(data) {
  const payload = {
    code: data.code,
    name: data.name,
    description: data.description,
    type: data.type,
    cost: data.cost,
    status: data.status,
    inventory: data.inventory ?? null,
    imageUrl: data.imageUrl ?? null,
    metadata: data.metadata ?? null,
    sortOrder: data.sortOrder,
  };

  if (data.id) {
    return prisma.rewardItem.update({
      where: { id: data.id },
      data: payload,
      select: rewardItemSelect,
    });
  }

  return prisma.rewardItem.create({ data: payload, select: rewardItemSelect });
}
