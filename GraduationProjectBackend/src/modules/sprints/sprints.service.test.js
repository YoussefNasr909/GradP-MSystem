import assert from "node:assert/strict";
import test from "node:test";
import { env } from "../../config/env.js";
import { prisma } from "../../loaders/dbLoader.js";
import {
  completeSprintService,
  listSprintsBoardService,
  reviewSprintEvaluationService,
  updateSprintService,
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

const doctor = {
  ...leader,
  id: "doctor-1",
  firstName: "Sprint",
  lastName: "Doctor",
  email: "doctor@example.com",
  role: "DOCTOR",
};

const ta = {
  ...leader,
  id: "ta-1",
  firstName: "Sprint",
  lastName: "TA",
  email: "ta@example.com",
  role: "TA",
};

const member = {
  ...leader,
  id: "member-1",
  firstName: "Team",
  lastName: "Member",
  email: "member@example.com",
  role: "STUDENT",
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
  doctor,
  ta,
  members: [{ id: "membership-1", joinedAt: new Date("2026-05-01T00:00:00.000Z"), user: member }],
};

function buildEvaluation(status, overrides = {}) {
  return {
    id: `evaluation-${status.toLowerCase().replace("_", "-")}`,
    sprintId: "sprint-1",
    evaluatorUserId: ta.id,
    evaluatorRole: "TA",
    status,
    score: status === "DRAFT" ? null : 84,
    feedback: status === "DRAFT" ? null : "Solid sprint execution with clear next steps.",
    planningQuality: status === "DRAFT" ? null : 17,
    taskCompletion: status === "DRAFT" ? null : 16,
    progressConsistency: status === "DRAFT" ? null : 16,
    teamCollaboration: status === "DRAFT" ? null : 18,
    deadlineCommitment: status === "DRAFT" ? null : 17,
    earlyEvaluation: false,
    evaluatedAt: status === "DRAFT" ? null : new Date("2026-05-14T12:00:00.000Z"),
    reviewedByUserId: status === "APPROVED" ? "admin-1" : null,
    reviewedAt: status === "APPROVED" ? new Date("2026-05-15T12:00:00.000Z") : null,
    reviewComment: status === "APPROVED" ? "Approved." : null,
    finalizedAt: status === "APPROVED" ? new Date("2026-05-15T12:00:00.000Z") : null,
    createdAt: new Date("2026-05-14T10:00:00.000Z"),
    updatedAt: new Date("2026-05-14T12:00:00.000Z"),
    evaluator: ta,
    reviewedBy: status === "APPROVED" ? { ...leader, id: "admin-1", email: "admin@example.com", role: "ADMIN" } : null,
    ...overrides,
  };
}

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

test("listSprintsBoardService applies sprint completion XP multiplier thresholds", async (t) => {
  const baseTask = buildSprint().tasks[0];
  const progressCases = [
    { id: "sprint-59", progress: 59, multiplier: 0, estimatedTeamXp: 0 },
    { id: "sprint-60", progress: 60, multiplier: 0.4, estimatedTeamXp: 48 },
    { id: "sprint-70", progress: 70, multiplier: 0.7, estimatedTeamXp: 84 },
    { id: "sprint-80", progress: 80, multiplier: 1.0, estimatedTeamXp: 120 },
    { id: "sprint-90", progress: 90, multiplier: 1.25, estimatedTeamXp: 150 },
  ];
  const sprints = progressCases.map(({ id, progress }, index) =>
    buildSprint({
      id,
      name: `Threshold ${progress}`,
      startDate: new Date(`2026-05-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
      endDate: new Date(`2026-05-${String(index + 2).padStart(2, "0")}T23:59:59.999Z`),
      tasks: [
        {
          ...baseTask,
          id: `${id}-done`,
          sprintId: id,
          status: "DONE",
          storyPoints: progress,
          actualPoints: progress,
        },
        {
          ...baseTask,
          id: `${id}-todo`,
          sprintId: id,
          status: "TODO",
          storyPoints: 100 - progress,
          actualPoints: null,
        },
      ],
    }),
  );

  overridePrismaProperty(t, "team", {
    findUnique: async () => team,
  });
  overridePrismaProperty(t, "sprint", {
    findMany: async () => sprints,
  });
  overridePrismaProperty(t, "task", {
    findMany: async () => [],
  });

  const board = await listSprintsBoardService({ id: "leader-1", role: "LEADER" });
  const impactsById = new Map(board.sprints.map((sprint) => [sprint.id, sprint.gamificationImpact]));

  for (const { id, multiplier, estimatedTeamXp } of progressCases) {
    assert.equal(impactsById.get(id).completionMultiplier, multiplier);
    assert.equal(impactsById.get(id).estimatedTeamXp, estimatedTeamXp);
  }
});

test("listSprintsBoardService only exposes approved evaluations to leaders and members", async (t) => {
  const sprint = buildSprint({
    evaluations: [
      buildEvaluation("DRAFT"),
      buildEvaluation("SUBMITTED"),
      buildEvaluation("NEEDS_CHANGES"),
      buildEvaluation("REJECTED"),
      buildEvaluation("APPROVED"),
    ],
  });

  overridePrismaProperty(t, "team", {
    findUnique: async () => team,
  });
  overridePrismaProperty(t, "teamMember", {
    findUnique: async () => ({ id: "membership-1", userId: member.id, joinedAt: new Date("2026-05-01T00:00:00.000Z"), team }),
  });
  overridePrismaProperty(t, "sprint", {
    findMany: async () => [sprint],
  });
  overridePrismaProperty(t, "task", {
    findMany: async () => [],
  });

  const leaderBoard = await listSprintsBoardService({ id: leader.id, role: "LEADER" });
  assert.deepEqual(leaderBoard.sprints[0].evaluations.map((evaluation) => evaluation.status), ["APPROVED"]);
  assert.equal(leaderBoard.metrics.evaluations.total, 1);
  assert.equal(leaderBoard.metrics.evaluations.approved, 1);
  assert.equal(leaderBoard.metrics.evaluations.submitted, 0);

  const memberBoard = await listSprintsBoardService({ id: member.id, role: "STUDENT" });
  assert.deepEqual(memberBoard.sprints[0].evaluations.map((evaluation) => evaluation.status), ["APPROVED"]);
  assert.equal(memberBoard.metrics.evaluations.total, 1);
});

test("listSprintsBoardService exposes all evaluation statuses to assigned staff and admins", async (t) => {
  const sprint = buildSprint({
    evaluations: [
      buildEvaluation("DRAFT"),
      buildEvaluation("SUBMITTED"),
      buildEvaluation("NEEDS_CHANGES"),
      buildEvaluation("REJECTED"),
      buildEvaluation("APPROVED"),
    ],
  });

  overridePrismaProperty(t, "team", {
    findUnique: async () => team,
  });
  overridePrismaProperty(t, "sprint", {
    findMany: async () => [sprint],
  });
  overridePrismaProperty(t, "task", {
    findMany: async () => [],
  });

  const expectedStatuses = ["DRAFT", "SUBMITTED", "NEEDS_CHANGES", "REJECTED", "APPROVED"];
  const doctorBoard = await listSprintsBoardService({ id: doctor.id, role: "DOCTOR" }, { teamId: team.id });
  assert.deepEqual(doctorBoard.sprints[0].evaluations.map((evaluation) => evaluation.status), expectedStatuses);
  assert.equal(doctorBoard.permissions.canReviewEvaluations, false);

  const taBoard = await listSprintsBoardService({ id: ta.id, role: "TA" }, { teamId: team.id });
  assert.deepEqual(taBoard.sprints[0].evaluations.map((evaluation) => evaluation.status), expectedStatuses);
  assert.equal(taBoard.permissions.canEvaluate, true);

  const adminBoard = await listSprintsBoardService({ id: "admin-1", role: "ADMIN" }, { teamId: team.id });
  assert.deepEqual(adminBoard.sprints[0].evaluations.map((evaluation) => evaluation.status), expectedStatuses);
  assert.equal(adminBoard.permissions.canReviewEvaluations, true);
});

test("reviewSprintEvaluationService keeps sprint evaluation review admin-only", async (t) => {
  const submittedEvaluation = buildEvaluation("SUBMITTED", {
    sprint: {
      ...buildSprint({ evaluations: [] }),
      team,
    },
  });
  let updateCalled = false;

  overridePrismaProperty(t, "sprintEvaluation", {
    findUnique: async () => submittedEvaluation,
    update: async (args) => {
      updateCalled = true;
      return buildEvaluation(args.data.status, {
        reviewedByUserId: args.data.reviewedByUserId,
        reviewedAt: args.data.reviewedAt,
        reviewComment: args.data.reviewComment,
        finalizedAt: args.data.finalizedAt,
        reviewedBy: { ...leader, id: args.data.reviewedByUserId, email: "admin@example.com", role: "ADMIN" },
      });
    },
  });

  await assert.rejects(
    () => reviewSprintEvaluationService({ id: doctor.id, role: "DOCTOR" }, "sprint-1", "evaluation-submitted", { status: "NEEDS_CHANGES" }),
    (error) => error.statusCode === 403 && error.code === "SPRINT_EVALUATION_REVIEW_FORBIDDEN",
  );
  assert.equal(updateCalled, false);

  const reviewed = await reviewSprintEvaluationService(
    { id: "admin-1", role: "ADMIN" },
    "sprint-1",
    "evaluation-submitted",
    { status: "NEEDS_CHANGES", reviewComment: "Please clarify the team collaboration score." },
  );

  assert.equal(updateCalled, true);
  assert.equal(reviewed.status, "NEEDS_CHANGES");
  assert.equal(reviewed.permissions.canReview, true);
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
  assert.equal(emitted[0].create.idempotencyKey, "SPRINT_COMPLETED:Sprint:sprint-1");
  assert.equal(emitted[0].where.idempotencyKey, "SPRINT_COMPLETED:Sprint:sprint-1");
  assert.equal(emitted[0].create.payload.completedTasks, 1);
  assert.equal(emitted[0].create.payload.totalStoryPoints, 3);
  assert.equal(emitted[0].create.payload.completedStoryPoints, 3);
  assert.equal(emitted[0].create.payload.completionPercent, 100);
  assert.equal(emitted[0].create.payload.grade, 100);
});

test("updateSprintService emits one sprint completion event when status changes to completed", async (t) => {
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
    update: async (args) => {
      assert.equal(args.data.status, "COMPLETED");
      assert.ok(args.data.completedAt instanceof Date);
      return completedSprint;
    },
  });
  overridePrismaProperty(t, "gamificationEvent", {
    upsert: async (args) => {
      emitted.push(args);
      return { id: "event-1", ...args.create };
    },
  });

  const updated = await updateSprintService(
    { id: "leader-1", role: "LEADER" },
    "sprint-1",
    { status: "COMPLETED" },
  );
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(updated.status, "COMPLETED");
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].create.eventType, "SPRINT_COMPLETED");
  assert.equal(emitted[0].create.sourceType, "Sprint");
  assert.equal(emitted[0].create.sourceId, "sprint-1");
  assert.equal(emitted[0].create.teamId, "team-1");
  assert.equal(emitted[0].create.idempotencyKey, "SPRINT_COMPLETED:Sprint:sprint-1");
  assert.deepEqual(emitted[0].where, { idempotencyKey: "SPRINT_COMPLETED:Sprint:sprint-1" });
  assert.equal(emitted[0].create.payload.completedTasks, 1);
  assert.equal(emitted[0].create.payload.totalTasks, 1);
  assert.equal(emitted[0].create.payload.completionPercent, 100);
});
