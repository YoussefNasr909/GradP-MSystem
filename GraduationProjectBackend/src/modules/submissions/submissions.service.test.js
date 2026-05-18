import test from "node:test"
import assert from "node:assert/strict"
import { AppError } from "../../common/errors/AppError.js"
import {
  assertPhaseSubmissionGate,
  assertRubricGradeMatches,
  buildContentFingerprint,
  buildSubmissionGamificationEvent,
  extractSubmissionText,
  getEarliestIncompleteRequiredPhase,
  getLatestPhaseSubmission,
  hashUploadedSubmissionText,
  getRubricScaledScore,
  isPhaseUnlockedForSubmission,
  isOptionalEvidenceSubmission,
  normalizeSubmissionText,
  normalizeRubric,
  shouldEnforcePhaseSubmissionGate,
} from "./submissions.service.js"
import { calculateWeightedFinal } from "./evaluation-policy.js"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

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

test("extractSubmissionText reads text uploads for normalized hashing", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gpms-submission-"))
  const filePath = path.join(dir, "submission.txt")
  await fs.writeFile(filePath, "  Hello\nWORLD\t ")

  try {
    const file = { path: filePath, originalname: "submission.txt", mimetype: "text/plain" }
    assert.equal(await extractSubmissionText(file), "  Hello\nWORLD\t ")
    assert.equal(
      await hashUploadedSubmissionText(file),
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    )
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test("extractSubmissionText ignores unsupported uploads", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gpms-submission-"))
  const filePath = path.join(dir, "image.png")
  await fs.writeFile(filePath, "not really an image")

  try {
    assert.equal(
      await extractSubmissionText({ path: filePath, originalname: "image.png", mimetype: "image/png" }),
      null,
    )
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test("buildSubmissionGamificationEvent emits approved event for first final grade", () => {
  const event = buildSubmissionGamificationEvent({
    submission: {
      id: "submission-1",
      teamId: "team-1",
      deliverableType: "SRS",
      sdlcPhase: "REQUIREMENTS",
      version: 1,
      grade: null,
      submittedByUserId: "student-1",
    },
    updatedSubmission: { reviewedAt: new Date("2026-05-17T10:00:00.000Z") },
    actor: { id: "doctor-1" },
    grade: 92,
    wasReGrade: false,
  })

  assert.equal(event.eventType, "SUBMISSION_APPROVED")
  assert.equal(event.idempotencyKey, "SUBMISSION_APPROVED:Submission:submission-1:v1")
  assert.equal(event.payload.grade, 92)
})

test("buildSubmissionGamificationEvent emits grade update event for re-grades", () => {
  const event = buildSubmissionGamificationEvent({
    submission: {
      id: "submission-1",
      teamId: "team-1",
      deliverableType: "SRS",
      sdlcPhase: "REQUIREMENTS",
      version: 1,
      grade: 82,
      submittedByUserId: "student-1",
    },
    updatedSubmission: { reviewedAt: new Date("2026-05-17T10:00:00.000Z") },
    actor: { id: "doctor-1" },
    grade: 90,
    wasReGrade: true,
  })

  assert.equal(event.eventType, "SUBMISSION_GRADE_UPDATED")
  assert.equal(event.idempotencyKey, "SUBMISSION_GRADE_UPDATED:Submission:submission-1:2026-05-17T10:00:00.000Z")
  assert.equal(event.payload.previousGrade, 82)
  assert.equal(event.payload.gradeDelta, 8)
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

test("shouldEnforcePhaseSubmissionGate only gates required non-optional evidence", () => {
  assert.equal(
    shouldEnforcePhaseSubmissionGate({
      deliverableType: "CODE",
      sdlcPhase: "IMPLEMENTATION",
      title: "Source Code",
    }),
    true,
  )
  assert.equal(
    shouldEnforcePhaseSubmissionGate({
      deliverableType: "PROTOTYPE",
      sdlcPhase: "IMPLEMENTATION",
      title: "Prototype",
    }),
    false,
  )
  assert.equal(
    shouldEnforcePhaseSubmissionGate({
      deliverableType: "SRS",
      sdlcPhase: "REQUIREMENTS",
      title: "Optional: User interview notes",
    }),
    false,
  )
})

test("isOptionalEvidenceSubmission detects optional supporting evidence titles", () => {
  assert.equal(isOptionalEvidenceSubmission({ title: " Optional: Survey results " }), true)
  assert.equal(isOptionalEvidenceSubmission({ title: "SRS Document" }), false)
})

test("getEarliestIncompleteRequiredPhase starts at requirements when SRS is not approved", () => {
  assert.equal(getEarliestIncompleteRequiredPhase([]), "REQUIREMENTS")
})

test("getEarliestIncompleteRequiredPhase does not count optional evidence as required approval", () => {
  assert.equal(
    getEarliestIncompleteRequiredPhase([
      {
        sdlcPhase: "REQUIREMENTS",
        deliverableType: "SRS",
        status: "APPROVED",
        title: "Optional: User interview notes",
      },
    ]),
    "REQUIREMENTS",
  )
})

test("getEarliestIncompleteRequiredPhase advances only after required approvals", () => {
  assert.equal(
    getEarliestIncompleteRequiredPhase([
      { sdlcPhase: "REQUIREMENTS", deliverableType: "SRS", status: "APPROVED" },
      { sdlcPhase: "DESIGN", deliverableType: "UML", status: "PENDING" },
      { sdlcPhase: "IMPLEMENTATION", deliverableType: "CODE", status: "APPROVED" },
    ]),
    "DESIGN",
  )
})

test("isPhaseUnlockedForSubmission keeps previous phases open", () => {
  assert.equal(isPhaseUnlockedForSubmission("REQUIREMENTS", "DESIGN"), true)
  assert.equal(isPhaseUnlockedForSubmission("DESIGN", "DESIGN"), true)
  assert.equal(isPhaseUnlockedForSubmission("IMPLEMENTATION", "DESIGN"), false)
})
