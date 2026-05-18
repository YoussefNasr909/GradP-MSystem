/**
 * Doctor/TA hardening — Task review flow tests
 *
 * Integration-style tests over the pure functions in the task review pipeline:
 *   - `assertTaskReviewer` (the gate at the start of approve/reject)
 *   - `buildTaskResubmissionUpdate` (the update payload + snapshot)
 *
 * Scenarios:
 *   - Both LEADER and TA can act as reviewers (multi-reviewer feature)
 *   - Cross-team reviewers are rejected with 403 TASK_REVIEWER_ONLY
 *   - The snapshot records the right reviewerRole label for audit
 *   - Resubmission update wipes acceptance/submission state and sets
 *     reviewDecision=CHANGES_REQUESTED
 */
import test from "node:test"
import assert from "node:assert/strict"
import { AppError } from "../../common/errors/AppError.js"
import {
  assertTaskReviewer,
  buildTaskResubmissionUpdate,
} from "./tasks.service.js"

const team = {
  id: "team-1",
  leader: { id: "leader-1" },
  ta: { id: "ta-1" },
  doctor: { id: "doctor-1" },
  members: [{ user: { id: "member-1" } }],
}

const task = {
  id: "task-1",
  status: "REVIEW",
  team,
}

const teamLeader = { id: "leader-1", role: "LEADER", firstName: "Lana", lastName: "Leader" }
const teamTa = { id: "ta-1", role: "TA", firstName: "Tao", lastName: "Atom" }
const platformAdmin = { id: "admin-1", role: "ADMIN", firstName: "Avery", lastName: "Admin" }
const teamMember = { id: "member-1", role: "STUDENT", firstName: "Mona", lastName: "Member" }
const unrelatedTa = { id: "ta-99", role: "TA", firstName: "Other", lastName: "Tee" }

// ──────────────────────────────────────────────────────────────────────────
// assertTaskReviewer — the gate
// ──────────────────────────────────────────────────────────────────────────

test("assertTaskReviewer: team leader is allowed and returns role LEADER", () => {
  const role = assertTaskReviewer(task, teamLeader)
  assert.equal(role, "LEADER")
})

test("assertTaskReviewer: team TA is allowed and returns role TA", () => {
  const role = assertTaskReviewer(task, teamTa)
  assert.equal(role, "TA")
})

test("assertTaskReviewer: admin is allowed and returns role ADMIN (unless they're also team-level)", () => {
  const role = assertTaskReviewer(task, platformAdmin)
  assert.equal(role, "ADMIN")
})

test("assertTaskReviewer: a team member (student) is denied with 403 TASK_REVIEWER_ONLY", () => {
  assert.throws(
    () => assertTaskReviewer(task, teamMember),
    (error) =>
      error instanceof AppError &&
      error.code === "TASK_REVIEWER_ONLY" &&
      error.statusCode === 403,
  )
})

test("assertTaskReviewer: a TA from a different team is denied (cross-team)", () => {
  assert.throws(
    () => assertTaskReviewer(task, unrelatedTa),
    (error) =>
      error instanceof AppError &&
      error.code === "TASK_REVIEWER_ONLY" &&
      error.statusCode === 403,
  )
})

test("assertTaskReviewer: task with no team is denied (defensive)", () => {
  const orphan = { id: "x", status: "REVIEW", team: null }
  assert.throws(
    () => assertTaskReviewer(orphan, teamTa),
    (error) =>
      error instanceof AppError &&
      error.code === "TASK_REVIEWER_ONLY",
  )
})

test("assertTaskReviewer: missing task (undefined) is denied without crashing", () => {
  assert.throws(
    () => assertTaskReviewer(undefined, teamTa),
    (error) => error instanceof AppError && error.code === "TASK_REVIEWER_ONLY",
  )
})

// ──────────────────────────────────────────────────────────────────────────
// buildTaskResubmissionUpdate — output payload shape
// ──────────────────────────────────────────────────────────────────────────

test("buildTaskResubmissionUpdate by LEADER: snapshot.actorRole reflects auth role 'LEADER'", () => {
  // The snapshot's `actorRole` records the auth-role on the actor (LEADER /
  // TA / ADMIN). Reviewers using this helper directly don't pass reviewerRole;
  // the audit captures actor.role.
  const update = buildTaskResubmissionUpdate(
    task,
    teamLeader,
    "Add the missing unit tests, then resubmit.",
  )
  assert.equal(update.reviewSnapshot.actorId, "leader-1")
  assert.equal(update.reviewSnapshot.actorRole, "LEADER")
  assert.equal(update.reviewSnapshot.taskStatus, "REVIEW")
  assert.equal(update.reviewSnapshot.requestedChanges, true)
  assert.equal(update.status, "TODO")
  assert.equal(update.acceptedAt, null)
  assert.equal(update.submittedForReviewAt, null)
  assert.equal(update.reviewDecision, "CHANGES_REQUESTED")
})

test("buildTaskResubmissionUpdate by TA: same fields populated for TA-side review", () => {
  const update = buildTaskResubmissionUpdate(
    task,
    teamTa,
    "Resubmit — the screenshot is missing.",
  )
  assert.equal(update.reviewSnapshot.actorId, "ta-1")
  assert.equal(update.reviewSnapshot.actorRole, "TA")
})

test("buildTaskResubmissionUpdate: same actor cannot bypass with weird comment shapes", () => {
  // Numbers, objects, arrays — all caught by REQUIRED in
  // assertReviewCommentMeetsMinimum.
  assert.throws(
    () => buildTaskResubmissionUpdate(task, teamTa, { msg: "x".repeat(50) }),
    (error) =>
      error instanceof AppError &&
      (error.code === "TASK_REVIEW_COMMENT_REQUIRED" || error.code === "TASK_REVIEW_COMMENT_TOO_SHORT"),
  )
  assert.throws(
    () => buildTaskResubmissionUpdate(task, teamTa, ["hi"]),
    (error) =>
      error instanceof AppError &&
      (error.code === "TASK_REVIEW_COMMENT_REQUIRED" || error.code === "TASK_REVIEW_COMMENT_TOO_SHORT"),
  )
})

test("buildTaskResubmissionUpdate: review note preserved on payload (no truncation)", () => {
  const note = "This is a thorough resubmission request explaining exactly what to fix and why."
  const update = buildTaskResubmissionUpdate(task, teamTa, note)
  assert.equal(update.reviewComment, note)
  assert.equal(update.reviewFeedback, note)
})

test("buildTaskResubmissionUpdate: snapshot taskStatus reflects current task status (REVIEW → TODO transition)", () => {
  // If task starts at REVIEW, snapshot records that. If task was somehow at
  // APPROVED when reject is called, snapshot would record APPROVED (this is
  // the supplementary-review path, but buildTaskResubmissionUpdate itself
  // doesn't differentiate — its caller does).
  const approvedTask = { ...task, status: "APPROVED" }
  const update = buildTaskResubmissionUpdate(approvedTask, teamLeader, "Long enough comment.")
  assert.equal(update.reviewSnapshot.taskStatus, "APPROVED")
})

test("buildTaskResubmissionUpdate: reviewedAt is a fresh Date (recent within a second)", () => {
  const before = Date.now()
  const update = buildTaskResubmissionUpdate(task, teamLeader, "Long enough comment.")
  const after = Date.now()
  assert.ok(update.reviewedAt instanceof Date)
  const t = update.reviewedAt.getTime()
  assert.ok(t >= before && t <= after + 5, `reviewedAt ${t} not within [${before}, ${after}]`)
})
