# GPMS Gamification Feature — Planning Document (Part 1/3)

> **Version:** 1.0 · **Date:** April 28, 2026 · **Status:** Draft  
> **Audience:** Product Managers, Backend/Frontend Developers, Doctors, TAs, Stakeholders

---

## Table of Contents (Full Document)

| Part | Sections |
|------|----------|
| **Part 1** | 1. XP & Points System · 2. XP Control & Administration · 3. Individual vs Team Points · 4. Team Impact Rules |
| **Part 2** | 5. Leaderboard Design · 6. Badges & Achievements · 7. Anti-Cheat System |
| **Part 3** | 8. Recommended Architecture · 9. Best Practices & Final Recommendations |

---

## 1. XP & Points System

### 1.1 Design Philosophy

XP (Experience Points) is the **single universal currency of effort**. Every meaningful action a student takes should produce a measurable, auditable XP transaction. The system must be:

- **Transparent** — students always know *why* they earned or lost XP.
- **Fair** — the same action yields the same base XP regardless of who performs it.
- **Resistant to gaming** — trivial or fake actions must not be rewarded.
- **Motivating** — the difficulty curve should keep both high and low performers engaged.

### 1.2 XP Tiers by Activity

#### Tier 1 — High XP (50–200 XP per action)

These represent significant, high-effort deliverables:

| Activity | Base XP | Notes |
|----------|---------|-------|
| Complete a major submission (SRS, Final Report, Presentation) | 150–200 | Scales with deliverable weight |
| Merge a substantial Pull Request (≥100 LOC, meaningful changes) | 100–150 | Verified via GitHub integration |
| Complete an SDLC phase milestone | 100 | Awarded once per phase transition |
| Submit a weekly progress report (on time) | 75 | Reduced if late (see §1.6) |
| Resolve a critical/high-priority task | 60–80 | Based on task priority |
| Review and approve a teammate's PR with substantive feedback | 50–75 | Must contain ≥2 meaningful comments |

#### Tier 2 — Medium XP (15–49 XP per action)

Routine but valuable contributions:

| Activity | Base XP | Notes |
|----------|---------|-------|
| Complete a medium-priority task | 30–40 | |
| Push a meaningful commit (≥10 LOC, non-trivial) | 20–30 | Subject to quality checks |
| Open a well-described GitHub Issue | 20 | Must have title + description |
| Participate in a team meeting (verified attendance) | 25 | |
| Post a substantive discussion reply (≥50 chars, not duplicate) | 15–20 | |
| Upload project documentation | 25–35 | |
| Complete a daily quest | 20–50 | Varies by quest difficulty |

#### Tier 3 — Low XP (5–14 XP per action)

Minor but trackable actions:

| Activity | Base XP | Notes |
|----------|---------|-------|
| Complete a low-priority task | 10–15 | |
| Log time on the time tracker (≥30 min session) | 10 | Capped at 4 sessions/day |
| React to or acknowledge a discussion post | 5 | Capped at 10/day |
| Update task status (move through board) | 5 | |
| Log in daily (streak contribution) | 5 | Only first login per day |

#### Tier 0 — No XP

These actions should **never** grant XP:

| Activity | Reason |
|----------|--------|
| Empty or whitespace-only commits | Anti-cheat: no meaningful work |
| Duplicate/copy-paste submissions | Anti-cheat: plagiarism |
| Changing task status without actual work | Anti-cheat: status manipulation |
| Self-assigned tasks completed in <1 minute | Anti-cheat: farming |
| Viewing pages, opening modals, reading notifications | These are passive actions, not contributions |
| Administrative actions (admin/doctor/TA) | Gamification is for students only |

### 1.3 Points Distribution Model

```
Total Student XP = Base Activity XP
                 + Difficulty Multiplier
                 + Streak Bonus
                 + Quality Bonus
                 − Late Penalty
                 − Quality Deduction
```

**Difficulty Multipliers** (applied to task-based XP):

| Task Priority | Multiplier |
|---------------|------------|
| Low | ×1.0 |
| Medium | ×1.2 |
| High | ×1.5 |
| Critical | ×2.0 |

**Streak Bonuses** (applied to daily base XP):

| Streak Length | Bonus |
|---------------|-------|
| 3–6 days | +10% |
| 7–13 days | +20% |
| 14–29 days | +35% |
| 30+ days | +50% (capped) |

### 1.4 Fixed vs. Dynamic vs. Weighted XP

**Recommendation: Hybrid approach**

- **Base XP is fixed** per activity type — ensures predictability and transparency.
- **Multipliers are dynamic** based on difficulty, timeliness, and quality.
- **Weight coefficients are admin-configurable** — doctors/admins can adjust category weights per semester.

This gives students a clear mental model ("completing a task = ~30 XP") while allowing the system to reward higher-quality or more difficult work proportionally.

### 1.5 XP Decay

**Recommendation: No decay, but relative ranking uses time windows.**

- XP is **permanent** — students should never feel punished for taking a break.
- Leaderboards use **weekly/monthly windows** to keep competition fresh (see §5).
- Streak bonuses naturally reward consistency without penalizing absence.

> [!IMPORTANT]
> Decaying XP creates anxiety and discourages students who fall behind. Permanent XP with time-windowed leaderboards achieves the same competitive freshness without the negative psychology.

### 1.6 Late Submission Penalty

| Lateness | XP Reduction |
|----------|-------------|
| 1–24 hours late | −25% of base XP |
| 1–3 days late | −50% of base XP |
| 3–7 days late | −75% of base XP |
| >7 days late | 0 XP (no reward) |

The `late` boolean already exists on the `Submission` model. Extend with a `lateBy` duration field.

### 1.7 Repeated / Low-Quality Submission Handling

- **Resubmissions** of the same deliverable: award XP only for the *first* approved version. Revisions earn 10% of base XP (to reward improvement without farming).
- **Low-quality submissions** (rejected by TA/doctor): no XP until status reaches `APPROVED`.
- **Duplicate content detection**: hash file contents; if hash matches a prior submission, flag for review and withhold XP.

### 1.8 GitHub Contributions & XP

**Recommendation: Yes, count GitHub toward XP — with quality gates.**

#### Rewarded GitHub Actions

| GitHub Action | Base XP | Quality Gate |
|---------------|---------|-------------|
| Commit (meaningful) | 15–30 | ≥10 LOC changed, non-generated files, commit message ≥10 chars |
| Pull Request opened | 20 | Must have description, ≥1 file changed |
| Pull Request merged | 40–80 | Scales with LOC; must be reviewed by ≥1 person |
| Code Review submitted | 30–50 | Must contain ≥1 substantive comment (not just "LGTM") |
| Issue opened | 15 | Must have title ≥10 chars + description ≥30 chars |
| Issue closed (by author) | 20 | Must be linked to a commit or PR |
| Meaningful PR comment | 10 | ≥30 chars, not a duplicate of prior comment |

#### Preventing Fake GitHub Activity

| Check | Implementation |
|-------|---------------|
| **Empty commits** | Reject commits where `additions + deletions = 0` |
| **Auto-generated files** | Exclude `node_modules/`, `package-lock.json`, `.next/`, `dist/`, `build/` from LOC count |
| **Commit message quality** | Require ≥10 meaningful characters; reject "fix", "update", "asdf" |
| **Burst detection** | Flag >15 commits in 1 hour from same user |
| **Duplicate content** | Compare diff hashes across commits; flag identical diffs |
| **PR size sanity** | Cap XP at 150 per PR regardless of LOC (prevents mega-PR farming) |
| **Self-merge detection** | PRs merged by the author without review get 50% XP reduction |

#### GitHub XP Processing Mode

**Recommendation: Automatic with async validation.**

1. GitHub webhook delivers event → stored in `GitHubWebhookDelivery`.
2. Background job processes the event, applies quality gates.
3. If all gates pass → XP transaction is created automatically.
4. If any gate fails → XP is held in `PENDING_REVIEW` status; TA/doctor can approve or reject.
5. Suspicious patterns (burst, empty, duplicate) → flagged in anti-cheat dashboard.

---

## 2. XP Control & Administration

### 2.1 Role-Based XP Permissions

| Action | Admin | Doctor | TA | Student |
|--------|-------|--------|----|---------| 
| View any student's XP history | ✅ | ✅ (own teams) | ✅ (own teams) | ❌ (self only) |
| Manually award bonus XP | ✅ | ✅ (own teams, capped at 200/action) | ✅ (own teams, capped at 100/action) | ❌ |
| Manually deduct XP | ✅ | ✅ (own teams, capped at 200/action) | ❌ | ❌ |
| Override automated XP | ✅ | ✅ | ❌ | ❌ |
| Configure XP rules/weights | ✅ | ❌ | ❌ | ❌ |
| Approve pending XP (anti-cheat holds) | ✅ | ✅ | ✅ | ❌ |
| View audit log | ✅ | ✅ (own teams) | ✅ (own teams) | ❌ |
| Rollback XP transactions | ✅ | ❌ | ❌ | ❌ |

### 2.2 Approval Workflow for Manual XP Changes

**Recommendation: Required for deductions; optional for bonuses.**

- **Bonus XP** (≤100): Auto-approved, logged.
- **Bonus XP** (>100): Requires a reason field (mandatory), auto-approved, logged.
- **XP deductions**: Always require a reason; student is notified with explanation.
- **Bulk XP operations** (e.g., "award 50 XP to all team members"): Require doctor or admin approval.

### 2.3 XP Audit Logging

**Every XP change must produce an immutable audit record:**

```
XpTransaction {
  id, userId, teamId?,
  amount,          // positive = award, negative = deduction
  balanceBefore, balanceAfter,
  source,          // "TASK_COMPLETE" | "GITHUB_COMMIT" | "MANUAL_BONUS" | "PENALTY" | ...
  sourceId?,       // FK to task, submission, webhook delivery, etc.
  reason?,         // Required for manual changes
  performedBy,     // userId of admin/doctor/TA, or "SYSTEM"
  status,          // "APPLIED" | "PENDING_REVIEW" | "ROLLED_BACK"
  metadata,        // JSON: extra context (commit SHA, PR number, etc.)
  createdAt
}
```

### 2.4 Student Visibility

Students should see:
- ✅ Their total XP and level
- ✅ A chronological feed of XP changes with reasons
- ✅ Which specific action caused each XP change
- ✅ Pending XP (held for review) shown as "pending" with explanation
- ❌ Other students' detailed XP transaction logs (privacy)

### 2.5 Grades & Evaluations ↔ XP Relationship

**Recommendation: Grades influence XP through a bonus system, not direct mapping.**

| Grade Range | XP Effect |
|-------------|-----------|
| A (90–100%) | +25% bonus on submission XP |
| B (80–89%) | +10% bonus on submission XP |
| C (70–79%) | No modifier (base XP only) |
| D (60–69%) | −25% of submission XP |
| F (<60%) | 0 XP for that submission |

- Grades should **not** directly set XP amounts — that would break the effort-based model.
- Badges and rank titles (see §6) can have grade requirements as unlock conditions.
- **Poor evaluations**: Do not reduce existing XP. Instead, withhold XP for the submission and trigger a "needs improvement" notification.

---

## 3. Individual vs. Team-Based Points

### 3.1 Dual-Track Model

**Recommendation: Maintain both Individual XP and Team XP as separate tracks.**

```
┌─────────────────────────┐     ┌─────────────────────────┐
│     Individual XP       │     │       Team XP           │
│  ─────────────────────  │     │  ─────────────────────  │
│  • Personal tasks       │     │  • Sum of members' XP   │
│  • Personal commits     │     │  • Team-level bonuses   │
│  • Personal streak      │     │  • Submission grades    │
│  • Code reviews given   │     │  • Phase completions    │
│  • Discussion posts     │     │  • Team challenges      │
│                         │     │                         │
│  Drives: Individual     │     │  Drives: Team           │
│  leaderboard, badges,   │     │  leaderboard, team      │
│  personal level/rank    │     │  badges, team rank      │
└─────────────────────────┘     └─────────────────────────┘
```

### 3.2 XP Assignment Rules

| Activity Type | Individual XP | Team XP |
|---------------|:---:|:---:|
| Personal task completion | ✅ 100% | ✅ 50% contribution |
| Submission (graded) | ✅ Submitter gets bonus | ✅ 100% (shared deliverable) |
| GitHub commit | ✅ 100% to committer | ✅ 30% contribution |
| Code review | ✅ 100% to reviewer | ✅ 20% contribution |
| Phase milestone | ❌ | ✅ 100% (team achievement) |
| Meeting attendance | ✅ 100% to attendee | ✅ 10% per attendee |
| Team challenge win | ✅ Equal split to members | ✅ 100% |

### 3.3 Contribution Balance

- One member's high contribution **adds** to team XP but does **not** inflate other members' individual XP.
- A strong member **cannot** fully compensate for a weak member's individual rank.
- Team XP uses a **weighted average model** (see §4) that naturally penalizes unbalanced teams.

### 3.4 Leaderboard Implications

- **Individual leaderboard**: Ranked by personal XP — reflects personal effort.
- **Team leaderboard**: Ranked by team XP — reflects collective output.
- Both are displayed; students can toggle between views.

---

## 4. Team Impact Rules

### 4.1 Team XP Calculation

**Recommendation: Weighted contribution average, not simple sum.**

```
Team XP = (Sum of Individual XP contributions to team)
        + Team-level bonuses (milestones, challenges)
        − Team-level penalties (if applicable)

Team Health Score = Contribution Variance Score (0–100)
  where 100 = perfectly equal, 0 = one person did everything
```

### 4.2 Individual Behavior → Team Impact

| Scenario | Effect | Mechanism |
|----------|--------|-----------|
| Member has 0 activity for 7+ days | ⚠️ Warning issued to team | Automated notification |
| Member has <10% of team's average XP | ⚠️ "At-risk" flag on team dashboard | Visual indicator |
| Member has <5% of average for 14+ days | 🔴 "Contribution imbalance" penalty: team XP multiplier drops to ×0.9 | Reversible if member catches up |
| All members within 20% of average | ✅ "Balanced Team" bonus: +10% team XP | Rewarding equal effort |
| Top member has >60% of total team XP | ⚠️ "Carry risk" warning | Notification to doctor/TA |

### 4.3 Inactivity Detection

A member is flagged as **inactive** if they meet ALL of:
- 0 task completions in 7 days
- 0 GitHub commits in 7 days
- 0 discussion posts in 7 days
- 0 meeting attendance in 7 days

### 4.4 Warning System Before Penalties

```
Day 0–6:   No action (grace period)
Day 7:     ⚠️ Private notification to the inactive member
Day 10:    ⚠️ Notification to team leader
Day 14:    ⚠️ Notification to supervising TA/doctor
Day 14+:   🔴 Team XP multiplier reduced (×0.9)
           Reversible within 7 days if member resumes activity
Day 21+:   🔴 Member flagged in admin dashboard for intervention
```

> [!WARNING]
> Team penalties should be **gentle and reversible**. The goal is to motivate participation, not punish teams for having one struggling member. Doctors/TAs can override any automated penalty.

### 4.5 Active Member Protection

- If ≥80% of the team is active and contributing, the team XP multiplier cannot drop below ×0.95 regardless of one member's inactivity.
- Active members' individual XP is **never** affected by teammates' inactivity.
- The "Balanced Team" bonus incentivizes peer motivation naturally.

---

> **Continued in Part 2:** Leaderboard Design, Badges & Achievements, Anti-Cheat System
