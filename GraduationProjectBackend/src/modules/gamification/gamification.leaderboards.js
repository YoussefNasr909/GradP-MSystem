import { prisma } from "../../loaders/dbLoader.js";
import { GAMIFICATION_TRANSACTION_OPTIONS } from "./gamification.transactions.js";

export const LEADERBOARD_TYPES = [
  "INDIVIDUAL_WEEKLY",
  "INDIVIDUAL_SEMESTER",
  "INDIVIDUAL_LIFETIME",
  "TEAM_WEEKLY",
  "TEAM_SEMESTER",
];

const SNAPSHOT_LIMIT = 1000;

export async function generateLeaderboardSnapshots({ types = LEADERBOARD_TYPES, now = new Date() } = {}) {
  const normalizedTypes = normalizeTypes(types);
  const results = [];

  for (const type of normalizedTypes) {
    results.push(await generateLeaderboardSnapshot(type, now));
  }

  return {
    generated: results.reduce((sum, result) => sum + result.created, 0),
    types: results,
  };
}

export async function generateLeaderboardSnapshot(type, now = new Date()) {
  const period = getLeaderboardPeriod(type, now);
  const rows = await loadLeaderboardRows(type);
  const data = rows.map((row, index) => buildSnapshotData(type, row, index + 1, period, now));

  await withLeaderboardSnapshotRetry(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.leaderboardSnapshot.deleteMany({
        where: {
          leaderboardType: type,
          scopeType: "GLOBAL",
          scopeId: null,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
        },
      });

      if (data.length > 0) {
        await tx.leaderboardSnapshot.createMany({ data });
      }
    }, GAMIFICATION_TRANSACTION_OPTIONS);
  });

  return {
    type,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    created: data.length,
  };
}

async function withLeaderboardSnapshotRetry(operation, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (error?.code !== "P2034" || attempt === attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
}

export function getLeaderboardPeriod(type, now = new Date()) {
  if (type.endsWith("_LIFETIME")) {
    return {
      periodStart: new Date("1970-01-01T00:00:00.000Z"),
      periodEnd: new Date("9999-12-31T23:59:59.999Z"),
    };
  }

  if (type.endsWith("_SEMESTER")) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const startMonth = month < 6 ? 0 : 6;
    const endMonth = startMonth === 0 ? 5 : 11;
    return {
      periodStart: new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0)),
      periodEnd: new Date(Date.UTC(year, endMonth + 1, 0, 23, 59, 59, 999)),
    };
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = start.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diffToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return { periodStart: start, periodEnd: end };
}

function normalizeTypes(types) {
  const requested = Array.isArray(types) && types.length > 0 ? types : LEADERBOARD_TYPES;
  return LEADERBOARD_TYPES.filter((type) => requested.includes(type));
}

async function loadLeaderboardRows(type) {
  if (type.startsWith("TEAM_")) {
    const scoreField = type === "TEAM_SEMESTER" ? "semesterTeamXp" : "weeklyTeamXp";
    return prisma.teamXpBalance.findMany({
      orderBy: [{ [scoreField]: "desc" }, { teamId: "asc" }],
      take: SNAPSHOT_LIMIT,
      select: {
        teamId: true,
        lifetimeTeamXp: true,
        semesterTeamXp: true,
        weeklyTeamXp: true,
        leaderboardScore: true,
      },
    });
  }

  const scoreField =
    type === "INDIVIDUAL_SEMESTER"
      ? "semesterXp"
      : type === "INDIVIDUAL_LIFETIME"
        ? "lifetimeXp"
        : "weeklyXp";

  return prisma.userXpBalance.findMany({
    orderBy: [{ [scoreField]: "desc" }, { userId: "asc" }],
    take: SNAPSHOT_LIMIT,
    select: {
      userId: true,
      lifetimeXp: true,
      semesterXp: true,
      weeklyXp: true,
      level: true,
    },
  });
}

function buildSnapshotData(type, row, rank, period, now) {
  const score = getScore(type, row);
  const isTeam = type.startsWith("TEAM_");

  return {
    scopeType: "GLOBAL",
    scopeId: null,
    leaderboardType: type,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    rank,
    userId: isTeam ? null : row.userId,
    teamId: isTeam ? row.teamId : null,
    score,
    breakdown: isTeam
      ? {
          lifetimeXp: row.lifetimeTeamXp,
          semesterXp: row.semesterTeamXp,
          weeklyXp: row.weeklyTeamXp,
          leaderboardScore: row.leaderboardScore,
        }
      : {
          lifetimeXp: row.lifetimeXp,
          semesterXp: row.semesterXp,
          weeklyXp: row.weeklyXp,
          level: row.level,
        },
    generatedAt: now,
  };
}

function getScore(type, row) {
  if (type === "TEAM_SEMESTER") return row.semesterTeamXp;
  if (type === "TEAM_WEEKLY") return row.weeklyTeamXp;
  if (type === "INDIVIDUAL_SEMESTER") return row.semesterXp;
  if (type === "INDIVIDUAL_LIFETIME") return row.lifetimeXp;
  return row.weeklyXp;
}
