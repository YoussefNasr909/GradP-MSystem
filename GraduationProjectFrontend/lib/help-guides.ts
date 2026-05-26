export type HelpGuide = {
  id: string
  title: string
  filename: string
  summary: string
  sections: Array<{
    heading: string
    bullets: string[]
  }>
}

export const helpGuides: Record<string, HelpGuide> = {
  "getting-started": {
    id: "getting-started",
    title: "Getting Started Guide",
    filename: "getting-started-guide.pdf",
    summary: "Use this guide to understand the main ProjectHub pages and complete your first setup steps.",
    sections: [
      {
        heading: "First steps",
        bullets: [
          "Complete your profile details so your team and supervisors can identify you quickly.",
          "Review the dashboard cards to understand where tasks, meetings, and updates appear.",
        ],
      },
      {
        heading: "Daily use",
        bullets: [
          "Check announcements and deadlines at the start of each session.",
          "Use the sidebar to move between your team workspace, tasks, submissions, and support pages.",
        ],
      },
      {
        heading: "Best result",
        bullets: [
          "Keep your profile and notification settings updated before starting project work.",
          "Ask for help from the support pages when something blocks your progress.",
        ],
      },
    ],
  },
  teams: {
    id: "teams",
    title: "Teams and Collaboration Guide",
    filename: "teams-collaboration-guide.pdf",
    summary: "This guide explains how to work smoothly with your team inside ProjectHub.",
    sections: [
      {
        heading: "Team setup",
        bullets: [
          "Create or join the correct team before starting tasks or submissions.",
          "Confirm that each member has the right role and access level.",
        ],
      },
      {
        heading: "Communication",
        bullets: [
          "Use the shared workspace and messages to keep everyone aligned on progress.",
          "Document decisions so teammates can follow changes without confusion.",
        ],
      },
      {
        heading: "Healthy workflow",
        bullets: [
          "Split work clearly so ownership is visible across the whole team.",
          "Review blockers early instead of waiting until deadlines are close.",
        ],
      },
    ],
  },
  tasks: {
    id: "tasks",
    title: "Tasks and Projects Guide",
    filename: "tasks-projects-guide.pdf",
    summary: "This guide covers the basics of creating, tracking, and completing project tasks.",
    sections: [
      {
        heading: "Task creation",
        bullets: [
          "Write clear task titles and descriptions so the assigned member knows the expected result.",
          "Set a deadline and priority level for every important task.",
        ],
      },
      {
        heading: "Tracking progress",
        bullets: [
          "Move tasks through the board stages as work changes from planned to done.",
          "Update task notes whenever scope or dependencies change.",
        ],
      },
      {
        heading: "Delivery",
        bullets: [
          "Close tasks only after the required work has been reviewed.",
          "Use comments and linked items to preserve context for the team.",
        ],
      },
    ],
  },
  sdlc: {
    id: "sdlc",
    title: "SDLC and Workflow Guide",
    filename: "sdlc-workflow-guide.pdf",
    summary: "Use this guide to follow the expected workflow from planning to final delivery.",
    sections: [
      {
        heading: "Project phases",
        bullets: [
          "Understand which phase your team is currently working in before making updates.",
          "Review each phase goals and deliverables before moving forward.",
        ],
      },
      {
        heading: "Phase movement",
        bullets: [
          "Complete required artifacts before requesting a transition to the next phase.",
          "Coordinate with supervisors when approvals are required.",
        ],
      },
      {
        heading: "Consistency",
        bullets: [
          "Keep tasks, reports, and submissions aligned with the current SDLC stage.",
          "Use the workflow pages as the single source of truth for progress.",
        ],
      },
    ],
  },
  submissions: {
    id: "submissions",
    title: "Submissions and Reviews Guide",
    filename: "submissions-reviews-guide.pdf",
    summary: "This guide explains how to submit work correctly and follow the review cycle.",
    sections: [
      {
        heading: "Before submission",
        bullets: [
          "Double-check that files, links, and notes match the submission requirements.",
          "Confirm that the latest approved version is being uploaded.",
        ],
      },
      {
        heading: "Review cycle",
        bullets: [
          "Track reviewer comments and status updates after every submission.",
          "Respond to requested changes with a clear updated version.",
        ],
      },
      {
        heading: "Resubmission",
        bullets: [
          "Apply feedback carefully before sending a new revision.",
          "Keep a short summary of what changed so reviewers can verify faster.",
        ],
      },
    ],
  },
  meetings: {
    id: "meetings",
    title: "Meetings and Calendar Guide",
    filename: "meetings-calendar-guide.pdf",
    summary: "Use this guide to schedule meetings, stay organized, and keep meeting notes useful.",
    sections: [
      {
        heading: "Scheduling",
        bullets: [
          "Pick a clear meeting purpose and invite the right people only.",
          "Add the meeting early enough for teammates and supervisors to prepare.",
        ],
      },
      {
        heading: "Running meetings",
        bullets: [
          "Prepare a small agenda so discussion stays focused.",
          "Capture action items, owners, and due dates before the meeting ends.",
        ],
      },
      {
        heading: "Follow-up",
        bullets: [
          "Review notes and update related tasks after the meeting.",
          "Use the calendar view to avoid clashes with other deadlines.",
        ],
      },
    ],
  },
  github: {
    id: "github",
    title: "GitHub Integration Guide",
    filename: "github-integration-guide.pdf",
    summary: "This guide explains how to connect your repository and track GitHub activity inside ProjectHub.",
    sections: [
      {
        heading: "Connection",
        bullets: [
          "Link the correct repository so commits and branches appear in the workspace.",
          "Verify that the connected account has access to the team repository.",
        ],
      },
      {
        heading: "Collaboration",
        bullets: [
          "Use branch names and pull requests that match the team workflow.",
          "Check commit and branch activity regularly inside the GitHub section.",
        ],
      },
      {
        heading: "Quality",
        bullets: [
          "Review changes before merging and keep pull requests focused.",
          "Document important code decisions so teammates can follow the history.",
        ],
      },
    ],
  },
  gamification: {
    id: "gamification",
    title: "Gamification and Rewards Guide",
    filename: "gamification-rewards-guide.pdf",
    summary: "Use this guide to understand how XP, achievements, and rewards are earned in ProjectHub.",
    sections: [
      {
        heading: "How rewards work",
        bullets: [
          "XP is earned by completing meaningful work and participating consistently.",
          "Achievements unlock when you reach specific activity or quality milestones.",
        ],
      },
      {
        heading: "Tracking progress",
        bullets: [
          "Review your gamification page to see current progress and unlocked badges.",
          "Use rankings as motivation, not as a replacement for good teamwork.",
        ],
      },
      {
        heading: "Best use",
        bullets: [
          "Focus on valuable contributions instead of chasing points only.",
          "Keep your work quality high so rewards reflect real progress.",
        ],
      },
    ],
  },
}

export function getHelpGuideById(id: string) {
  return helpGuides[id]
}
