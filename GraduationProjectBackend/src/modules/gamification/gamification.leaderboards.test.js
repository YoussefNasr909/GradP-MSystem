import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../loaders/dbLoader.js";
import {
  generateLeaderboardSnapshot,
  generateLeaderboardSnapshots,
  getLeaderboardPeriod,
} from "./gamification.leaderboards.js";

function overridePrismaProperty(t, key, value) {
  const descriptor = Object.getOwnPropertyDescriptor(prisma, key);
  Object.defineProperty(prisma, key, { configurable: true, writable: true, value });
  t.after(() => {
    if (descriptor) Object.defineProperty(prisma, key, descriptor);
    else delete prisma[key];
  });
}

test("getLeaderboardPeriod returns stable weekly Monday-Sunday bounds", () => {
  const period = getLeaderboardPeriod("INDIVIDUAL_WEEKLY", new Date("2026-05-15T12:00:00.000Z"));

  assert.equal(period.periodStart.toISOString(), "2026-05-11T00:00:00.000Z");
  assert.equal(period.periodEnd.toISOString(), "2026-05-17T23:59:59.999Z");
});

test("generateLeaderboardSnapshot replaces and recreates ranked individual rows", async (t) => {
  const calls = [];
  overridePrismaProperty(t, "userXpBalance", {
    findMany: async () => [
      { userId: "user-2", lifetimeXp: 300, semesterXp: 200, weeklyXp: 90, level: 2 },
      { userId: "user-1", lifetimeXp: 250, semesterXp: 150, weeklyXp: 60, level: 2 },
    ],
  });
  overridePrismaProperty(t, "$transaction", async (callback) =>
    callback({
      leaderboardSnapshot: {
        deleteMany: async (args) => {
          calls.push({ model: "leaderboardSnapshot", method: "deleteMany", args });
          return { count: 2 };
        },
        createMany: async (args) => {
          calls.push({ model: "leaderboardSnapshot", method: "createMany", args });
          return { count: args.data.length };
        },
      },
    }),
  );

  const result = await generateLeaderboardSnapshot(
    "INDIVIDUAL_WEEKLY",
    new Date("2026-05-15T12:00:00.000Z"),
  );

  assert.equal(result.created, 2);
  const createMany = calls.find((call) => call.method === "createMany");
  assert.equal(createMany.args.data[0].rank, 1);
  assert.equal(createMany.args.data[0].userId, "user-2");
  assert.equal(createMany.args.data[0].score, 90);
  assert.equal(createMany.args.data[1].rank, 2);
});

test("generateLeaderboardSnapshots honors requested type subset", async (t) => {
  const calls = [];
  overridePrismaProperty(t, "teamXpBalance", {
    findMany: async () => [
      {
        teamId: "team-1",
        lifetimeTeamXp: 500,
        semesterTeamXp: 300,
        weeklyTeamXp: 40,
        leaderboardScore: null,
      },
    ],
  });
  overridePrismaProperty(t, "$transaction", async (callback) =>
    callback({
      leaderboardSnapshot: {
        deleteMany: async (args) => {
          calls.push({ method: "deleteMany", args });
          return { count: 0 };
        },
        createMany: async (args) => {
          calls.push({ method: "createMany", args });
          return { count: args.data.length };
        },
      },
    }),
  );

  const result = await generateLeaderboardSnapshots({
    types: ["TEAM_WEEKLY"],
    now: new Date("2026-05-15T12:00:00.000Z"),
  });

  assert.equal(result.generated, 1);
  assert.deepEqual(result.types.map((row) => row.type), ["TEAM_WEEKLY"]);
  assert.equal(calls.find((call) => call.method === "createMany").args.data[0].teamId, "team-1");
});
