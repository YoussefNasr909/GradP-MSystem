import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReleaseCreatedEvent,
  buildSubmissionApprovedEvent,
  buildTaskApprovedEvent,
} from "../../../scripts/backfill-gamification-events.js";

test("buildTaskApprovedEvent creates deterministic task approval backfill payload", () => {
  const reviewedAt = new Date("2026-05-17T10:00:00.000Z");
  const event = buildTaskApprovedEvent({
    id: "task-1",
    teamId: "team-1",
    taskType: "CODE",
    integrationMode: "MANUAL",
    priority: "HIGH",
    storyPoints: 5,
    actualPoints: null,
    assigneeUserId: "student-1",
    reviewedByUserId: "leader-1",
    createdAt: new Date("2026-05-15T10:00:00.000Z"),
    acceptedAt: null,
    submittedForReviewAt: reviewedAt,
    reviewedAt,
    dueDate: new Date("2026-05-20T10:00:00.000Z"),
    updatedAt: reviewedAt,
    githubPullRequestMergedAt: null,
  });

  assert.equal(event.eventType, "TASK_APPROVED");
  assert.equal(event.idempotencyKey, "TASK_APPROVED:Task:task-1:2026-05-17T10:00:00.000Z");
  assert.equal(event.payload.timeliness, "onTime");
  assert.equal(event.payload.evidenceLevel, "manualEvidence");
});

test("buildSubmissionApprovedEvent creates stable first-approval key", () => {
  const event = buildSubmissionApprovedEvent({
    id: "submission-1",
    teamId: "team-1",
    deliverableType: "SRS",
    sdlcPhase: "REQUIREMENTS",
    grade: 93,
    version: 2,
    submittedByUserId: "student-1",
    reviewedByUserId: "doctor-1",
    reviewedAt: new Date("2026-05-17T10:00:00.000Z"),
    createdAt: new Date("2026-05-16T10:00:00.000Z"),
    updatedAt: new Date("2026-05-17T10:00:00.000Z"),
  });

  assert.equal(event.eventType, "SUBMISSION_APPROVED");
  assert.equal(event.idempotencyKey, "SUBMISSION_APPROVED:Submission:submission-1:v2");
  assert.equal(event.payload.backfilled, true);
});

test("buildReleaseCreatedEvent requires repository context", () => {
  assert.equal(buildReleaseCreatedEvent({ githubReleaseId: "release-1", team: null }), null);

  const event = buildReleaseCreatedEvent({
    id: "submission-1",
    teamId: "team-1",
    submittedByUserId: "student-1",
    submittedAt: new Date("2026-05-17T10:00:00.000Z"),
    createdAt: new Date("2026-05-17T10:00:00.000Z"),
    githubReleaseId: "release-1",
    githubReleaseTag: "v1.0.0",
    team: {
      leaderId: "leader-1",
      githubRepository: { id: "repo-1" },
    },
  });

  assert.equal(event.eventType, "GITHUB_RELEASE_CREATED");
  assert.equal(event.idempotencyKey, "GITHUB_RELEASE_CREATED:GitHubTeamRepository:repo-1:release:release-1");
  assert.equal(event.payload.submissionId, "submission-1");
});
