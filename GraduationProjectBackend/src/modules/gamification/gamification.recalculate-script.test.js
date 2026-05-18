import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecalculatedBalances,
  getSignedAmount,
  getUtcPeriodWindows,
} from "../../../scripts/recalculate-gamification.js";

test("getSignedAmount treats CREDIT as positive and DEBIT as negative", () => {
  assert.equal(getSignedAmount({ amount: 120, direction: "CREDIT" }), 120);
  assert.equal(getSignedAmount({ amount: 45, direction: "DEBIT" }), -45);
});

test("getUtcPeriodWindows returns current UTC semester, month, and Monday week", () => {
  const windows = getUtcPeriodWindows(new Date("2026-05-17T12:00:00.000Z"));

  assert.equal(windows.semester.start.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(windows.semester.end.toISOString(), "2026-06-30T23:59:59.999Z");
  assert.equal(windows.month.start.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(windows.month.end.toISOString(), "2026-05-31T23:59:59.999Z");
  assert.equal(windows.week.start.toISOString(), "2026-05-11T00:00:00.000Z");
  assert.equal(windows.week.end.toISOString(), "2026-05-17T23:59:59.999Z");
});

test("buildRecalculatedBalances uses AWARDED rows, signed directions, frozen rows, and stale balance ids", () => {
  const now = new Date("2026-05-17T12:00:00.000Z");
  const { userBalances, teamBalances } = buildRecalculatedBalances({
    now,
    existingUserIds: ["stale-user"],
    existingTeamIds: ["stale-team"],
    transactions: [
      {
        recipientType: "USER",
        userId: "student-1",
        amount: 150,
        direction: "CREDIT",
        status: "AWARDED",
        createdAt: new Date("2026-05-12T08:00:00.000Z"),
      },
      {
        recipientType: "USER",
        userId: "student-1",
        amount: 40,
        direction: "DEBIT",
        status: "AWARDED",
        createdAt: new Date("2026-05-14T08:00:00.000Z"),
      },
      {
        recipientType: "USER",
        userId: "student-1",
        amount: 25,
        direction: "CREDIT",
        status: "FROZEN",
        createdAt: new Date("2026-05-15T08:00:00.000Z"),
      },
      {
        recipientType: "USER",
        userId: "student-1",
        amount: 500,
        direction: "CREDIT",
        status: "REJECTED",
        createdAt: new Date("2026-05-15T08:00:00.000Z"),
      },
      {
        recipientType: "TEAM",
        teamId: "team-1",
        amount: 90,
        direction: "CREDIT",
        status: "AWARDED",
        createdAt: new Date("2026-05-12T08:00:00.000Z"),
      },
      {
        recipientType: "TEAM",
        teamId: "team-1",
        amount: 20,
        direction: "DEBIT",
        status: "AWARDED",
        createdAt: new Date("2026-05-13T08:00:00.000Z"),
      },
    ],
  });

  assert.deepEqual(
    userBalances.find((balance) => balance.userId === "student-1"),
    {
      userId: "student-1",
      lifetimeXp: 110,
      semesterXp: 110,
      monthlyXp: 110,
      weeklyXp: 110,
      frozenXp: 25,
      level: 2,
    },
  );
  assert.deepEqual(
    userBalances.find((balance) => balance.userId === "stale-user"),
    {
      userId: "stale-user",
      lifetimeXp: 0,
      semesterXp: 0,
      monthlyXp: 0,
      weeklyXp: 0,
      frozenXp: 0,
      level: 1,
    },
  );
  assert.deepEqual(
    teamBalances.find((balance) => balance.teamId === "team-1"),
    {
      teamId: "team-1",
      lifetimeTeamXp: 70,
      semesterTeamXp: 70,
      monthlyTeamXp: 70,
      weeklyTeamXp: 70,
      frozenTeamXp: 0,
    },
  );
});
