/**
 * Doctor/TA hardening — Sprint evaluation permission tests
 *
 * Sprint evaluations have a bifurcated workflow:
 *   - WRITE side: only the team's assigned TA can save / submit an evaluation.
 *     (Doctors do not write evaluations. Leaders/members never can. Admins
 *      review but don't author one.)
 *   - REVIEW side: only admins finalise / approve / reject a submitted TA
 *     evaluation. The team's doctor / TA / leader can VIEW but not finalise.
 *
 * These tests cover the WRITE-side helper `getActorEvaluationRole`, which is
 * the single point that authorises a sprint-evaluation upsert. If this is
 * wrong, an unrelated TA could write fake evaluations for any team.
 */
import test from "node:test"
import assert from "node:assert/strict"
import { getActorEvaluationRole } from "./sprints.service.js"

const team = {
  id: "team-1",
  leader: { id: "leader-1" },
  ta: { id: "ta-1" },
  doctor: { id: "doctor-1" },
}

const otherTeam = {
  id: "team-2",
  leader: { id: "leader-2" },
  ta: { id: "ta-2" },
  doctor: { id: "doctor-2" },
}

// ──────────────────────────────────────────────────────────────────────────
// Happy path
// ──────────────────────────────────────────────────────────────────────────

test("assigned TA gets 'TA' role label", () => {
  const ta = { id: "ta-1", role: "TA" }
  assert.equal(getActorEvaluationRole(ta, team), "TA")
})

// ──────────────────────────────────────────────────────────────────────────
// Cross-team isolation — a TA from one team cannot write on another
// ──────────────────────────────────────────────────────────────────────────

test("TA from a different team cannot write (cross-team isolation)", () => {
  const otherTa = { id: "ta-2", role: "TA" }
  assert.equal(getActorEvaluationRole(otherTa, team), null)
})

// ──────────────────────────────────────────────────────────────────────────
// Other roles — explicitly denied
// ──────────────────────────────────────────────────────────────────────────

test("doctor cannot write a sprint evaluation (read/view only)", () => {
  // Doctors see the eval after the TA finalises but they don't author one.
  const doctor = { id: "doctor-1", role: "DOCTOR" }
  assert.equal(getActorEvaluationRole(doctor, team), null)
})

test("team leader cannot write a sprint evaluation on their own team", () => {
  const leader = { id: "leader-1", role: "LEADER" }
  assert.equal(getActorEvaluationRole(leader, team), null)
})

test("student team member cannot write", () => {
  const member = { id: "member-1", role: "STUDENT" }
  assert.equal(getActorEvaluationRole(member, team), null)
})

test("admin cannot author a sprint evaluation (admin REVIEWS via a different helper)", () => {
  // Admins go through assertCanReviewSprintEvaluation to finalise a TA's
  // submitted evaluation. They never author one themselves.
  const admin = { id: "admin-1", role: "ADMIN" }
  assert.equal(getActorEvaluationRole(admin, team), null)
})

// ──────────────────────────────────────────────────────────────────────────
// Spoofing prevention — having the right ID but wrong role still denies
// ──────────────────────────────────────────────────────────────────────────

test("an actor with TA id but a non-TA role string is denied", () => {
  // Defence in depth: even if some other table assigned an id to ta slot
  // for some reason, the actor's auth role must also be TA.
  const spoofed = { id: "ta-1", role: "STUDENT" }
  assert.equal(getActorEvaluationRole(spoofed, team), null)
})

test("an actor with TA role but matching another team's ta id is denied", () => {
  // We compare `team.ta.id === actor.id` — so a TA who somehow knows team-1's
  // ta slot id but whose own id is different can't bypass.
  const wrongIdTa = { id: "ta-99", role: "TA" }
  assert.equal(getActorEvaluationRole(wrongIdTa, team), null)
})

// ──────────────────────────────────────────────────────────────────────────
// Malformed input — never throw, always return null safely
// ──────────────────────────────────────────────────────────────────────────

test("null actor → null", () => {
  assert.equal(getActorEvaluationRole(null, team), null)
})

test("undefined actor → null", () => {
  assert.equal(getActorEvaluationRole(undefined, team), null)
})

test("null team → null", () => {
  const ta = { id: "ta-1", role: "TA" }
  assert.equal(getActorEvaluationRole(ta, null), null)
})

test("undefined team → null", () => {
  const ta = { id: "ta-1", role: "TA" }
  assert.equal(getActorEvaluationRole(ta, undefined), null)
})

test("team with no TA assigned → null even for a TA-role actor", () => {
  const noTa = { id: "t", leader: { id: "l" }, ta: null, doctor: { id: "d" } }
  const ta = { id: "ta-1", role: "TA" }
  assert.equal(getActorEvaluationRole(ta, noTa), null)
})

// ──────────────────────────────────────────────────────────────────────────
// Verify the cross-team isolation is symmetrical
// ──────────────────────────────────────────────────────────────────────────

test("TAs of two different teams can each only write on their own team", () => {
  const ta1 = { id: "ta-1", role: "TA" }
  const ta2 = { id: "ta-2", role: "TA" }
  assert.equal(getActorEvaluationRole(ta1, team), "TA")
  assert.equal(getActorEvaluationRole(ta1, otherTeam), null)
  assert.equal(getActorEvaluationRole(ta2, otherTeam), "TA")
  assert.equal(getActorEvaluationRole(ta2, team), null)
})
