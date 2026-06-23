export type HelpGuide = {
  id: string
  title: string
  filename: string
  summary: string
  sections: Array<{
    heading: string
    bullets: string[]
    tip: string
  }>
}

export const helpGuides: Record<string, HelpGuide> = {
  "getting-started": {
    id: "getting-started",
    title: "Getting Started Guide",
    filename: "getting-started-guide.pdf",
    summary:
      "A walkthrough of the ProjectHub dashboard, account setup, and the core navigation every student, team leader, doctor, and TA needs on day one.",
    sections: [
      {
        heading: "Setting up your account",
        bullets: [
          "Complete your profile (name, university ID, avatar) right after signup — supervisors and teammates identify you by this card across teams, tasks, and submissions.",
          "Pick the correct role context when you log in: student/leader accounts see team and task tools, while doctor and TA accounts see review queues and supervised teams instead.",
          "Set your notification preferences so deadline reminders, meeting invites, and submission feedback reach you the way you actually check them.",
        ],
        tip: "Your profile photo and role badge appear next to every comment and submission you make — set them up before your team starts reviewing your work.",
      },
      {
        heading: "Reading the dashboard",
        bullets: [
          "The stats cards at the top show your active tasks, upcoming deadlines, and current SDLC phase at a glance — check them every time you log in.",
          "The announcements feed surfaces messages from doctors and admins; pin or read these before starting work so you don't miss a phase deadline change.",
          "The activity timeline on the dashboard shows the last actions across your team (task moves, submissions, commits) so you can catch up after time away.",
        ],
        tip: "If your dashboard stats look stale, refresh the page — stats are computed from your team's latest tasks and submissions, not cached indefinitely.",
      },
      {
        heading: "Finding your way around",
        bullets: [
          "Use the sidebar to jump between Teams, Tasks, SDLC, Submissions, Meetings, GitHub, and Gamification — each section keeps its own state so switching back and forth is safe.",
          "The top search/quick-actions bar lets you jump straight to a specific task or team member without clicking through the sidebar.",
          "If you're blocked, check the in-app FAQ or contact your TA through the team page before escalating to your supervisor.",
        ],
        tip: "Bookmark the SDLC and Tasks pages — together they're where you'll spend most of your time once your team starts producing real deliverables.",
      },
    ],
  },
  teams: {
    id: "teams",
    title: "Teams and Collaboration Guide",
    filename: "teams-collaboration-guide.pdf",
    summary:
      "How to create or join a team, understand leader and member roles, and keep collaboration organized inside ProjectHub.",
    sections: [
      {
        heading: "Creating or joining a team",
        bullets: [
          "A team can be created by one student, who automatically becomes the team leader — leaders can rename the team, set the project title, and approve join requests.",
          "Members join either by accepting an invite link from the leader or by requesting to join a team that's marked as open, which the leader then approves.",
          "Each team is assigned a supervising doctor and, in most cases, a TA — both appear on your team page once assigned and gain visibility into your tasks and submissions.",
        ],
        tip: "Lock your team roster early — adding or removing members after submissions have started can complicate phase approvals and individual contribution tracking.",
      },
      {
        heading: "Roles and responsibilities",
        bullets: [
          "The leader manages team settings, assigns tasks to members, and is usually the one who submits deliverables on behalf of the team for each SDLC phase.",
          "Members can create and update their own tasks, comment on submissions, and link commits, but typically can't change team-wide settings or remove other members.",
          "Doctors and TAs see a read-and-review view of the team: they can comment on submissions, leave feedback, and approve or reject phase transitions, but don't edit team tasks directly.",
        ],
        tip: "If a member isn't pulling their weight, the leader should reassign their tasks early rather than waiting — supervisors can see per-member task completion on the team page.",
      },
      {
        heading: "Keeping collaboration healthy",
        bullets: [
          "Use task comments and the team activity feed instead of outside chat apps when a decision affects the project — it keeps a record your supervisor can also see.",
          "Review the team's combined task board weekly so work isn't silently piling up on one or two members.",
          "Resolve disagreements about scope or direction before a submission deadline — raise it in a meeting with your supervisor if the team can't agree.",
        ],
        tip: "Teams with balanced task ownership across members tend to score better in supervisor reviews — uneven workload is one of the most common feedback points doctors leave.",
      },
    ],
  },
  tasks: {
    id: "tasks",
    title: "Tasks and Projects Guide",
    filename: "tasks-projects-guide.pdf",
    summary:
      "How to create, prioritize, and move tasks across the kanban board so your team's daily work stays visible and on schedule.",
    sections: [
      {
        heading: "Creating tasks",
        bullets: [
          "Give every task a specific, action-oriented title (\"Implement login API validation\", not \"Backend stuff\") so it's clear what done looks like.",
          "Set a priority (Low, Medium, High) and a deadline on every task that's tied to an SDLC phase deliverable — undated tasks tend to get forgotten.",
          "Assign the task to one member as the owner; if multiple people contribute, note their part in the description so credit and accountability are clear.",
        ],
        tip: "Tasks without a deadline rarely get done on time — even a soft internal deadline a few days before the real submission date keeps the board honest.",
      },
      {
        heading: "Using the kanban board",
        bullets: [
          "Drag tasks across the three columns — To Do, In Progress, Done — as work actually progresses; don't batch updates at the end of the week.",
          "Keep In Progress limited to what's realistically being worked on right now — a column full of \"in progress\" tasks usually means work is stuck, not moving.",
          "Use task labels/priority colors to spot high-priority and overdue items at a glance before your next team or supervisor meeting.",
        ],
        tip: "Check the board together as a team right before any supervisor meeting — an accurate, up-to-date board is one of the fastest ways to look organized in a review.",
      },
      {
        heading: "Closing out work",
        bullets: [
          "Only move a task to Done once the output has actually been verified by the owner or leader — half-finished work sitting in Done hides real progress.",
          "Link related GitHub commits or pull requests to a task before closing it so there's a traceable record of what was implemented.",
          "Leave a short comment summarizing what was delivered when you close a task — it saves time later when writing phase submission reports.",
        ],
        tip: "Tasks that link a GitHub commit are far easier to defend in a supervisor review than tasks marked Done with no evidence attached.",
      },
    ],
  },
  sdlc: {
    id: "sdlc",
    title: "SDLC and Workflow Guide",
    filename: "sdlc-workflow-guide.pdf",
    summary:
      "How ProjectHub structures your graduation project across the six SDLC phases — Planning, Requirements, Design, Implementation, Testing, and Deployment.",
    sections: [
      {
        heading: "Understanding the six phases",
        bullets: [
          "Planning and Requirements come first: define your project scope, objectives, and functional/non-functional requirements before any design work starts.",
          "Design and Implementation follow: produce architecture/UI artifacts in Design, then build the actual system in Implementation, tracked through your tasks and GitHub commits.",
          "Testing and Deployment close out the project: verify the system works as specified, then prepare and document the final deployment or demo.",
        ],
        tip: "Check the SDLC page before starting new work each week — it shows your team's current phase and what's expected before you can move to the next one.",
      },
      {
        heading: "Moving between phases",
        bullets: [
          "Each phase has its own expected deliverables (documents, diagrams, code, test reports) — these usually map directly to what you upload in Submissions.",
          "A phase transition typically requires the leader to mark the phase's deliverables as submitted and the supervising doctor to approve the move forward.",
          "Don't start heavy work on the next phase before the current one is approved — rework caused by skipping ahead is one of the most common timeline killers.",
        ],
        tip: "If your doctor flags issues in a phase, fix and resubmit before moving on — the SDLC page won't always stop you from advancing, but unresolved gaps tend to resurface at the final defense.",
      },
      {
        heading: "Keeping phases consistent",
        bullets: [
          "Make sure your tasks, submissions, and meeting notes for a given week are tagged to the same phase — mismatched phases make it hard for supervisors to track real progress.",
          "Revisit your Requirements phase artifacts whenever scope changes during Implementation — outdated requirements documents are a common point lost during evaluation.",
          "Use the SDLC overview as your single source of truth when reporting progress to your doctor — it's what they'll reference during reviews and the final defense.",
        ],
        tip: "Teams that keep Requirements and Design documents updated as scope changes — instead of just at the start — consistently avoid last-minute scrambles before deployment.",
      },
    ],
  },
  submissions: {
    id: "submissions",
    title: "Submissions and Reviews Guide",
    filename: "submissions-reviews-guide.pdf",
    summary:
      "How to submit phase deliverables for supervisor review, track feedback, and handle resubmissions inside ProjectHub.",
    sections: [
      {
        heading: "Preparing a submission",
        bullets: [
          "Match your submission to the current SDLC phase — uploading a Design document while still marked in Requirements will confuse the review queue.",
          "Attach the actual files (documents, diagrams, links) rather than just a description — doctors and TAs review what's attached, not what's promised in the text box.",
          "Have the team leader do a final check of the submission before sending — once submitted, it enters the doctor's review queue and earlier drafts are typically not visible side by side.",
        ],
        tip: "Submit a day or two before the deadline, not at the last minute — it gives your doctor time to actually review it instead of rubber-stamping it under time pressure.",
      },
      {
        heading: "During review",
        bullets: [
          "Submissions move through statuses such as Pending, Under Review, Approved, or Needs Revision — check the submission page rather than waiting for a notification.",
          "Read every reviewer comment carefully; doctors and TAs often leave specific, file-level feedback rather than a single overall note.",
          "If feedback is unclear, ask for clarification in a comment or bring it up in your next scheduled meeting instead of guessing at the fix.",
        ],
        tip: "A submission marked 'Needs Revision' isn't a failure — it's normal mid-project feedback. Treat the specific comments as your resubmission checklist.",
      },
      {
        heading: "Resubmitting work",
        bullets: [
          "Address every comment from the previous review round individually — partial fixes are the most common reason a resubmission gets sent back again.",
          "Add a short changelog note summarizing what changed since the last version so the reviewer doesn't have to re-read the whole deliverable from scratch.",
          "Keep resubmissions tied to the same phase and submission thread rather than creating a brand-new submission — it preserves the review history.",
        ],
        tip: "Submissions with a clear changelog of what changed get approved faster — reviewers can verify the fix directly instead of re-reading everything.",
      },
    ],
  },
  meetings: {
    id: "meetings",
    title: "Meetings and Calendar Guide",
    filename: "meetings-calendar-guide.pdf",
    summary:
      "How to schedule meetings with your supervisor, prepare an agenda, and keep the calendar useful for the whole team.",
    sections: [
      {
        heading: "Scheduling a meeting",
        bullets: [
          "Request a meeting slot with your supervising doctor or TA through the Meetings page, including a short purpose so they know what to prepare for.",
          "Schedule meetings around your SDLC phase deadlines — a check-in just before a phase submission is due is far more useful than one right after.",
          "Only invite people who need to be there; large, unfocused meetings tend to run long without producing clear action items.",
        ],
        tip: "Send the meeting request at least 2-3 days ahead — doctors often supervise several teams and need lead time to fit you into their calendar.",
      },
      {
        heading: "Running an effective meeting",
        bullets: [
          "Bring a short written agenda (even 3-4 bullet points) so the discussion stays on the specific blockers or decisions you actually need input on.",
          "Have your current task board and SDLC phase status open during the call — supervisors will usually ask about both directly.",
          "Assign a note-taker so action items, owners, and due dates are captured live instead of being reconstructed from memory afterward.",
        ],
        tip: "Walk in with 2-3 specific questions for your doctor instead of a general status update — focused questions get focused, usable answers.",
      },
      {
        heading: "After the meeting",
        bullets: [
          "Turn every action item from the meeting into a task with an owner and deadline the same day, while context is still fresh.",
          "Save or share the meeting notes with teammates who couldn't attend so the whole team stays aligned on decisions made.",
          "Check the calendar view regularly to make sure new meetings don't collide with submission deadlines or other team commitments.",
        ],
        tip: "A meeting with no resulting tasks usually means the discussion didn't produce real decisions — convert at least one outcome into a tracked task before you close it out.",
      },
    ],
  },
  github: {
    id: "github",
    title: "GitHub Integration Guide",
    filename: "github-integration-guide.pdf",
    summary:
      "How to connect your team's repository to ProjectHub and use commit and branch tracking to show real implementation progress.",
    sections: [
      {
        heading: "Connecting your repository",
        bullets: [
          "Link your team's GitHub repository from the GitHub section so commits, branches, and contributors sync automatically into the workspace.",
          "Make sure the GitHub account you connect actually has access to the repo — a connection with insufficient permissions will show no activity even if the repo is active.",
          "Re-link the integration if you transfer the repository to a different organization or rename it, since the stored reference won't follow automatically.",
        ],
        tip: "Connect the repository at the very start of the Implementation phase — early commit history is what makes individual contribution tracking meaningful later.",
      },
      {
        heading: "Tracking activity",
        bullets: [
          "The commit feed shows who committed what and when, which doubles as evidence of individual contribution when supervisors ask who built a given feature.",
          "Branch tracking shows active feature branches so the leader can see what's being worked on without asking each member individually.",
          "Use commit messages that describe the actual change (\"fix task deadline validation\", not \"update\") — these messages are what shows up in the activity feed supervisors can see.",
        ],
        tip: "Commit small and often instead of one large commit before a deadline — frequent, descriptive commits make your GitHub activity feed actually useful as progress evidence.",
      },
      {
        heading: "Keeping the repo healthy",
        bullets: [
          "Link a pull request or commit hash to the related task before marking it Done — it ties the kanban board directly to real code changes.",
          "Review pull requests before merging into the main branch, especially close to a phase deadline when broken builds are hardest to recover from.",
          "Keep branch names consistent (e.g. feature/login, fix/task-board) so both your team and your supervisor can follow what each branch is for.",
        ],
        tip: "A clean, linked commit history is often the fastest way to prove implementation progress during a supervisor review — it's harder to dispute than a verbal status update.",
      },
    ],
  },
  gamification: {
    id: "gamification",
    title: "Gamification and Rewards Guide",
    filename: "gamification-rewards-guide.pdf",
    summary:
      "How XP, badges, achievements, and the leaderboard work in ProjectHub, and how to use them without losing focus on the actual project.",
    sections: [
      {
        heading: "Earning XP and badges",
        bullets: [
          "XP is awarded for concrete actions: completing tasks on time, submitting phase deliverables, attending scheduled meetings, and maintaining active GitHub commits.",
          "Badges unlock at specific milestones — for example, finishing a full SDLC phase, hitting a task-completion streak, or receiving an approved submission on the first try.",
          "Late or low-quality work earns little to no XP even if the task is eventually marked Done — the system rewards timely, verified completion, not just activity.",
        ],
        tip: "On-time submissions and meeting attendance are consistently the fastest way to earn XP — they're worth more than rushing through extra tasks.",
      },
      {
        heading: "Tracking your progress",
        bullets: [
          "Your Gamification page shows current XP, unlocked badges, and progress toward the next achievement — check it after major milestones like a phase approval.",
          "The leaderboard ranks members within your team (and optionally across teams) by XP, which can help surface who's been most active during a quiet phase.",
          "Achievements are permanent once unlocked, so even if your XP total resets or slows down, your badge history still reflects real milestones reached.",
        ],
        tip: "If your XP feels stuck, check whether your recent tasks were marked Done late — the system weights on-time completion more heavily than total task count.",
      },
      {
        heading: "Using rewards the right way",
        bullets: [
          "Treat XP and the leaderboard as a motivation layer, not the goal — a high score with a poorly reviewed final submission won't help at the defense.",
          "Use the leaderboard to spot imbalance early: if one member has dramatically less XP, it often means their tasks aren't being tracked or completed, not that gamification is unfair.",
          "Celebrate badge unlocks as a team at phase boundaries — it's a low-effort way to mark real progress milestones together.",
        ],
        tip: "Gamification reflects activity, not grades — a strong leaderboard position is a nice signal, but your doctor's review of actual deliverables is what counts.",
      },
    ],
  },
}

export function getHelpGuideById(id: string) {
  return helpGuides[id]
}
