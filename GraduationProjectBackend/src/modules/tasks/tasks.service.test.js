import test from "node:test"
import assert from "node:assert/strict"
import { AppError } from "../../common/errors/AppError.js"
import {
  assertManualTaskHasDraftEvidence,
  buildManualReviewGate,
  buildTaskResubmissionUpdate,
  shouldMergeApprovedTaskPullRequest,
} from "./tasks.service.js"

const reviewer = {
  id: "ta-1",
  role: "TA",
  firstName: "Teaching",
  lastName: "Assistant",
}

const reviewTask = {
  id: "task-1",
  status: "REVIEW",
  githubIssueNumber: 42,
  githubPullRequestNumber: 7,
  githubPullRequestState: "open",
  githubCommitCount: 3,
}

test("buildTaskResubmissionUpdate returns task to To Do and keeps TA review metadata", () => {
  const update = buildTaskResubmissionUpdate(reviewTask, reviewer, "Fix the missing tests and update screenshots.")

  assert.equal(update.status, "TODO")
  assert.equal(update.acceptedAt, null)
  assert.equal(update.submittedForReviewAt, null)
  assert.equal(update.reviewedByUserId, reviewer.id)
  assert.equal(update.reviewFeedback, "Fix the missing tests and update screenshots.")
  assert.equal(update.reviewComment, "Fix the missing tests and update screenshots.")
  assert.equal(update.reviewDecision, "CHANGES_REQUESTED")
  assert.ok(update.reviewedAt instanceof Date)
  assert.equal(update.reviewSnapshot.actorId, reviewer.id)
  assert.equal(update.reviewSnapshot.actorRole, "TA")
  assert.equal(update.reviewSnapshot.taskStatus, "REVIEW")
  assert.equal(update.reviewSnapshot.requestedChanges, true)
})

test("buildTaskResubmissionUpdate requires a review comment", () => {
  assert.throws(
    () => buildTaskResubmissionUpdate(reviewTask, reviewer, "  "),
    (error) =>
      error instanceof AppError &&
      error.code === "TASK_REVIEW_COMMENT_REQUIRED" &&
      error.statusCode === 422,
  )
})

test("shouldMergeApprovedTaskPullRequest only merges when explicitly requested", () => {
  assert.equal(shouldMergeApprovedTaskPullRequest(), false)
  assert.equal(shouldMergeApprovedTaskPullRequest({}), false)
  assert.equal(shouldMergeApprovedTaskPullRequest({ mergePullRequest: false }), false)
  assert.equal(shouldMergeApprovedTaskPullRequest({ mergePullRequest: true }), true)
})

test("buildManualReviewGate requires new draft evidence for manual submission", () => {
  const gate = buildManualReviewGate({
    integrationMode: "MANUAL",
    submissionEvidence: [
      { submittedAt: new Date("2026-05-01T10:00:00.000Z") },
      { submittedAt: null },
    ],
  })

  assert.deepEqual(gate, {
    ready: true,
    draftEvidenceCount: 1,
    submittedEvidenceCount: 1,
    missing: [],
  })

  const resubmissionGate = buildManualReviewGate({
    integrationMode: "MANUAL",
    submissionEvidence: [
      { submittedAt: new Date("2026-05-01T10:00:00.000Z") },
    ],
  })

  assert.deepEqual(resubmissionGate, {
    ready: false,
    draftEvidenceCount: 0,
    submittedEvidenceCount: 1,
    missing: ["manual_evidence"],
  })
})

test("assertManualTaskHasDraftEvidence rejects missing manual evidence", () => {
  assert.throws(
    () => assertManualTaskHasDraftEvidence(0),
    (error) =>
      error instanceof AppError &&
      error.code === "TASK_MANUAL_EVIDENCE_REQUIRED" &&
      error.statusCode === 409,
  )

  assert.doesNotThrow(() => assertManualTaskHasDraftEvidence(1))
})
