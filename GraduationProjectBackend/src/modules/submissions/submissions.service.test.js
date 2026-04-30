import test from "node:test"
import assert from "node:assert/strict"
import { AppError } from "../../common/errors/AppError.js"
import { assertPhaseSubmissionGate, getLatestPhaseSubmission } from "./submissions.service.js"

test("getLatestPhaseSubmission returns the newest phase item", () => {
  const latest = getLatestPhaseSubmission([
    { id: "latest", status: "PENDING", deliverableType: "CODE" },
    { id: "older", status: "APPROVED", deliverableType: "PROTOTYPE" },
  ])

  assert.equal(latest?.id, "latest")
})

test("assertPhaseSubmissionGate allows the first submission in a phase", () => {
  assert.doesNotThrow(() => {
    assertPhaseSubmissionGate([], "SRS", "REQUIREMENTS")
  })
})

test("assertPhaseSubmissionGate blocks another deliverable while review is pending", () => {
  assert.throws(
    () =>
      assertPhaseSubmissionGate(
        [{ deliverableType: "CODE", status: "PENDING" }],
        "PROTOTYPE",
        "IMPLEMENTATION",
      ),
    (error) =>
      error instanceof AppError &&
      error.code === "SUBMISSION_PHASE_REVIEW_PENDING" &&
      error.statusCode === 409,
  )
})

test("assertPhaseSubmissionGate blocks a different deliverable when revision is required", () => {
  assert.throws(
    () =>
      assertPhaseSubmissionGate(
        [{ deliverableType: "CODE", status: "REVISION_REQUIRED" }],
        "PROTOTYPE",
        "IMPLEMENTATION",
      ),
    (error) =>
      error instanceof AppError &&
      error.code === "SUBMISSION_PHASE_LOCKED_BY_REVISION" &&
      error.statusCode === 409,
  )
})

test("assertPhaseSubmissionGate allows re-submitting the same deliverable after revision", () => {
  assert.doesNotThrow(() => {
    assertPhaseSubmissionGate(
      [{ deliverableType: "CODE", status: "REVISION_REQUIRED" }],
      "CODE",
      "IMPLEMENTATION",
    )
  })
})

test("assertPhaseSubmissionGate allows the next deliverable after approval", () => {
  assert.doesNotThrow(() => {
    assertPhaseSubmissionGate(
      [{ deliverableType: "CODE", status: "APPROVED" }],
      "PROTOTYPE",
      "IMPLEMENTATION",
    )
  })
})
