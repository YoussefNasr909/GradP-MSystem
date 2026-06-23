import { AppError } from "../../common/errors/AppError.js";
import { notify } from "../../common/utils/notify.js";
import {
  claimQuestRewardTransaction,
  equipRewardPurchaseTransaction,
  findOrCreateWallet,
  findQuestProgress,
  listActiveQuests,
  listCoinTransactions,
  listEquippedRewards,
  listRewardItems,
  purchaseRewardTransaction,
  upsertQuestProgress,
} from "./economy.repository.js";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function getUtcDateKey(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function getQuestWindow(quest, now = new Date()) {
  if (quest.type === "DAILY") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return {
      key: `daily:${getUtcDateKey(start)}`,
      start,
      end,
      label: "Today",
    };
  }

  if (quest.type === "WEEKLY") {
    const day = now.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      key: `weekly:${getUtcDateKey(start)}`,
      start,
      end,
      label: "This week",
    };
  }

  return {
    key: "lifetime",
    start: null,
    end: null,
    label: "Milestone",
  };
}

function toQuestProgressDto(progress, window, { newlyCompleted = false } = {}) {
  const target = Math.max(1, progress.quest.targetValue);
  const percentage = Math.min(100, Math.round((progress.currentValue / target) * 100));

  return {
    id: progress.id,
    quest: progress.quest,
    windowKey: progress.windowKey,
    windowLabel: window.label,
    windowEndsAt: window.end?.toISOString?.() ?? null,
    currentValue: progress.currentValue,
    targetValue: target,
    progressPercentage: percentage,
    completedAt: progress.completedAt,
    claimedAt: progress.claimedAt,
    claimable: Boolean(progress.completedAt && !progress.claimedAt && progress.quest.coinReward > 0),
    newlyCompleted,
  };
}

function toRewardDto(item, ownedIds, purchaseByItemId) {
  const purchase = purchaseByItemId.get(item.id) ?? null;

  return {
    ...item,
    owned: ownedIds.has(item.id),
    purchase,
  };
}

function normalizePagination({ page = 1, limit = 20 } = {}) {
  return {
    page: Math.max(1, Number(page) || 1),
    limit: Math.min(100, Math.max(1, Number(limit) || 20)),
  };
}

export async function syncQuestProgressForUser(userId, now = new Date()) {
  const quests = await listActiveQuests(now);
  const progressItems = [];

  for (const quest of quests) {
    const window = getQuestWindow(quest, now);
    let progress = await findQuestProgress(userId, quest.id, window.key);
    let newlyCompleted = false;

    if (!progress) {
      progress = await upsertQuestProgress({
        userId,
        quest,
        windowKey: window.key,
        currentValue: 0,
        completedAt: null,
      });
    } else if (progress.currentValue >= quest.targetValue && !progress.completedAt) {
      newlyCompleted = true;
      progress = await upsertQuestProgress({
        userId,
        quest,
        windowKey: window.key,
        currentValue: progress.currentValue,
        completedAt: now,
      });
    }

    if (newlyCompleted) {
      await notify({
        userId,
        type: "SYSTEM",
        title: "Quest ready to claim",
        message: `${quest.title} is complete. Claim ${quest.coinReward} coins in the Gamification Hub.`,
        actionUrl: "/dashboard/gamification?tab=quests",
      });
    }

    progressItems.push(toQuestProgressDto(progress, window, { newlyCompleted }));
  }

  return progressItems;
}

export async function getEconomyOverviewService(actor) {
  const [wallet, quests, rewardsResult, transactions, equippedRewards] = await Promise.all([
    findOrCreateWallet(actor.id),
    syncQuestProgressForUser(actor.id),
    listRewardItems(actor.id),
    listCoinTransactions(actor.id, { page: 1, limit: 8 }),
    listEquippedRewards(actor.id),
  ]);

  const ownedIds = new Set(rewardsResult.purchases.map((purchase) => purchase.rewardItemId));
  const purchaseByItemId = new Map(rewardsResult.purchases.map((purchase) => [purchase.rewardItemId, purchase]));

  return {
    wallet,
    quests,
    rewards: rewardsResult.items.map((item) => toRewardDto(item, ownedIds, purchaseByItemId)),
    purchases: rewardsResult.purchases,
    equippedRewards,
    recentTransactions: transactions.items,
  };
}

export async function getMyQuestsService(actor) {
  return { items: await syncQuestProgressForUser(actor.id) };
}

export async function claimQuestService(actor, progressId) {
  await syncQuestProgressForUser(actor.id);
  const result = await claimQuestRewardTransaction({ userId: actor.id, progressId, now: new Date() });

  switch (result?.kind) {
    case "CLAIMED":
      return result;
    case "ALREADY_CLAIMED":
      throw new AppError("This quest reward has already been claimed.", 409, "QUEST_ALREADY_CLAIMED");
    case "INCOMPLETE":
      throw new AppError("Complete the quest before claiming the reward.", 422, "QUEST_INCOMPLETE");
    case "NO_REWARD":
      throw new AppError("This quest does not have a claimable coin reward.", 422, "QUEST_NO_REWARD");
    case "FORBIDDEN":
      throw new AppError("You can only claim your own quest rewards.", 403, "QUEST_FORBIDDEN");
    case "NOT_FOUND":
    default:
      throw new AppError("Quest progress was not found.", 404, "QUEST_PROGRESS_NOT_FOUND");
  }
}

export async function getRewardsService(actor) {
  const [wallet, rewardsResult] = await Promise.all([
    findOrCreateWallet(actor.id),
    listRewardItems(actor.id),
  ]);
  const ownedIds = new Set(rewardsResult.purchases.map((purchase) => purchase.rewardItemId));
  const purchaseByItemId = new Map(rewardsResult.purchases.map((purchase) => [purchase.rewardItemId, purchase]));

  return {
    wallet,
    items: rewardsResult.items.map((item) => toRewardDto(item, ownedIds, purchaseByItemId)),
    purchases: rewardsResult.purchases,
  };
}

export async function purchaseRewardService(actor, rewardItemId) {
  const result = await purchaseRewardTransaction({ userId: actor.id, rewardItemId });

  switch (result?.kind) {
    case "PURCHASED":
      return result;
    case "ALREADY_OWNED":
      throw new AppError("You already own this reward.", 409, "REWARD_ALREADY_OWNED");
    case "INSUFFICIENT_FUNDS":
      throw new AppError("You do not have enough coins for this reward.", 422, "INSUFFICIENT_COINS");
    case "SOLD_OUT":
      throw new AppError("This reward is sold out.", 409, "REWARD_SOLD_OUT");
    case "NOT_FOUND":
    default:
      throw new AppError("Reward item was not found.", 404, "REWARD_NOT_FOUND");
  }
}

export async function equipRewardService(actor, purchaseId, equipped = true) {
  const result = await equipRewardPurchaseTransaction({ userId: actor.id, purchaseId, equipped });

  switch (result?.kind) {
    case "UPDATED":
      return result;
    case "FORBIDDEN":
      throw new AppError("You can only equip your own rewards.", 403, "REWARD_FORBIDDEN");
    case "NOT_FOUND":
    default:
      throw new AppError("Reward purchase was not found.", 404, "REWARD_PURCHASE_NOT_FOUND");
  }
}

export async function getCoinTransactionsService(actor, query) {
  return listCoinTransactions(actor.id, normalizePagination(query));
}

export async function getAdminQuestsService(_actor, query) {
  void query;
  throw new AppError("Quest administration is disabled.", 410, "ECONOMY_ADMIN_DISABLED");
}

export async function saveAdminQuestService(_actor, payload, questId = null) {
  void payload;
  void questId;
  throw new AppError("Quest administration is disabled.", 410, "ECONOMY_ADMIN_DISABLED");
}

export async function getAdminRewardsService(_actor, query) {
  void query;
  throw new AppError("Reward administration is disabled.", 410, "ECONOMY_ADMIN_DISABLED");
}

export async function saveAdminRewardService(_actor, payload, rewardItemId = null) {
  void payload;
  void rewardItemId;
  throw new AppError("Reward administration is disabled.", 410, "ECONOMY_ADMIN_DISABLED");
}
