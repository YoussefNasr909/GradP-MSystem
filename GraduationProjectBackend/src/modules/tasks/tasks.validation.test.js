/**
 * Doctor/TA hardening — Task review-comment validation tests
 *
 * Covers `assertReviewCommentMeetsMinimum` and the constant
 * `RESUBMISSION_COMMENT_MIN_LENGTH` which gate the "Request Resubmission"
 * action for leader / TA / admin. The frontend mirrors the same minimum, but
 * this is the last line of defence — a malicious or scripted client could
 * skip the UI and POST directly.
 *
 * Edge cases covered:
 *   - Empty string, whitespace-only, undefined, null, non-string
 *   - Exactly at the boundary (9 chars, 10 chars, 11 chars)
 *   - Surrounding whitespace (trim correctness)
 *   - Unicode, emoji, mixed scripts
 *   - Multiline
 *   - Extreme length (10 000 chars — at the Zod max)
 *   - HTML / SQL-injection-shaped payloads (we don't sanitize at this layer,
 *     but we must not crash and must still validate length)
 */
import test from "node:test"
import assert from "node:assert/strict"
import { AppError } from "../../common/errors/AppError.js"
import {
  RESUBMISSION_COMMENT_MIN_LENGTH,
  assertReviewCommentMeetsMinimum,
} from "./tasks.service.js"

// ──────────────────────────────────────────────────────────────────────────
// Constant sanity
// ──────────────────────────────────────────────────────────────────────────

test("RESUBMISSION_COMMENT_MIN_LENGTH is 10 (matches frontend constant)", () => {
  // The frontend has its own RESUBMISSION_MIN_LENGTH = 10 in reviews/page.tsx
  // and tasks-board-page.tsx. If you bump one, bump the other.
  assert.equal(RESUBMISSION_COMMENT_MIN_LENGTH, 10)
})

// ──────────────────────────────────────────────────────────────────────────
// Empty / whitespace / nullish — all should throw TASK_REVIEW_COMMENT_REQUIRED
// ──────────────────────────────────────────────────────────────────────────

function assertRequiredError(thunk) {
  assert.throws(
    thunk,
    (error) =>
      error instanceof AppError &&
      error.code === "TASK_REVIEW_COMMENT_REQUIRED" &&
      error.statusCode === 422,
  )
}

test("empty string rejected as REQUIRED", () => {
  assertRequiredError(() => assertReviewCommentMeetsMinimum(""))
})

test("whitespace-only rejected as REQUIRED", () => {
  assertRequiredError(() => assertReviewCommentMeetsMinimum("   "))
  assertRequiredError(() => assertReviewCommentMeetsMinimum("\t\n"))
  assertRequiredError(() => assertReviewCommentMeetsMinimum("   \t   "))
})

test("null/undefined rejected as REQUIRED", () => {
  assertRequiredError(() => assertReviewCommentMeetsMinimum(null))
  assertRequiredError(() => assertReviewCommentMeetsMinimum(undefined))
})

test("non-string values rejected as REQUIRED (after coercion to '')", () => {
  // normalizeText() coerces non-strings to strings then trims. 123 → "123" (3 chars)
  // is interesting — it would fall through to TOO_SHORT, not REQUIRED. We test both.
  assertRequiredError(() => assertReviewCommentMeetsMinimum({}))
  // booleans coerce to "true" / "false" which is > 0 chars but < 10 → TOO_SHORT
  // we accept both REQUIRED and TOO_SHORT as valid rejections here.
  assert.throws(
    () => assertReviewCommentMeetsMinimum(true),
    (error) =>
      error instanceof AppError &&
      (error.code === "TASK_REVIEW_COMMENT_REQUIRED" || error.code === "TASK_REVIEW_COMMENT_TOO_SHORT"),
  )
})

// ──────────────────────────────────────────────────────────────────────────
// Too-short — TASK_REVIEW_COMMENT_TOO_SHORT
// ──────────────────────────────────────────────────────────────────────────

function assertTooShortError(thunk) {
  assert.throws(
    thunk,
    (error) =>
      error instanceof AppError &&
      error.code === "TASK_REVIEW_COMMENT_TOO_SHORT" &&
      error.statusCode === 422,
  )
}

test("1 char rejected as TOO_SHORT", () => {
  assertTooShortError(() => assertReviewCommentMeetsMinimum("x"))
})

test("9 chars (one below minimum) rejected as TOO_SHORT", () => {
  assertTooShortError(() => assertReviewCommentMeetsMinimum("nine char"))
})

test("9 chars with leading/trailing whitespace rejected as TOO_SHORT (trim matters)", () => {
  // After trim it's 9 chars → still too short.
  assertTooShortError(() => assertReviewCommentMeetsMinimum("   nine char   "))
})

// ──────────────────────────────────────────────────────────────────────────
// Boundary — exactly at the minimum
// ──────────────────────────────────────────────────────────────────────────

test("exactly 10 chars accepted at the boundary", () => {
  const ten = "0123456789"
  assert.equal(assertReviewCommentMeetsMinimum(ten), ten)
})

test("exactly 10 chars after trim accepted at the boundary", () => {
  const result = assertReviewCommentMeetsMinimum("   0123456789   ")
  assert.equal(result, "0123456789")
})

test("11 chars accepted", () => {
  const eleven = "01234567890"
  assert.equal(assertReviewCommentMeetsMinimum(eleven), eleven)
})

// ──────────────────────────────────────────────────────────────────────────
// Realistic feedback strings — happy path
// ──────────────────────────────────────────────────────────────────────────

test("typical 'fix the tests' feedback accepted", () => {
  const msg = "Fix the failing unit tests and add a coverage report."
  assert.equal(assertReviewCommentMeetsMinimum(msg), msg)
})

test("multiline feedback accepted", () => {
  const msg = "First issue: the migration fails.\nSecond issue: missing index."
  assert.equal(assertReviewCommentMeetsMinimum(msg), msg)
})

test("feedback with markdown links accepted", () => {
  const msg = "See the screenshot at https://example.com/x.png for the bug."
  assert.equal(assertReviewCommentMeetsMinimum(msg), msg)
})

// ──────────────────────────────────────────────────────────────────────────
// Unicode / emoji / non-ASCII — must count CODE POINTS, not bytes
// ──────────────────────────────────────────────────────────────────────────

test("Arabic feedback accepted (10+ chars)", () => {
  // "أصلح هذا التحقق" = "Fix this validation" — 15 chars
  const msg = "أصلح هذا التحقق"
  assert.ok(msg.length >= 10)
  assert.equal(assertReviewCommentMeetsMinimum(msg), msg)
})

test("Chinese feedback accepted (10+ chars)", () => {
  const msg = "请修复这个测试和文档说明" // 12 chars
  assert.equal(assertReviewCommentMeetsMinimum(msg), msg)
})

test("emoji-only short feedback rejected as TOO_SHORT", () => {
  // 4 emojis = 8 code units (JS .length counts UTF-16 code units, surrogate pairs = 2)
  // "👎👎👎👎" = 8, below minimum
  assertTooShortError(() => assertReviewCommentMeetsMinimum("👎👎👎👎"))
})

test("mixed text + emoji at boundary accepted", () => {
  // "Bad work 👎" — Latin chars (8) + emoji (2 code units) = 10 UTF-16 units
  const msg = "Bad work 👎"
  assert.equal(assertReviewCommentMeetsMinimum(msg), msg)
})

// ──────────────────────────────────────────────────────────────────────────
// Extreme length — must not crash, must accept
// ──────────────────────────────────────────────────────────────────────────

test("10 000 chars accepted (Zod max)", () => {
  const long = "x".repeat(10_000)
  assert.equal(assertReviewCommentMeetsMinimum(long), long)
})

test("100 000 chars also accepted at the service layer (Zod enforces 10 000 upstream)", () => {
  // The service has no upper bound — Zod does. We're testing that the service
  // helper itself doesn't blow up on huge inputs; route-layer Zod schema
  // catches the upper bound.
  const huge = "y".repeat(100_000)
  assert.equal(assertReviewCommentMeetsMinimum(huge), huge)
})

// ──────────────────────────────────────────────────────────────────────────
// Adversarial payloads — must not crash, must validate the length
// ──────────────────────────────────────────────────────────────────────────

test("SQL-injection-shaped payload accepted (not sanitised, but length is fine)", () => {
  // Sanitisation happens at the Prisma layer (parameterised queries). The
  // validation guard cares only that the comment is long enough.
  const msg = "'; DROP TABLE TaskReview; --"
  assert.equal(assertReviewCommentMeetsMinimum(msg), msg)
})

test("HTML-shaped payload accepted at this layer", () => {
  const msg = "<script>alert('xss')</script>"
  assert.equal(assertReviewCommentMeetsMinimum(msg), msg)
})

test("control characters embedded — accepted, trim trims edge whitespace only", () => {
  const msg = "  Has nulls inside"
  // Length after trim is still > 10
  assert.equal(assertReviewCommentMeetsMinimum(msg), msg)
})

// ──────────────────────────────────────────────────────────────────────────
// AppError shape — error always has the right code + status
// ──────────────────────────────────────────────────────────────────────────

test("REQUIRED error has 422 + correct code + human-readable message", () => {
  try {
    assertReviewCommentMeetsMinimum("")
    assert.fail("expected throw")
  } catch (error) {
    assert.ok(error instanceof AppError)
    assert.equal(error.statusCode, 422)
    assert.equal(error.code, "TASK_REVIEW_COMMENT_REQUIRED")
    assert.match(error.message, /review comment/i)
  }
})

test("TOO_SHORT error has 422 + correct code + mentions the minimum length", () => {
  try {
    assertReviewCommentMeetsMinimum("short")
    assert.fail("expected throw")
  } catch (error) {
    assert.ok(error instanceof AppError)
    assert.equal(error.statusCode, 422)
    assert.equal(error.code, "TASK_REVIEW_COMMENT_TOO_SHORT")
    // Message should tell the reviewer how long they need to be.
    assert.match(error.message, /10/)
  }
})
