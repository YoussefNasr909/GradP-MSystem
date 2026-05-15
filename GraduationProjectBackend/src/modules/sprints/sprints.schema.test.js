import assert from "node:assert/strict";
import test from "node:test";
import {
  createSprintSchema,
  reviewSprintEvaluationSchema,
  upsertSprintEvaluationSchema,
} from "./sprints.schema.js";

test("createSprintSchema requires the end date to be after the start date", () => {
  const result = createSprintSchema.safeParse({
    body: {
      name: "Sprint 1",
      startDate: "2026-05-20",
      endDate: "2026-05-20",
      status: "PLANNED",
    },
    params: {},
    query: {},
  });

  assert.equal(result.success, false);
  assert.equal(result.error.issues[0]?.path.join("."), "body.endDate");
});

test("upsertSprintEvaluationSchema accepts a submitted evaluation with criteria", () => {
  const result = upsertSprintEvaluationSchema.safeParse({
    body: {
      status: "SUBMITTED",
      feedback: "Good sprint execution with clear follow-up items.",
      criteria: {
        planningQuality: 17,
        taskCompletion: 18,
        progressConsistency: 16,
        teamCollaboration: 18,
        deadlineCommitment: 17,
      },
    },
    params: { id: "sprint_1" },
    query: {},
  });

  assert.equal(result.success, true);
});

test("upsertSprintEvaluationSchema rejects submitted evaluations with missing criteria", () => {
  const result = upsertSprintEvaluationSchema.safeParse({
    body: {
      status: "SUBMITTED",
      feedback: "Good work overall.",
      criteria: {
        planningQuality: 17,
      },
    },
    params: { id: "sprint_1" },
    query: {},
  });

  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((issue) => issue.path.join(".") === "body.criteria.taskCompletion"));
});

test("reviewSprintEvaluationSchema only accepts review statuses", () => {
  const result = reviewSprintEvaluationSchema.safeParse({
    body: {
      status: "SUBMITTED",
      reviewComment: "This should be rejected by the review schema.",
    },
    params: { id: "sprint_1", evaluationId: "evaluation_1" },
    query: {},
  });

  assert.equal(result.success, false);
});
