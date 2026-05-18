import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { computeLevel } from "../src/modules/gamification/gamification.math.js";

const prisma = new PrismaClient();

function createEmptyUserBalance() {
  return {
    lifetimeXp: 0,
    semesterXp: 0,
    monthlyXp: 0,
    weeklyXp: 0,
    frozenXp: 0,
  };
}

function createEmptyTeamBalance() {
  return {
    lifetimeTeamXp: 0,
    semesterTeamXp: 0,
    monthlyTeamXp: 0,
    weeklyTeamXp: 0,
    frozenTeamXp: 0,
  };
}

export function getUtcPeriodWindows(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startMonth = month < 6 ? 0 : 6;
  const endMonth = startMonth === 0 ? 5 : 11;

  const weekStart = new Date(Date.UTC(year, month, now.getUTCDate()));
  const day = weekStart.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  weekStart.setUTCDate(weekStart.getUTCDate() + diffToMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return {
    semester: {
      start: new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(year, endMonth + 1, 0, 23, 59, 59, 999)),
    },
    month: {
      start: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
    },
    week: {
      start: weekStart,
      end: weekEnd,
    },
  };
}

export function getSignedAmount(transaction) {
  const amount = Math.abs(Number(transaction.amount) || 0);
  return transaction.direction === "DEBIT" ? -amount : amount;
}

function isInWindow(value, window) {
  const date = value instanceof Date ? value : new Date(value);
  return date >= window.start && date <= window.end;
}

function clampXp(value) {
  return Math.max(0, Math.round(value));
}

function getOrCreate(map, key, factory) {
  if (!map.has(key)) {
    map.set(key, factory());
  }
  return map.get(key);
}

export function buildRecalculatedBalances({ transactions, existingUserIds = [], existingTeamIds = [], now = new Date() }) {
  const windows = getUtcPeriodWindows(now);
  const userBalances = new Map(existingUserIds.filter(Boolean).map((userId) => [userId, createEmptyUserBalance()]));
  const teamBalances = new Map(existingTeamIds.filter(Boolean).map((teamId) => [teamId, createEmptyTeamBalance()]));

  for (const transaction of transactions) {
    if (transaction.recipientType === "USER" && transaction.userId) {
      const balance = getOrCreate(userBalances, transaction.userId, createEmptyUserBalance);
      applyUserTransaction(balance, transaction, windows);
    }

    if (transaction.recipientType === "TEAM" && transaction.teamId) {
      const balance = getOrCreate(teamBalances, transaction.teamId, createEmptyTeamBalance);
      applyTeamTransaction(balance, transaction, windows);
    }
  }

  return {
    userBalances: Array.from(userBalances.entries()).map(([userId, balance]) => ({
      userId,
      ...balance,
      lifetimeXp: clampXp(balance.lifetimeXp),
      semesterXp: clampXp(balance.semesterXp),
      monthlyXp: clampXp(balance.monthlyXp),
      weeklyXp: clampXp(balance.weeklyXp),
      frozenXp: clampXp(balance.frozenXp),
      level: computeLevel(balance.lifetimeXp),
    })),
    teamBalances: Array.from(teamBalances.entries()).map(([teamId, balance]) => ({
      teamId,
      ...balance,
      lifetimeTeamXp: clampXp(balance.lifetimeTeamXp),
      semesterTeamXp: clampXp(balance.semesterTeamXp),
      monthlyTeamXp: clampXp(balance.monthlyTeamXp),
      weeklyTeamXp: clampXp(balance.weeklyTeamXp),
      frozenTeamXp: clampXp(balance.frozenTeamXp),
    })),
  };
}

function applyUserTransaction(balance, transaction, windows) {
  const signedAmount = getSignedAmount(transaction);

  if (transaction.status === "FROZEN") {
    balance.frozenXp += signedAmount;
    return;
  }

  if (transaction.status !== "AWARDED") return;

  balance.lifetimeXp += signedAmount;
  if (isInWindow(transaction.createdAt, windows.semester)) balance.semesterXp += signedAmount;
  if (isInWindow(transaction.createdAt, windows.month)) balance.monthlyXp += signedAmount;
  if (isInWindow(transaction.createdAt, windows.week)) balance.weeklyXp += signedAmount;
}

function applyTeamTransaction(balance, transaction, windows) {
  const signedAmount = getSignedAmount(transaction);

  if (transaction.status === "FROZEN") {
    balance.frozenTeamXp += signedAmount;
    return;
  }

  if (transaction.status !== "AWARDED") return;

  balance.lifetimeTeamXp += signedAmount;
  if (isInWindow(transaction.createdAt, windows.semester)) balance.semesterTeamXp += signedAmount;
  if (isInWindow(transaction.createdAt, windows.month)) balance.monthlyTeamXp += signedAmount;
  if (isInWindow(transaction.createdAt, windows.week)) balance.weeklyTeamXp += signedAmount;
}

export async function recalculateLedger(client = prisma, now = new Date()) {
  console.log("Starting Gamification Ledger Recalculation...");

  await client.$transaction(
    async (tx) => {
      console.log("Loading current balances and XP transactions...");
      const [existingUserBalances, existingTeamBalances, transactions] = await Promise.all([
        tx.userXpBalance.findMany({ select: { userId: true } }),
        tx.teamXpBalance.findMany({ select: { teamId: true } }),
        tx.xpTransaction.findMany({
          where: {
            status: { in: ["AWARDED", "FROZEN"] },
          },
          select: {
            recipientType: true,
            userId: true,
            teamId: true,
            amount: true,
            direction: true,
            status: true,
            createdAt: true,
          },
        }),
      ]);

      const { userBalances, teamBalances } = buildRecalculatedBalances({
        transactions,
        existingUserIds: existingUserBalances.map((balance) => balance.userId),
        existingTeamIds: existingTeamBalances.map((balance) => balance.teamId),
        now,
      });

      console.log(`Recalculating ${userBalances.length} user XP balances...`);
      for (const balance of userBalances) {
        await tx.userXpBalance.upsert({
          where: { userId: balance.userId },
          create: {
            userId: balance.userId,
            lifetimeXp: balance.lifetimeXp,
            semesterXp: balance.semesterXp,
            monthlyXp: balance.monthlyXp,
            weeklyXp: balance.weeklyXp,
            frozenXp: balance.frozenXp,
            level: balance.level,
            lastRecalculatedAt: now,
          },
          update: {
            lifetimeXp: balance.lifetimeXp,
            semesterXp: balance.semesterXp,
            monthlyXp: balance.monthlyXp,
            weeklyXp: balance.weeklyXp,
            frozenXp: balance.frozenXp,
            level: balance.level,
            lastRecalculatedAt: now,
          },
        });
      }

      console.log(`Recalculating ${teamBalances.length} team XP balances...`);
      for (const balance of teamBalances) {
        await tx.teamXpBalance.upsert({
          where: { teamId: balance.teamId },
          create: {
            teamId: balance.teamId,
            lifetimeTeamXp: balance.lifetimeTeamXp,
            semesterTeamXp: balance.semesterTeamXp,
            monthlyTeamXp: balance.monthlyTeamXp,
            weeklyTeamXp: balance.weeklyTeamXp,
            frozenTeamXp: balance.frozenTeamXp,
            lastRecalculatedAt: now,
          },
          update: {
            lifetimeTeamXp: balance.lifetimeTeamXp,
            semesterTeamXp: balance.semesterTeamXp,
            monthlyTeamXp: balance.monthlyTeamXp,
            weeklyTeamXp: balance.weeklyTeamXp,
            frozenTeamXp: balance.frozenTeamXp,
            lastRecalculatedAt: now,
          },
        });
      }

      console.log("Ledger recalculation complete.");
    },
    { timeout: 30000 },
  );
}

async function main() {
  try {
    await recalculateLedger();
  } catch (error) {
    console.error("Failed to recalculate ledger:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
