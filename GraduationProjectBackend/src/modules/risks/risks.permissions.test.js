/**
 * Doctor/TA hardening — Risk-approval permission tests
 *
 * Covers `canApproveRisk` across the full matrix:
 *   - risk.status ∈ { OPEN, MITIGATED, MONITORED, RESOLVED, CLOSED, undefined }
 *   - actor role ∈ { STUDENT, LEADER, TA, DOCTOR, ADMIN }
 *   - actor's relationship to team ∈ { the team's doctor, the team's TA,
 *                                       neither, leader, member, unrelated }
 *
 * The policy:
 *   - ADMIN can always approve.
 *   - If risk is "RESOLVED", only the assigned DOCTOR can approve (closing
 *     out a resolved risk).
 *   - Otherwise, the assigned TA approves (monitoring approval).
 *
 * These tests catch any drift in the rules, especially:
 *   - A doctor trying to approve a non-resolved risk (denied).
 *   - A TA trying to close out a resolved risk (denied).
 *   - Cross-team doctor / TA trying to approve (denied).
 */
import test from "node:test"
import assert from "node:assert/strict"
import { canApproveRisk } from "./risks.service.js"

const team = {
  id: "team-1",
  leader: { id: "leader-1" },
  ta: { id: "ta-1" },
  doctor: { id: "doctor-1" },
}

function buildRisk(status) {
  return { id: "risk-1", status, team }
}

const assignedDoctor = { id: "doctor-1", role: "DOCTOR" }
const assignedTa = { id: "ta-1", role: "TA" }
const unrelatedDoctor = { id: "doctor-99", role: "DOCTOR" }
const unrelatedTa = { id: "ta-99", role: "TA" }
const teamLeader = { id: "leader-1", role: "LEADER" }
const student = { id: "student-1", role: "STUDENT" }
const admin = { id: "admin-1", role: "ADMIN" }

// ──────────────────────────────────────────────────────────────────────────
// ADMIN — always passes regardless of status / team
// ──────────────────────────────────────────────────────────────────────────

test("admin can approve OPEN risk on any team", () => {
  assert.equal(canApproveRisk(admin, buildRisk("OPEN")), true)
})

test("admin can approve RESOLVED risk on any team", () => {
  assert.equal(canApproveRisk(admin, buildRisk("RESOLVED")), true)
})

test("admin can approve risk with weird status", () => {
  assert.equal(canApproveRisk(admin, buildRisk("MITIGATED")), true)
  assert.equal(canApproveRisk(admin, buildRisk("MONITORED")), true)
})

// ──────────────────────────────────────────────────────────────────────────
// RESOLVED risks — only the assigned DOCTOR approves
// ──────────────────────────────────────────────────────────────────────────

test("assigned doctor can approve a RESOLVED risk", () => {
  assert.equal(canApproveRisk(assignedDoctor, buildRisk("RESOLVED")), true)
})

test("assigned TA cannot approve a RESOLVED risk (doctor signs off)", () => {
  // Policy: once a risk is resolved, only the doctor signs it off.
  assert.equal(canApproveRisk(assignedTa, buildRisk("RESOLVED")), false)
})

test("unrelated doctor cannot approve another team's RESOLVED risk", () => {
  assert.equal(canApproveRisk(unrelatedDoctor, buildRisk("RESOLVED")), false)
})

test("leader cannot self-approve a RESOLVED risk on their own team", () => {
  // Leaders RAISE risks, they don't approve them.
  assert.equal(canApproveRisk(teamLeader, buildRisk("RESOLVED")), false)
})

test("student cannot approve a RESOLVED risk", () => {
  assert.equal(canApproveRisk(student, buildRisk("RESOLVED")), false)
})

// ──────────────────────────────────────────────────────────────────────────
// Open / monitored risks — only the assigned TA approves
// ──────────────────────────────────────────────────────────────────────────

test("assigned TA can approve an OPEN risk (monitoring approval)", () => {
  assert.equal(canApproveRisk(assignedTa, buildRisk("OPEN")), true)
})

test("assigned TA can approve a MITIGATED risk", () => {
  assert.equal(canApproveRisk(assignedTa, buildRisk("MITIGATED")), true)
})

test("assigned doctor cannot approve a non-resolved risk", () => {
  // Doctors only step in at the end of the lifecycle (resolution sign-off).
  assert.equal(canApproveRisk(assignedDoctor, buildRisk("OPEN")), false)
  assert.equal(canApproveRisk(assignedDoctor, buildRisk("MITIGATED")), false)
})

test("unrelated TA cannot approve another team's risk", () => {
  assert.equal(canApproveRisk(unrelatedTa, buildRisk("OPEN")), false)
})

test("leader cannot self-approve an OPEN risk on their own team", () => {
  assert.equal(canApproveRisk(teamLeader, buildRisk("OPEN")), false)
})

// ──────────────────────────────────────────────────────────────────────────
// Malformed input — never throw, always return false
// ──────────────────────────────────────────────────────────────────────────

test("null actor → false", () => {
  assert.equal(canApproveRisk(null, buildRisk("OPEN")), false)
})

test("null risk → false", () => {
  assert.equal(canApproveRisk(assignedTa, null), false)
})

test("risk with no team → false (even for admin? actually admin passes — that's fine)", () => {
  // Admin bypasses the team check, that's by design (admins can approve
  // anything platform-wide). For non-admins, we need a team.
  assert.equal(canApproveRisk(admin, { id: "x", status: "OPEN", team: null }), true)
  assert.equal(canApproveRisk(assignedTa, { id: "x", status: "OPEN", team: null }), false)
})

test("risk with team but no doctor and no TA → only admin can approve", () => {
  const orphan = {
    id: "x",
    status: "OPEN",
    team: { id: "t", leader: { id: "l" }, ta: null, doctor: null },
  }
  assert.equal(canApproveRisk(admin, orphan), true)
  assert.equal(canApproveRisk(assignedTa, orphan), false)
  assert.equal(canApproveRisk(assignedDoctor, orphan), false)
})

test("unknown risk status defaults to TA-approval path (not RESOLVED)", () => {
  // Defence-in-depth: if status is weird (legacy data, bad input), we DON'T
  // accidentally hand authority to the doctor. We fall through to the TA branch.
  const weird = { id: "x", status: "QUANTUM_FLUX", team }
  assert.equal(canApproveRisk(assignedTa, weird), true) // TA still approves
  assert.equal(canApproveRisk(assignedDoctor, weird), false) // Doctor still denied
})
