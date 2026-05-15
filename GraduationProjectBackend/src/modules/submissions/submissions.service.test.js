import test from "node:test"
import assert from "node:assert/strict"
import { AppError } from "../../common/errors/AppError.js"
import {
  assertPhaseSubmissionGate,
  assertRubricGradeMatches,
  buildContentFingerprint,
  getLatestPhaseSubmission,
  getRubricScaledScore,
  normalizeSubmissionText,
  normalizeRubric,
} from "./submissions.service.js"
import { calculateWeightedFinal } from "./evaluation-policy.js"

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

test("normalizeRubric rejects criterion scores over max score", () => {
  assert.throws(
    () => normalizeRubric([{ name: "Quality", score: 11, maxScore: 10 }]),
    (error) =>
      error instanceof AppError &&
      error.code === "RUBRIC_SCORE_EXCEEDS_MAX" &&
      error.statusCode === 422,
  )
})

test("buildContentFingerprint is deterministic for the same uploaded content context", () => {
  const first = buildContentFingerprint({
    fileHash: "abc123",
    deliverableType: "SRS",
    sdlcPhase: "REQUIREMENTS",
    fileSize: 4096,
  })
  const second = buildContentFingerprint({
    fileHash: "abc123",
    deliverableType: "SRS",
    sdlcPhase: "REQUIREMENTS",
    fileSize: 4096,
  })

  assert.equal(first, second)
  assert.equal(typeof first, "string")
  assert.equal(first.length, 64)
})

test("normalizeSubmissionText is case and whitespace stable", () => {
  assert.equal(normalizeSubmissionText("  Hello\nWORLD\t "), "hello world")
})

test("getRubricScaledScore scales rubric totals to 100", () => {
  assert.equal(
    getRubricScaledScore([
      { name: "A", score: 8, maxScore: 10 },
      { name: "B", score: 12, maxScore: 20 },
    ]),
    67,
  )
})

test("assertRubricGradeMatches requires a reason when grade differs from rubric total", () => {
  assert.throws(
    () =>
      assertRubricGradeMatches({
        grade: 90,
        rubric: [{ name: "Quality", score: 8, maxScore: 10 }],
        overrideReason: "",
      }),
    (error) =>
      error instanceof AppError &&
      error.code === "RUBRIC_OVERRIDE_REASON_REQUIRED" &&
      error.statusCode === 422,
  )
})

test("assertRubricGradeMatches allows explicit grade override with reason", () => {
  assert.equal(
    assertRubricGradeMatches({
      grade: 90,
      rubric: [{ name: "Quality", score: 8, maxScore: 10 }],
      overrideReason: "Excellent live defense",
    }),
    80,
  )
})

test("calculateWeightedFinal marks incomplete scores until all weighted phases exist", () => {
  const result = calculateWeightedFinal({ REQUIREMENTS: 90, DESIGN: 80 })

  assert.equal(result.weightedFinal, 84)
  assert.equal(result.isFinalComplete, false)
  assert.deepEqual(result.missingWeightedPhases, ["IMPLEMENTATION", "TESTING", "DEPLOYMENT"])
})
