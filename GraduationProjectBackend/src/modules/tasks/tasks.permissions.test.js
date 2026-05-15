/**
 * Doctor/TA hardening — Task review permission tests
 *
 * Covers `canReviewTaskTeam` across every combination of:
 *   - actor role (STUDENT, LEADER, TA, DOCTOR, ADMIN, unknown)
 *   - team membership (leader, ta, doctor, member, no-relation)
 *   - missing or malformed input (null actor, null team, no leader, etc.)
 *
 * `canReviewTaskTeam` is the single permission helper that gates approve /
 * reject / list-reviews on a task. Getting it wrong = either silent
 * unauthorized access OR locked-out reviewers. This test set protects
 * against both.
 */
import test from "node:test"
import assert from "node:assert/strict"
import { canReviewTaskTeam } from "./tasks.service.js"

// ──────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────

const teamWithEveryone = {
  id: "team-1",
  leader: { id: "leader-1" },
  ta: { id: "ta-1" },
  doctor: { id: "doctor-1" },
  members: [{ user: { id: "member-1" } }, { user: { id: "member-2" } }],
}

const teamWithoutTa = {
  id: "team-2",
  leader: { id: "leader-2" },
  ta: null,
  doctor: { id: "doctor-2" },
  members: [],
}

const teamWithoutDoctor = {
  id: "team-3",
  leader: { id: "leader-3" },
  ta: { id: "ta-3" },
  doctor: null,
  members: [],
}

const unrelatedDoctor = { id: "doctor-99", role: "DOCTOR" }
const unrelatedTa = { id: "ta-99", role: "TA" }
const unrelatedLeader = { id: "leader-99", role: "LEADER" }
const unrelatedStudent = { id: "student-99", role: "STUDENT" }
const platformAdmin = { id: "admin-1", role: "ADMIN" }

// ──────────────────────────────────────────────────────────────────────────
// LEADER row — team's leader can review their own team's tasks
// ──────────────────────────────────────────────────────────────────────────

test("canReviewTaskTeam: team's leader gets canReview=true with role LEADER", () => {
  const leader = { id: "leader-1", role: "LEADER" }
  const result = canReviewTaskTeam(leader, teamWithEveryone)
  assert.deepEqual(result, { canReview: true, reviewerRole: "LEADER" })
})

test("canReviewTaskTeam: a leader of a DIFFERENT team cannot review this team", () => {
  // Cross-team protection. unrelatedLeader is a LEADER role but not of team-1.
  const result = canReviewTaskTeam(unrelatedLeader, teamWithEveryone)
  assert.deepEqual(result, { canReview: false, reviewerRole: null })
})

// ──────────────────────────────────────────────────────────────────────────
// TA row
// ──────────────────────────────────────────────────────────────────────────

test("canReviewTaskTeam: team's TA gets canReview=true with role TA", () => {
  const ta = { id: "ta-1", role: "TA" }
  assert.deepEqual(canReviewTaskTeam(ta, teamWithEveryone), { canReview: true, reviewerRole: "TA" })
})

test("canReviewTaskTeam: a TA from a different team is blocked", () => {
  assert.deepEqual(canReviewTaskTeam(unrelatedTa, teamWithEveryone), {
    canReview: false,
    reviewerRole: null,
  })
})

test("canReviewTaskTeam: a TA on a team that has no TA assigned is blocked", () => {
  // teamWithoutTa.ta === null — even a TA in this scenario shouldn't pass team check
  const someTa = { id: "ta-99", role: "TA" }
  assert.deepEqual(canReviewTaskTeam(someTa, teamWithoutTa), { canReview: false, reviewerRole: null })
})

// ──────────────────────────────────────────────────────────────────────────
// DOCTOR row — doctors do NOT review tasks (proposals/risks only)
// ──────────────────────────────────────────────────────────────────────────

test("canReviewTaskTeam: doctor (even assigned) cannot review tasks", () => {
  // Task review is leader/TA only by design. Doctor handles proposals, not tasks.
  const assignedDoctor = { id: "doctor-1", role: "DOCTOR" }
  assert.deepEqual(canReviewTaskTeam(assignedDoctor, teamWithEveryone), {
    canReview: false,
    reviewerRole: null,
  })
})

test("canReviewTaskTeam: unrelated doctor cannot review tasks", () => {
  assert.deepEqual(canReviewTaskTeam(unrelatedDoctor, teamWithEveryone), {
    canReview: false,
    reviewerRole: null,
  })
})

// ──────────────────────────────────────────────────────────────────────────
// ADMIN row — platform admin can always review
// ──────────────────────────────────────────────────────────────────────────

test("canReviewTaskTeam: admin can review any team's tasks with role ADMIN", () => {
  assert.deepEqual(canReviewTaskTeam(platformAdmin, teamWithEveryone), {
    canReview: true,
    reviewerRole: "ADMIN",
  })
})

test("canReviewTaskTeam: admin who is also the team's TA gets the more specific TA role", () => {
  // Role-priority: team-level role beats platform admin role label, because the
  // TaskReview audit trail wants to show "they acted as TA on this team."
  const adminWhoIsTa = { id: "ta-1", role: "ADMIN" }
  assert.deepEqual(canReviewTaskTeam(adminWhoIsTa, teamWithEveryone), {
    canReview: true,
    reviewerRole: "TA",
  })
})

test("canReviewTaskTeam: admin who is also the team's leader gets LEADER role", () => {
  const adminWhoIsLeader = { id: "leader-1", role: "ADMIN" }
  assert.deepEqual(canReviewTaskTeam(adminWhoIsLeader, teamWithEveryone), {
    canReview: true,
    reviewerRole: "LEADER",
  })
})

// ──────────────────────────────────────────────────────────────────────────
// STUDENT row — students never review
// ──────────────────────────────────────────────────────────────────────────

test("canReviewTaskTeam: a student team member cannot review", () => {
  const teamMember = { id: "member-1", role: "STUDENT" }
  assert.deepEqual(canReviewTaskTeam(teamMember, teamWithEveryone), {
    canReview: false,
    reviewerRole: null,
  })
})

test("canReviewTaskTeam: unrelated student cannot review", () => {
  assert.deepEqual(canReviewTaskTeam(unrelatedStudent, teamWithEveryone), {
    canReview: false,
    reviewerRole: null,
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Malformed input — never throw, always return a safe default
// ──────────────────────────────────────────────────────────────────────────

test("canReviewTaskTeam: null actor returns false (no crash)", () => {
  assert.deepEqual(canReviewTaskTeam(null, teamWithEveryone), {
    canReview: false,
    reviewerRole: null,
  })
})

test("canReviewTaskTeam: undefined actor returns false (no crash)", () => {
  assert.deepEqual(canReviewTaskTeam(undefined, teamWithEveryone), {
    canReview: false,
    reviewerRole: null,
  })
})

test("canReviewTaskTeam: null team returns false (no crash)", () => {
  const ta = { id: "ta-1", role: "TA" }
  assert.deepEqual(canReviewTaskTeam(ta, null), { canReview: false, reviewerRole: null })
})

test("canReviewTaskTeam: undefined team returns false (no crash)", () => {
  const ta = { id: "ta-1", role: "TA" }
  assert.deepEqual(canReviewTaskTeam(ta, undefined), { canReview: false, reviewerRole: null })
})

test("canReviewTaskTeam: team with no leader and no TA, admin still passes", () => {
  const emptyTeam = { id: "team-x", leader: null, ta: null, doctor: null, members: [] }
  assert.deepEqual(canReviewTaskTeam(platformAdmin, emptyTeam), {
    canReview: true,
    reviewerRole: "ADMIN",
  })
})

test("canReviewTaskTeam: team with no leader and no TA, regular roles fail", () => {
  const emptyTeam = { id: "team-x", leader: null, ta: null, doctor: null, members: [] }
  const ta = { id: "ta-99", role: "TA" }
  assert.deepEqual(canReviewTaskTeam(ta, emptyTeam), { canReview: false, reviewerRole: null })
})

// ──────────────────────────────────────────────────────────────────────────
// Unknown role — should be denied
// ──────────────────────────────────────────────────────────────────────────

test("canReviewTaskTeam: actor with unknown role gets denied (fail-closed)", () => {
  const intruder = { id: "x", role: "SUPER_HACKER" }
  assert.deepEqual(canReviewTaskTeam(intruder, teamWithEveryone), {
    canReview: false,
    reviewerRole: null,
  })
})

test("canReviewTaskTeam: actor with empty-string role gets denied", () => {
  const broken = { id: "x", role: "" }
  assert.deepEqual(canReviewTaskTeam(broken, teamWithEveryone), {
    canReview: false,
    reviewerRole: null,
  })
})

test("canReviewTaskTeam: actor with missing role still resolved by team-membership match", () => {
  // If `actor.id` matches `team.leader.id`, we accept them as LEADER even if
  // the role field on the auth user record is somehow wrong/missing. Defence
  // in depth — the team-membership signal is the source of truth.
  const noRoleLeader = { id: "leader-1" }
  assert.deepEqual(canReviewTaskTeam(noRoleLeader, teamWithEveryone), {
    canReview: true,
    reviewerRole: "LEADER",
  })
})
