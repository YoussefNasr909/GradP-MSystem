/**
 * Doctor/TA hardening — Submission supervisor permission tests
 *
 * `assertSupervisorForTeam` is the cross-team guard for submission grading,
 * TA review, unlock, defense, and revision-request endpoints. It hits Prisma
 * to confirm the actor is either the team's assigned doctor or TA (admins
 * always pass). This test patches Prisma in-process so we can exercise every
 * branch without a real DB.
 *
 * Scenarios:
 *   - Admin always passes (no DB call required).
 *   - Assigned doctor passes (Prisma returns the team).
 *   - Assigned TA passes (Prisma returns the team).
 *   - Unrelated user fails (Prisma returns null → 403).
 *   - Missing actor / teamId fails fast without a DB call.
 *   - Prisma error bubbles up properly (no swallowed error).
 */
import test from "node:test"
import assert from "node:assert/strict"
import { AppError } from "../../common/errors/AppError.js"
import { prisma } from "../../loaders/dbLoader.js"
import { assertSupervisorForTeam } from "./submissions.service.js"

// ──────────────────────────────────────────────────────────────────────────
// Prisma mock helpers
// ──────────────────────────────────────────────────────────────────────────

function patchTeamFindFirst(impl) {
  const original = prisma.team.findFirst
  prisma.team.findFirst = impl
  return () => {
    prisma.team.findFirst = original
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Happy paths
// ──────────────────────────────────────────────────────────────────────────

test("assertSupervisorForTeam: admin always passes without a DB call", async () => {
  let dbCalled = false
  const restore = patchTeamFindFirst(async () => {
    dbCalled = true
    return null
  })
  try {
    await assertSupervisorForTeam({ id: "admin-1", role: "ADMIN" }, "team-1")
    assert.equal(dbCalled, false, "admin should not query the DB")
  } finally {
    restore()
  }
})

test("assertSupervisorForTeam: assigned doctor passes when Prisma returns the team", async () => {
  let queryArgs = null
  const restore = patchTeamFindFirst(async (args) => {
    queryArgs = args
    return { id: "team-1", doctorId: "doctor-1" }
  })
  try {
    await assertSupervisorForTeam({ id: "doctor-1", role: "DOCTOR" }, "team-1")
    // Verify the WHERE clause filters by team id AND (doctor or TA = actor).
    assert.equal(queryArgs.where.id, "team-1")
    assert.deepEqual(queryArgs.where.OR, [{ doctorId: "doctor-1" }, { taId: "doctor-1" }])
  } finally {
    restore()
  }
})

test("assertSupervisorForTeam: assigned TA passes when Prisma returns the team", async () => {
  const restore = patchTeamFindFirst(async () => ({ id: "team-1", taId: "ta-1" }))
  try {
    await assertSupervisorForTeam({ id: "ta-1", role: "TA" }, "team-1")
  } finally {
    restore()
  }
})

// ──────────────────────────────────────────────────────────────────────────
// Denials — cross-team or missing-team
// ──────────────────────────────────────────────────────────────────────────

async function assertSupervisorForbidden(actor, teamId) {
  await assert.rejects(
    async () => assertSupervisorForTeam(actor, teamId),
    (error) =>
      error instanceof AppError &&
      error.code === "SUBMISSION_SUPERVISOR_FORBIDDEN" &&
      error.statusCode === 403,
  )
}

test("assertSupervisorForTeam: unrelated TA cannot supervise another team's submission", async () => {
  const restore = patchTeamFindFirst(async () => null)
  try {
    await assertSupervisorForbidden({ id: "ta-99", role: "TA" }, "team-1")
  } finally {
    restore()
  }
})

test("assertSupervisorForTeam: unrelated doctor cannot supervise another team's submission", async () => {
  const restore = patchTeamFindFirst(async () => null)
  try {
    await assertSupervisorForbidden({ id: "doctor-99", role: "DOCTOR" }, "team-1")
  } finally {
    restore()
  }
})

test("assertSupervisorForTeam: student cannot pose as a supervisor", async () => {
  // Even though the route layer should block this with allowRoles, the service
  // is the last gate. A student whose id is somehow the team's taId column
  // (shouldn't happen, but defence in depth) — still rejected if Prisma
  // returns null. Critically, with role !== ADMIN we do query the DB.
  const restore = patchTeamFindFirst(async () => null)
  try {
    await assertSupervisorForbidden({ id: "student-1", role: "STUDENT" }, "team-1")
  } finally {
    restore()
  }
})

// ──────────────────────────────────────────────────────────────────────────
// Malformed input — never bypass the gate by leaving fields off
// ──────────────────────────────────────────────────────────────────────────

test("assertSupervisorForTeam: null actor → 403 immediately, no DB call", async () => {
  let dbCalled = false
  const restore = patchTeamFindFirst(async () => {
    dbCalled = true
    return { id: "team-1" }
  })
  try {
    await assertSupervisorForbidden(null, "team-1")
    assert.equal(dbCalled, false)
  } finally {
    restore()
  }
})

test("assertSupervisorForTeam: empty/null teamId → 403, no DB call", async () => {
  let dbCalled = false
  const restore = patchTeamFindFirst(async () => {
    dbCalled = true
    return { id: "team-1" }
  })
  try {
    await assertSupervisorForbidden({ id: "ta-1", role: "TA" }, null)
    await assertSupervisorForbidden({ id: "ta-1", role: "TA" }, "")
    assert.equal(dbCalled, false)
  } finally {
    restore()
  }
})

// ──────────────────────────────────────────────────────────────────────────
// Prisma failure — must surface, must not silently grant access
// ──────────────────────────────────────────────────────────────────────────

test("assertSupervisorForTeam: Prisma error bubbles up (no fail-open)", async () => {
  const restore = patchTeamFindFirst(async () => {
    throw new Error("Database connection lost")
  })
  try {
    await assert.rejects(
      async () => assertSupervisorForTeam({ id: "ta-1", role: "TA" }, "team-1"),
      (error) => error instanceof Error && /Database connection lost/.test(error.message),
    )
  } finally {
    restore()
  }
})
