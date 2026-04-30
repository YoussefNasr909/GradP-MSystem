# GPMS Gamification Feature — Planning Document (Part 2/3)

> Continued from Part 1

---

## 5. Leaderboard Design

### 5.1 Ranking Dimensions

The system should support **multiple leaderboard views**, not a single monolithic ranking:

| Leaderboard | Ranked By | Scope | Reset Period |
|-------------|-----------|-------|-------------|
| **All-Time Individual** | Total lifetime XP | All students | Never |
| **Weekly Individual** | XP earned this week (Mon→Sun) | All students | Every Monday |
| **Monthly Individual** | XP earned this calendar month | All students | 1st of each month |
| **Team All-Time** | Total team XP | All teams | Never |
| **Team Weekly** | Team XP earned this week | All teams | Every Monday |
| **GitHub Leaderboard** | GitHub-sourced XP only | All students | Monthly |
| **Task Completion** | Tasks completed count | All students | Monthly |
| **Quality Score** | Average grade on submissions | All students | Per semester |
| **Streak Champions** | Current active streak length | All students | Live (real-time) |

### 5.2 Multiple Leaderboard Tabs

The frontend should present leaderboards using a tabbed interface:

```
┌─────────────────────────────────────────────────────┐
│  [Individual ▼]  [Team ▼]  [Weekly]  [All-Time]    │
│                                                     │
│  🥇 1. Nour Hassan        — 3,680 XP  ▲2           │
│  🥈 2. Youssef Ahmed      — 2,850 XP  ▼1           │
│  🥉 3. Salma Youssef      — 2,400 XP  —            │
│     4. Hana Adel           — 2,300 XP  ▲3           │
│     5. Karim Mostafa       — 2,200 XP  ▼1           │
│  ─────────────────────────────────────────────────  │
│  📍 Your rank: #7 — 1,800 XP (▲2 from last week)   │
└─────────────────────────────────────────────────────┘
```

### 5.3 Leaderboard Reset Strategy

| Type | Reset | Rationale |
|------|-------|-----------|
| Weekly | Every Monday 00:00 UTC | Keeps short-term competition fresh |
| Monthly | 1st of month 00:00 UTC | Medium-term goal setting |
| All-time | Never | Long-term recognition |
| Per-semester | At semester boundaries (admin-configured) | Academic alignment |

**Recommendation:** Default view = **Weekly** (encourages consistent effort). All-time is always accessible but not the default focus.

### 5.4 Visibility Rules

| Rule | Implementation |
|------|---------------|
| Show top 20 by default | Prevents overwhelm |
| Always show current user's position | Even if outside top 20, pinned at bottom |
| Show rank change indicators (▲▼—) | Week-over-week comparison |
| Filter by: course, track, batch, team | Dropdown filters |
| Anonymous mode for bottom 30% | Show rank but blur names to prevent shaming |

### 5.5 Preventing Leaderboard Discouragement

This is a critical design concern. Strategies:

| Strategy | Implementation |
|----------|---------------|
| **Tier-based grouping** | Instead of raw rank, show tiers: Diamond, Platinum, Gold, Silver, Bronze. Students compete within their tier. |
| **Personal progress emphasis** | "You gained 340 XP this week — 45% more than last week!" prominently displayed above the leaderboard. |
| **Relative improvement board** | A separate "Most Improved" leaderboard ranking by % increase, not absolute XP. |
| **Bottom anonymization** | Below rank #20 (or bottom 30%), only show "Your rank: #X" without listing others. |
| **Encouragement notifications** | "You're only 120 XP away from the next tier!" |
| **Multiple dimensions** | A student weak in tasks might shine in GitHub or discussions. Multiple boards give multiple chances to excel. |

### 5.6 Tier System

| Tier | XP Range | Icon | Color |
|------|----------|------|-------|
| Bronze | 0–499 | 🟤 | `#CD7F32` |
| Silver | 500–1,499 | ⚪ | `#C0C0C0` |
| Gold | 1,500–2,999 | 🟡 | `#FFD700` |
| Platinum | 3,000–4,999 | 💠 | `#E5E4E2` |
| Diamond | 5,000+ | 💎 | `#B9F2FF` |

---

## 6. Badges & Achievements

### 6.1 Current Badge System Audit

Based on the existing frontend code, the following are already defined as mock data:

| Category | Existing Badges | Status |
|----------|----------------|--------|
| Getting Started | Welcome Aboard, Identity Established | UI-only (mock) |
| Productivity | Task Apprentice (10), Expert (50), Master (100), Legend (500) | UI-only (mock) |
| Development | Code Beginner, Code Warrior (7-day streak), Code Reviewer, Bug Hunter | UI-only (mock) |
| Collaboration | Team Player, Discussion Starter, Mentor | UI-only (mock) |
| Consistency | Getting Started (3d), Week Warrior (7d), Month Master (30d), Streak Legend (100d) | UI-only (mock) |
| Special | Early Bird, Night Owl, Perfect Week, Speedster | UI-only (mock) |
| Leadership | Team Founder, Team Builder, Project Champion | UI-only (mock) |

**All badges are currently frontend mock data with no backend support.**

### 6.2 Proposed Badge System (Complete)

#### Getting Started Badges

| Badge | Condition | XP Reward | Rarity |
|-------|-----------|-----------|--------|
| Welcome Aboard | First login | 10 | Common |
| Identity Established | Complete all profile fields | 15 | Common |
| Team Spirit | Join or create a team | 20 | Common |
| First Steps | Complete first task | 20 | Common |
| Connected | Link GitHub account | 25 | Common |

#### Task Completion Badges (Tiered)

| Badge | Condition | XP Reward | Rarity |
|-------|-----------|-----------|--------|
| Task Apprentice | Complete 10 tasks | 30 | Common |
| Task Expert | Complete 50 tasks | 100 | Rare |
| Task Master | Complete 100 tasks | 250 | Epic |
| Task Legend | Complete 500 tasks | 1,000 | Legendary |

#### Streak Badges (Tiered)

| Badge | Condition | XP Reward | Rarity |
|-------|-----------|-----------|--------|
| Getting Started | 3-day streak | 15 | Common |
| Week Warrior | 7-day streak | 50 | Rare |
| Fortnight Fighter | 14-day streak | 100 | Rare |
| Month Master | 30-day streak | 300 | Epic |
| Streak Legend | 100-day streak | 1,000 | Legendary |

#### GitHub Contribution Badges

| Badge | Condition | XP Reward | Rarity |
|-------|-----------|-----------|--------|
| Code Beginner | First commit pushed | 25 | Common |
| Code Warrior | 7-day commit streak | 75 | Rare |
| PR Pioneer | First PR merged | 30 | Common |
| Code Reviewer | Review 10 PRs | 100 | Rare |
| Open Source Hero | 50 merged PRs | 300 | Epic |
| Bug Hunter | Close 5 bug issues | 80 | Rare |
| Commit Machine | 200 total commits | 200 | Epic |

#### Teamwork Badges

| Badge | Condition | XP Reward | Rarity |
|-------|-----------|-----------|--------|
| Team Player | Help 5 teammates | 50 | Common |
| Discussion Starter | Start 10 discussions | 60 | Rare |
| Mentor | Help 20 unique teammates | 200 | Epic |
| Bridge Builder | Participate in all team meetings for a month | 100 | Rare |

#### Code Quality Badges

| Badge | Condition | XP Reward | Rarity |
|-------|-----------|-----------|--------|
| Clean Coder | 5 PRs merged with 0 change requests | 100 | Rare |
| Zero Bugs | Complete a phase with 0 bug reports | 150 | Epic |
| Documentation Hero | Upload 10 documentation files | 80 | Rare |

#### Leadership Badges

| Badge | Condition | XP Reward | Rarity |
|-------|-----------|-----------|--------|
| Team Founder | Create a team | 100 | Rare |
| Team Builder | Grow team to max members | 150 | Epic |
| Project Champion | Complete the project | 500 | Legendary |
| Balanced Leader | All team members within 20% XP of average | 200 | Epic |

#### Improvement Badges

| Badge | Condition | XP Reward | Rarity |
|-------|-----------|-----------|--------|
| Comeback Kid | Increase weekly XP by 100% vs prior week | 75 | Rare |
| Rising Star | Move up 5+ ranks in one week | 100 | Rare |
| Consistency King | No week with 0 XP for an entire month | 150 | Epic |

#### Special / Hidden Badges

| Badge | Condition | XP Reward | Rarity |
|-------|-----------|-----------|--------|
| Early Bird | Complete a task before 8 AM | 30 | Rare |
| Night Owl | Complete a task after midnight | 30 | Rare |
| Perfect Week | Complete all assigned tasks in a week | 200 | Epic |
| Speedster | Complete 5 tasks in one hour | 100 | Epic |
| Marathon Coder | Log 8+ hours in one day on time tracker | 50 | Rare |
| Clean Record | Complete semester with 0 anti-cheat flags | 300 | Epic |

### 6.3 Badge Design Rules

| Rule | Decision |
|------|----------|
| **Permanent or temporary?** | Permanent — once earned, never lost |
| **Badge levels (Bronze→Platinum)?** | Yes, for tiered badges (tasks, streaks). Each tier is a separate badge. |
| **Affect XP?** | Yes — each badge awards a one-time XP bonus on unlock |
| **Visible on profiles?** | Yes — top 5 badges displayed on profile card; full collection on profile page |
| **Hidden/surprise badges?** | Yes — "Special" category badges are hidden until unlocked. Condition shown as "???" |

### 6.4 Badge Notification Flow

```
Action triggers badge check → Badge unlocked?
  → YES: Create XpTransaction (badge bonus)
       → Create BadgeUnlock record
       → Send celebration notification (with confetti animation)
       → Update profile badge display
  → NO:  Update progress toward badge (if applicable)
       → If progress ≥ 80%: send "almost there" notification
```

---

## 7. Anti-Cheat System

### 7.1 Threat Model

| Cheat Vector | Risk Level | Description |
|-------------|-----------|-------------|
| Fake GitHub commits | 🔴 High | Empty commits, whitespace changes, auto-generated code |
| Task status manipulation | 🔴 High | Rapidly creating and completing trivial tasks |
| Duplicate submissions | 🟡 Medium | Submitting the same file multiple times |
| Discussion spam | 🟡 Medium | Posting meaningless replies for XP |
| Time tracker inflation | 🟡 Medium | Logging fake hours |
| Peer collusion | 🟡 Medium | Students systematically reviewing each other's empty PRs |
| Self-assign farming | 🟡 Medium | Creating tasks, self-assigning, instantly completing |
| Multiple account abuse | 🔴 High | Using alt accounts to inflate metrics |

### 7.2 Automated Validation Rules

#### GitHub Quality Gates

```javascript
// Pseudo-code for commit validation
function validateCommit(commit) {
  const checks = {
    nonEmpty: (commit.additions + commit.deletions) > 0,
    meaningfulSize: countMeaningfulLOC(commit) >= 5,
    messageQuality: commit.message.length >= 10 
                    && !BANNED_MESSAGES.includes(commit.message.toLowerCase()),
    notAutoGenerated: !isAutoGeneratedFile(commit.files),
    notBurstActivity: getCommitsInLastHour(commit.author) < 15,
    notDuplicate: !isDuplicateDiff(commit.diffHash),
  }
  return {
    passed: Object.values(checks).every(Boolean),
    failedChecks: Object.entries(checks).filter(([,v]) => !v).map(([k]) => k),
    suspicionScore: Object.values(checks).filter(v => !v).length,
  }
}
```

#### Task Completion Gates

| Check | Rule | Action |
|-------|------|--------|
| Minimum task age | Task must exist ≥5 minutes before completion | Block XP |
| Self-assign + instant complete | Created, assigned, and completed by same user in <10 min | Flag for review |
| Description minimum | Tasks must have ≥10 char title | No XP for blank tasks |
| Completion velocity | Max 20 task completions per day | Soft cap; excess flagged |
| Status manipulation | Cannot skip statuses (BACKLOG→DONE) | Require sequential flow |

#### Discussion Quality Gates

| Check | Rule |
|-------|------|
| Minimum length | Replies must be ≥30 characters |
| Duplicate detection | Hash reply content; reject if matches recent post |
| Rate limit | Max 20 posts per day |
| Self-reply | No XP for replying to your own thread |

### 7.3 Suspicion Scoring System

Each user maintains a rolling **Suspicion Score** (0–100):

| Score Range | Status | Action |
|-------------|--------|--------|
| 0–20 | ✅ Clean | Normal operation |
| 21–40 | ⚠️ Watch | Activity logged with extra detail |
| 41–60 | 🟡 Suspicious | New XP held for manual review |
| 61–80 | 🟠 High Risk | Notification sent to TA/doctor |
| 81–100 | 🔴 Flagged | All XP frozen; admin investigation required |

**Score increases:**

| Event | Score Impact |
|-------|-------------|
| Failed quality gate (any) | +5 |
| Burst activity detected | +10 |
| Duplicate content found | +15 |
| Self-merge without review | +10 |
| Reported by peer or TA | +20 |
| Multiple flags in 24h | ×1.5 multiplier |

**Score decreases:**
- −2 per day with no flags (natural decay)
- −10 when TA/doctor manually clears a flag
- Reset to 0 when admin explicitly clears after investigation

### 7.4 Rate Limits

| Resource | Limit | Window |
|----------|-------|--------|
| Task completions | 20 | Per day |
| Commits (XP-eligible) | 15 | Per hour |
| Discussion posts | 20 | Per day |
| PR reviews | 10 | Per day |
| Time tracker sessions | 4 | Per day |
| XP earned (soft cap) | 500 | Per day |

### 7.5 Manual Review Flow

```
Flagged Activity → Review Queue (visible to TA/Doctor/Admin)
  → Reviewer sees: user, activity details, suspicion score, flag reason
  → Options:
     [Approve] → XP applied, suspicion score −10
     [Reject]  → XP denied, suspicion score unchanged
     [Penalize] → XP denied, suspicion score +20, optional XP deduction
     [Escalate] → Forward to admin for further action
```

### 7.6 Penalties for Confirmed Cheating

| Severity | Penalty | Applied By |
|----------|---------|-----------|
| First offense (minor) | Warning notification + XP rollback for the flagged action | TA or Doctor |
| Second offense | 48-hour XP freeze (all earned XP held) + notification | Doctor |
| Third offense | 1-week XP freeze + badge "Probation" visible on profile | Admin |
| Severe (systematic abuse) | Full XP reset + leaderboard removal for the semester | Admin only |

### 7.7 XP Rollback Support

The `XpTransaction` model with `status` field supports rollback:

```
Rollback Process:
1. Admin selects transactions to roll back
2. System creates inverse transactions (negative amounts)
3. Original transactions marked status = "ROLLED_BACK"
4. User's XP balance recalculated
5. Affected badges re-evaluated (may be revoked if threshold no longer met)
6. Audit log entry created with reason
```

### 7.8 Appeal Process

Students can appeal anti-cheat decisions:

```
Student submits appeal (reason + evidence)
  → TA reviews within 48h
    → If TA approves: XP restored, suspicion score reduced
    → If TA denies: Student can escalate to Doctor
      → Doctor decision is final
  → All appeals logged in audit trail
```

---

> **Continued in Part 3:** Recommended Architecture, Best Practices & Final Recommendations
