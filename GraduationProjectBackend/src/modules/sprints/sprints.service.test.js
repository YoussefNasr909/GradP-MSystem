import assert from "node:assert/strict";
import test from "node:test";
import { env } from "../../config/env.js";
import { prisma } from "../../loaders/dbLoader.js";
import {
  completeSprintService,
  listSprintsBoardService,
} from "./sprints.service.js";

function overridePrismaProperty(t, key, value) {
  const descriptor = Object.getOwnPropertyDescriptor(prisma, key);
  Object.defineProperty(prisma, key, {
    configurable: true,
    writable: true,
    value,
  });
  t.after(() => {
    if (descriptor) {
      Object.defineProperty(prisma, key, descriptor);
    } else {
      delete prisma[key];
    }
  });
}

const leader = {
  id: "leader-1",
  firstName: "Team",
  lastName: "Lead",
  email: "leader@example.com",
  role: "LEADER",
  accountStatus: "ACTIVE",
  academicId: null,
  department: null,
  academicYear: null,
  preferredTrack: null,
  avatarUrl: null,
  bio: null,
  linkedinUrl: null,
  githubUsername: null,
  isEmailVerified: true,
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const team = {
  id: "team-1",
  name: "Compiler Crew",
  bio: "",
  inviteCode: null,
  maxMembers: 6,
  visibility: "PRIVATE",
  allowJoinRequests: false,
  stage: "IMPLEMENTATION",
  stack: [],
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-01T00:00:00.000Z"),
  leader,
  doctor: null,
  ta: null,
  members: [],
};

function buildSprint(overrides = {}) {
  const sprint = {
    id: "sprint-1",
    teamId: "team-1",
    name: "Sprint 1",
    goal: "Ship the core workflow",
    startDate: new Date("2026-05-01T00:00:00.000Z"),
    endDate: new Date("2026-05-14T23:59:59.999Z"),
    status: "ACTIVE",
    completedAt: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    createdBy: leader,
    tasks: [
      {
        id: "task-1",
        teamId: "team-1",
        sprintId: "sprint-1",
        title: "Build parser",
        description: "",
        status: "DONE",
        priority: "HIGH",
        taskType: "CODE",
        integrationMode: "GITHUB",
        origin: "GPMS",
        labels: [],
        storyPoints: 3,
        actualPoints: null,
        unplanned: false,
        startDate: new Date("2026-05-01T00:00:00.000Z"),
        dueDate: new Date("2026-05-05T23:59:59.999Z"),
        acceptedAt: null,
        submittedForReviewAt: null,
        reviewedAt: new Date("2026-05-05T12:00:00.000Z"),
        githubIssueNumber: null,
        githubIssueUrl: null,
        githubPullRequestNumber: null,
        githubPullRequestUrl: null,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        updatedAt: new Date("2026-05-05T12:00:00.000Z"),
        assignee: leader,
        createdBy: leader,
      },
    ],
    ...overrides,
  };
  return sprint;
}

test("listSprintsBoardService includes sprint gamification impact", async (t) => {
  overridePrismaProperty(t, "team", {
    findUnique: async () => team,
  });
  overridePrismaProperty(t, "sprint", {
    findMany: async () => [buildSprint()],
  });
  overridePrismaProperty(t, "task", {
    findMany: async () => [],
  });

  const board = await listSprintsBoardService({ id: "leader-1", role: "LEADER" });
  assert.equal(board.sprints[0].stats.progress, 100);
  assert.equal(board.sprints[0].tasks[0].gamificationImpact.estimatedXp, 100);
  assert.equal(board.sprints[0].tasks[0].gamificationImpact.effortPoints, 3);
  assert.equal(board.sprints[0].tasks[0].gamificationImpact.eligible, true);
  assert.deepEqual(board.sprints[0].gamificationImpact, {
    eventType: "SPRINT_COMPLETED",
    baseTeamXp: 120,
    completionMultiplier: 1.25,
    estimatedTeamXp: 150,
    eligible: true,
  });
});

test("completeSprintService emits a sprint completion gamification event", async (t) => {
  const previousEnabled = env.gamificationEnabled;
  env.gamificationEnabled = true;
  t.after(() => {
    env.gamificationEnabled = previousEnabled;
  });

  const emitted = [];
  const completedSprint = buildSprint({
    status: "COMPLETED",
    completedAt: new Date("2026-05-14T12:00:00.000Z"),
  });

  overridePrismaProperty(t, "sprint", {
    findUnique: async () => ({
      ...buildSprint(),
      team,
    }),
    update: async () => completedSprint,
  });
  overridePrismaProperty(t, "gamificationEvent", {
    upsert: async (args) => {
      emitted.push(args);
      return { id: "event-1", ...args.create };
    },
  });

  await completeSprintService({ id: "leader-1", role: "LEADER" }, "sprint-1");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].create.eventType, "SPRINT_COMPLETED");
  assert.equal(emitted[0].create.sourceType, "Sprint");
  assert.equal(emitted[0].create.sourceId, "sprint-1");
  assert.equal(emitted[0].create.teamId, "team-1");
  assert.equal(emitted[0].create.payload.completionPercent, 100);
});
