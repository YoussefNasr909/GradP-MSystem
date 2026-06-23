import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../loaders/dbLoader.js";
import {
  awardCoinsForXpTransaction,
  claimQuestRewardTransaction,
  equipRewardPurchaseTransaction,
  purchaseRewardTransaction,
} from "./economy.repository.js";

function mockPrismaTransaction(t, tx, onOptions = () => {}) {
  const originalTransaction = prisma.$transaction;
  Object.defineProperty(prisma, "$transaction", {
    configurable: true,
    writable: true,
    value: async (callback, options) => {
      onOptions(options);
      return callback(tx);
    },
  });
  t.after(() => {
    Object.defineProperty(prisma, "$transaction", {
      configurable: true,
      writable: true,
      value: originalTransaction,
    });
  });
}

test("purchaseRewardTransaction atomically refuses purchases that would overdraw wallet", async (t) => {
  const calls = [];
  const tx = {
    rewardItem: {
      findUnique: async () => ({
        id: "reward-1",
        code: "TITLE_TEST",
        name: "Test Title",
        description: "Test",
        type: "TITLE",
        cost: 150,
        status: "ACTIVE",
        inventory: null,
        imageUrl: null,
        metadata: null,
        sortOrder: 1,
      }),
    },
    rewardPurchase: {
      findUnique: async () => null,
      count: async () => 0,
      create: async (args) => {
        calls.push({ model: "rewardPurchase", method: "create", args });
        return args;
      },
    },
    userCoinBalance: {
      upsert: async (args) => {
        calls.push({ model: "userCoinBalance", method: "upsert", args });
        return args;
      },
      updateMany: async (args) => {
        calls.push({ model: "userCoinBalance", method: "updateMany", args });
        return { count: 0 };
      },
      findUnique: async () => null,
    },
    coinTransaction: {
      create: async (args) => {
        calls.push({ model: "coinTransaction", method: "create", args });
        return args;
      },
    },
  };
  mockPrismaTransaction(t, tx);

  const result = await purchaseRewardTransaction({ userId: "user-1", rewardItemId: "reward-1" });

  assert.equal(result.kind, "INSUFFICIENT_FUNDS");
  assert.equal(calls.some((call) => call.model === "coinTransaction"), false);
  assert.equal(calls.some((call) => call.model === "rewardPurchase"), false);
  assert.deepEqual(
    calls.find((call) => call.model === "userCoinBalance" && call.method === "updateMany").args.where,
    { userId: "user-1", balance: { gte: 150 } },
  );
});

test("purchaseRewardTransaction uses a standard Prisma transaction", async (t) => {
  const tx = {
    rewardItem: {
      findUnique: async () => null,
    },
  };
  let receivedOptions = "not-called";
  mockPrismaTransaction(t, tx, (options) => {
    receivedOptions = options;
  });

  await purchaseRewardTransaction({ userId: "user-1", rewardItemId: "missing-reward" });

  assert.equal(receivedOptions, undefined);
});

test("purchaseRewardTransaction refuses any existing purchase record before debiting", async (t) => {
  const calls = [];
  const existingPurchase = {
    id: "purchase-1",
    userId: "user-1",
    rewardItemId: "reward-1",
    status: "REVOKED",
    isEquipped: false,
    equippedAt: null,
    rewardItem: { id: "reward-1", type: "TITLE", name: "Archived title" },
    coinTransaction: { id: "coin-1" },
  };
  const tx = {
    rewardItem: {
      findUnique: async () => ({
        id: "reward-1",
        code: "TITLE_TEST",
        name: "Test Title",
        description: "Test",
        type: "TITLE",
        cost: 80,
        status: "ACTIVE",
        inventory: null,
        imageUrl: null,
        metadata: null,
        sortOrder: 1,
      }),
    },
    rewardPurchase: {
      findUnique: async () => existingPurchase,
      count: async () => {
        calls.push({ model: "rewardPurchase", method: "count" });
        return 0;
      },
      create: async (args) => {
        calls.push({ model: "rewardPurchase", method: "create", args });
        return args;
      },
    },
    userCoinBalance: {
      updateMany: async (args) => {
        calls.push({ model: "userCoinBalance", method: "updateMany", args });
        return { count: 1 };
      },
    },
    coinTransaction: {
      create: async (args) => {
        calls.push({ model: "coinTransaction", method: "create", args });
        return args;
      },
    },
  };
  mockPrismaTransaction(t, tx);

  const result = await purchaseRewardTransaction({ userId: "user-1", rewardItemId: "reward-1" });

  assert.equal(result.kind, "ALREADY_OWNED");
  assert.equal(result.purchase, existingPurchase);
  assert.equal(calls.length, 0);
});

test("purchaseRewardTransaction debits wallet and records immutable transaction", async (t) => {
  const calls = [];
  const tx = {
    rewardItem: {
      findUnique: async () => ({
        id: "reward-1",
        code: "TITLE_TEST",
        name: "Test Title",
        description: "Test",
        type: "TITLE",
        cost: 80,
        status: "ACTIVE",
        inventory: null,
        imageUrl: null,
        metadata: null,
        sortOrder: 1,
      }),
    },
    rewardPurchase: {
      findUnique: async () => null,
      count: async () => 0,
      create: async (args) => {
        calls.push({ model: "rewardPurchase", method: "create", args });
        return {
          id: "purchase-1",
          userId: args.data.userId,
          rewardItemId: args.data.rewardItemId,
          status: args.data.status,
          rewardItem: { id: args.data.rewardItemId },
          coinTransaction: { id: args.data.coinTransactionId },
        };
      },
    },
    userCoinBalance: {
      upsert: async (args) => {
        calls.push({ model: "userCoinBalance", method: "upsert", args });
        return args;
      },
      updateMany: async (args) => {
        calls.push({ model: "userCoinBalance", method: "updateMany", args });
        return { count: 1 };
      },
      findUnique: async () => ({ userId: "user-1", balance: 100, lifetimeEarned: 180, lifetimeSpent: 80 }),
    },
    coinTransaction: {
      create: async (args) => {
        calls.push({ model: "coinTransaction", method: "create", args });
        return { id: "coin-tx-1", ...args.data };
      },
    },
  };
  mockPrismaTransaction(t, tx);

  const result = await purchaseRewardTransaction({ userId: "user-1", rewardItemId: "reward-1" });

  assert.equal(result.kind, "PURCHASED");
  const debit = calls.find((call) => call.model === "userCoinBalance" && call.method === "updateMany");
  assert.deepEqual(debit.args.data.balance, { decrement: 80 });
  assert.deepEqual(debit.args.data.lifetimeSpent, { increment: 80 });
  const coinTx = calls.find((call) => call.model === "coinTransaction");
  assert.equal(coinTx.args.data.direction, "DEBIT");
  assert.equal(coinTx.args.data.idempotencyKey, "REWARD_PURCHASE:user-1:reward-1");
});

test("claimQuestRewardTransaction credits wallet once for completed unclaimed progress", async (t) => {
  const now = new Date("2026-05-18T12:00:00.000Z");
  const calls = [];
  const progress = {
    id: "progress-1",
    questId: "quest-1",
    userId: "user-1",
    windowKey: "daily:2026-05-18",
    currentValue: 2,
    completedAt: now,
    claimedAt: null,
    coinTransactionId: null,
    quest: {
      id: "quest-1",
      code: "DAILY_TASK_CLOSER",
      title: "Task closer",
      description: "Complete two tasks",
      type: "DAILY",
      metric: "TASKS_DONE",
      targetValue: 2,
      coinReward: 25,
      startsAt: null,
      endsAt: null,
      sortOrder: 10,
      metadata: null,
    },
  };
  const tx = {
    userQuestProgress: {
      findUnique: async () => progress,
      update: async (args) => {
        calls.push({ model: "userQuestProgress", method: "update", args });
        return { ...progress, claimedAt: args.data.claimedAt, coinTransactionId: args.data.coinTransactionId };
      },
    },
    coinTransaction: {
      create: async (args) => {
        calls.push({ model: "coinTransaction", method: "create", args });
        return { id: "coin-tx-1", ...args.data };
      },
    },
    userCoinBalance: {
      upsert: async (args) => {
        calls.push({ model: "userCoinBalance", method: "upsert", args });
        return { userId: "user-1", balance: 25, lifetimeEarned: 25, lifetimeSpent: 0 };
      },
    },
  };
  mockPrismaTransaction(t, tx);

  const result = await claimQuestRewardTransaction({ userId: "user-1", progressId: "progress-1", now });

  assert.equal(result.kind, "CLAIMED");
  const coinTx = calls.find((call) => call.model === "coinTransaction");
  assert.equal(coinTx.args.data.direction, "CREDIT");
  assert.equal(coinTx.args.data.idempotencyKey, "QUEST_CLAIM:user-1:DAILY_TASK_CLOSER:daily:2026-05-18");
  const wallet = calls.find((call) => call.model === "userCoinBalance");
  assert.deepEqual(wallet.args.update.balance, { increment: 25 });
  assert.deepEqual(wallet.args.update.lifetimeEarned, { increment: 25 });
});

test("equipRewardPurchaseTransaction equips one active reward per type", async (t) => {
  const calls = [];
  const tx = {
    rewardPurchase: {
      findUnique: async () => ({
        id: "purchase-1",
        userId: "user-1",
        rewardItemId: "reward-1",
        status: "ACTIVE",
        isEquipped: false,
        equippedAt: null,
        rewardItem: { id: "reward-1", type: "TITLE", name: "Architect" },
        coinTransaction: { id: "coin-1" },
      }),
      updateMany: async (args) => {
        calls.push({ model: "rewardPurchase", method: "updateMany", args });
        return { count: 1 };
      },
      update: async (args) => {
        calls.push({ model: "rewardPurchase", method: "update", args });
        return { id: args.where.id, isEquipped: args.data.isEquipped };
      },
    },
  };
  mockPrismaTransaction(t, tx);

  const result = await equipRewardPurchaseTransaction({ userId: "user-1", purchaseId: "purchase-1", equipped: true });

  assert.equal(result.kind, "UPDATED");
  assert.equal(calls[0].method, "updateMany");
  assert.equal(calls[0].args.where.rewardItem.type, "TITLE");
  assert.equal(calls[1].args.data.isEquipped, true);
});

test("awardCoinsForXpTransaction grants deterministic coins for awarded user XP", async () => {
  const calls = [];
  const tx = {
    coinTransaction: {
      create: async (args) => {
        calls.push({ model: "coinTransaction", args });
        return { id: "coin-1", ...args.data };
      },
    },
    userCoinBalance: {
      upsert: async (args) => {
        calls.push({ model: "userCoinBalance", args });
        return args;
      },
    },
  };

  const result = await awardCoinsForXpTransaction(tx, {
    id: "xp-1",
    recipientType: "USER",
    userId: "user-1",
    amount: 85,
    direction: "CREDIT",
    status: "AWARDED",
    reason: "Task approved",
    sourceType: "Task",
    sourceId: "task-1",
  });

  assert.equal(result.amount, 8);
  assert.equal(calls[0].args.data.idempotencyKey, "XP_AWARD:xp-1");
  assert.equal(calls[0].args.data.sourceType, "XP_AWARD");
  assert.deepEqual(calls[1].args.update.balance, { increment: 8 });
});
