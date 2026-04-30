# Gamification Implementation Plan

## Summary
Use [docs/GAMIFICATION_FEATURE_PLAN.md](<E:\FCAI - Fourth Level\Graduation Project\GPMS\docs\GAMIFICATION_FEATURE_PLAN.md>) as the source of truth. Treat `gamification_plan_part1.md`, `part2.md`, and `part3.md` as earlier split drafts.

Best path: build an MVP that is fair, auditable, and connected to real GPMS workflows before adding advanced challenges, coins, store items, or complex anti-cheat.

The first implementation should include:

- XP ledger and balances.
- Badges.
- Individual/team leaderboards.
- XP from approved tasks, approved submissions, team stage advancement, and validated GitHub PRs.
- Admin/doctor/TA review and manual adjustment tools.
- Basic anti-cheat with frozen XP and audit logs.

## Implementation Phases

### Phase 1: Backend Foundation
- Add a new backend module: `gamification`, following the current module pattern: routes, controller, service, repository, schema, tests.
- Extend Prisma with gamification enums and models:
  - `GamificationEvent`
  - `XpTransaction`
  - `UserXpBalance`
  - `TeamXpBalance`
  - `BadgeDefinition`
  - `UserBadge`
  - `LeaderboardSnapshot`
  - `SuspiciousActivityCase`
  - `XpAdjustmentRequest`
  - `GamificationAuditLog`
- Do not add `xp`, `level`, or `coins` directly to `User` as the source of truth. Use the ledger and materialized balance tables.
- Seed default XP rules and badge definitions from backend seed data.
- Add `/gamification` to the backend route index.

### Phase 2: XP Engine
- Implement an event-driven XP flow:
  - Domain action happens.
  - Backend creates a `GamificationEvent`.
  - Gamification service calculates XP.
  - Anti-cheat checks the event.
  - XP transaction becomes `AWARDED` or `FROZEN`.
  - User/team balance is recalculated.
  - Notification is sent.
- Start with synchronous processing inside service calls for MVP. Add background workers later if needed.
- Award XP only for approved/verified outcomes:
  - `TASK_APPROVED`
  - `SUBMISSION_APPROVED`
  - `TEAM_STAGE_ADVANCED`
  - `GITHUB_PR_MERGED`
  - `BADGE_UNLOCKED`
  - `MANUAL_XP_ADJUSTMENT_APPROVED`
- Use the document’s recommended scoring:
  - Task XP by task type and priority.
  - Submission XP by deliverable type, lateness, and grade.
  - GitHub XP only for linked, meaningful PRs.
  - Permanent lifetime XP plus weekly/monthly/semester derived scores.

### Phase 3: Integrate Existing Workflows
- In `tasks.service.js`, emit XP event only when a task is approved.
- In `submissions.service.js`, emit XP event only when a submission is approved/graded.
- In stage advancement logic, emit team XP when a team advances SDLC stage.
- In GitHub PR merge/task PR merge flow, emit GitHub contribution XP only when:
  - Repository is connected to a team.
  - GitHub user is linked to a GPMS user.
  - PR is linked to a GPMS task.
  - PR has meaningful diff evidence.
- Keep task acceptance, login, raw commits, comments, and task creation as no-XP or tiny badge-only actions.

### Phase 4: Anti-Cheat and Admin Controls
- Add basic automatic checks:
  - Idempotency per source event.
  - Duplicate submission hash.
  - Repeated XP source prevention.
  - GitHub generated-only/trivial diff detection.
  - Daily caps for low-value actions.
  - Suspicion score thresholds.
- Suspicious events create `SuspiciousActivityCase` and freeze related XP.
- Add admin/doctor/TA actions:
  - View suspicious XP.
  - Approve frozen XP.
  - Reject frozen XP.
  - Reverse awarded XP.
  - Request manual XP adjustment.
  - Approve/reject manual adjustment.
- Every manual action must create a `GamificationAuditLog`.

### Phase 5: Frontend Integration
- Replace frontend mock gamification data with real API calls.
- Add `lib/api/gamification.ts`.
- Update the current gamification page to consume backend data:
  - My XP summary.
  - Level progress.
  - Recent XP transactions.
  - Badge gallery.
  - Individual leaderboard.
  - Team leaderboard.
- Add admin/doctor/TA review screens later in the same dashboard area:
  - Frozen XP queue.
  - Manual adjustment requests.
  - Suspicious activity cases.
- Do not implement the reward store in MVP. Keep coins/store as future cosmetic functionality.

## Public APIs and Types

### Student APIs
- `GET /gamification/me`
- `GET /gamification/users/:userId/summary`
- `GET /gamification/users/:userId/transactions`
- `GET /gamification/users/:userId/badges`
- `GET /gamification/leaderboards`
- `GET /gamification/teams/:teamId/summary`

### Admin/Doctor/TA APIs
- `GET /gamification/admin/suspicious-activity`
- `POST /gamification/admin/suspicious-activity/:id/approve`
- `POST /gamification/admin/suspicious-activity/:id/reject`
- `POST /gamification/admin/transactions/:id/reverse`
- `POST /gamification/admin/xp-adjustments`
- `POST /gamification/admin/xp-adjustments/:id/approve`
- `POST /gamification/admin/xp-adjustments/:id/reject`
- `GET /gamification/admin/audit-logs`

### Frontend Types
Add typed API responses for:

- `GamificationSummary`
- `XpTransaction`
- `Badge`
- `LeaderboardEntry`
- `TeamGamificationSummary`
- `SuspiciousActivityCase`
- `XpAdjustmentRequest`

## Preferred Build Order
1. Add Prisma schema and seed defaults.
2. Add backend gamification module with read APIs returning seeded/empty balances.
3. Implement XP transaction creation and balance recalculation.
4. Integrate task approval XP.
5. Integrate submission approval XP.
6. Integrate team stage XP.
7. Add badge unlock evaluation.
8. Add leaderboard snapshots.
9. Add basic GitHub PR merged XP.
10. Add admin/manual adjustment and suspicious XP review.
11. Connect frontend gamification page to real APIs.
12. Replace mock user `xp`, `gold`, `level`, and random leaderboard logic.

## Test Plan
- Backend unit tests:
  - Task approval creates one XP transaction only once.
  - Re-approving/retrying same source does not duplicate XP.
  - Late submission applies reduced XP.
  - Grade multiplier changes awarded XP correctly.
  - Suspicious event freezes XP.
  - Reversal creates a debit/reversal transaction.
  - Balance recalculation matches ledger totals.
- Permission tests:
  - Student can view own XP.
  - Leader can view team summary.
  - TA/doctor can review assigned teams only.
  - Admin can review all.
  - Team leader cannot manually grant XP.
- GitHub tests:
  - Linked merged PR awards XP.
  - Unlinked PR does not award XP.
  - Unknown GitHub user does not award XP.
  - Trivial/generated-only PR is frozen or rejected.
- Frontend checks:
  - Gamification page renders real empty state.
  - Leaderboard shows top entries and current user context.
  - XP history explains why XP changed.
  - Frozen XP appears as pending/review state, not as awarded XP.

## Assumptions
- `GAMIFICATION_FEATURE_PLAN.md` is the canonical planning document.
- MVP should prioritize fairness and auditability over visual extras.
- Coins, store rewards, quests, seasonal challenges, peer evaluation, and advanced plagiarism detection are future phases.
- XP must never directly affect academic grades.
- Existing roles stay unchanged: `STUDENT`, `LEADER`, `TA`, `DOCTOR`, `ADMIN`.
- Existing Express, Prisma, Zod, and Next.js patterns should be reused.
