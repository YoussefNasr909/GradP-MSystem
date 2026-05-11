import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

// ─── Enums (kept in sync with schema.prisma) ────────────────────────────────

const DEPARTMENTS = [
  "COMPUTER_SCIENCE",
  "SOFTWARE_ENGINEERING",
  "INFORMATION_TECHNOLOGY",
  "COMPUTER_ENGINEERING",
  "DATA_SCIENCE",
  "ARTIFICIAL_INTELLIGENCE",
  "CYBERSECURITY_INFOSEC",
  "INFORMATION_SYSTEMS",
  "BIOINFORMATICS",
];

const ACADEMIC_YEARS = ["YEAR_1", "YEAR_2", "YEAR_3", "YEAR_4", "YEAR_5"];

const PREFERRED_TRACKS = [
  "FRONTEND_DEVELOPMENT",
  "BACKEND_DEVELOPMENT",
  "FULLSTACK_DEVELOPMENT",
  "MOBILE_APP_DEVELOPMENT",
  "DEVOPS",
  "CLOUD_ENGINEERING",
  "SOFTWARE_ARCHITECTURE",
  "QUALITY_ASSURANCE",
  "GAME_DEVELOPMENT",
];

const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "APPROVED", "DONE"];
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const TASK_TYPES = ["CODE", "DOCUMENTATION", "DESIGN", "RESEARCH", "MEETING", "PRESENTATION", "OTHER"];

const TEAM_STAGE_ORDER = ["REQUIREMENTS", "DESIGN", "IMPLEMENTATION", "TESTING", "DEPLOYMENT", "MAINTENANCE"];

const DELIVERABLE_TO_PHASE = {
  SRS: "REQUIREMENTS",
  UML: "DESIGN",
  PROTOTYPE: "IMPLEMENTATION",
  CODE: "IMPLEMENTATION",
  TEST_PLAN: "TESTING",
  FINAL_REPORT: "DEPLOYMENT",
  PRESENTATION: "DEPLOYMENT",
};

// Same rubric templates as the frontend (kept identical so seeded data looks
// natural when a doctor opens a submission).
const RUBRIC_TEMPLATES = {
  SRS: [
    { name: "Problem Definition",        maxScore: 20 },
    { name: "Functional Requirements",   maxScore: 25 },
    { name: "Non-Functional Requirements", maxScore: 15 },
    { name: "Use Cases",                 maxScore: 20 },
    { name: "Documentation Quality",     maxScore: 20 },
  ],
  UML: [
    { name: "Class Diagram",         maxScore: 25 },
    { name: "Sequence Diagrams",     maxScore: 20 },
    { name: "Activity Diagrams",     maxScore: 20 },
    { name: "Database Schema",       maxScore: 20 },
    { name: "Architecture Diagram",  maxScore: 15 },
  ],
  CODE: [
    { name: "Functionality",    maxScore: 30 },
    { name: "Code Quality",     maxScore: 20 },
    { name: "Test Coverage",    maxScore: 15 },
    { name: "Documentation",    maxScore: 15 },
    { name: "Git Hygiene",      maxScore: 10 },
    { name: "Security",         maxScore: 10 },
  ],
  PROTOTYPE: [
    { name: "UI/UX Quality",        maxScore: 30 },
    { name: "Interactivity",        maxScore: 25 },
    { name: "Coverage of Features", maxScore: 25 },
    { name: "Design Consistency",   maxScore: 20 },
  ],
  TEST_PLAN: [
    { name: "Test Strategy",     maxScore: 20 },
    { name: "Unit Tests",        maxScore: 25 },
    { name: "Integration Tests", maxScore: 20 },
    { name: "Edge Cases",        maxScore: 20 },
    { name: "Documentation",     maxScore: 15 },
  ],
  FINAL_REPORT: [
    { name: "Structure & Clarity", maxScore: 25 },
    { name: "Technical Depth",     maxScore: 30 },
    { name: "Results & Analysis",  maxScore: 25 },
    { name: "References",          maxScore: 10 },
    { name: "Formatting",          maxScore: 10 },
  ],
  PRESENTATION: [
    { name: "Content Coverage",     maxScore: 30 },
    { name: "Slide Quality",        maxScore: 20 },
    { name: "Delivery & Confidence",maxScore: 25 },
    { name: "Q&A Handling",         maxScore: 25 },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSome(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function chance(p) {
  return Math.random() < p;
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Build a realistic rubric whose criteria scores sum to `targetGrade` out of 100.
 * We distribute the loss proportionally across criteria so percentages look natural.
 */
function buildRubricForGrade(type, targetGrade) {
  const template = RUBRIC_TEMPLATES[type];
  if (!template) return null;

  const totalMax = template.reduce((s, c) => s + c.maxScore, 0);
  const targetPoints = Math.round((targetGrade / 100) * totalMax);

  // Distribute targetPoints across criteria with small random jitter
  let allocated = 0;
  const scores = template.map((c, i) => {
    if (i === template.length - 1) {
      // Last criterion: assign whatever remains, clamped to [0, maxScore]
      const remaining = Math.max(0, Math.min(c.maxScore, targetPoints - allocated));
      return remaining;
    }
    const proportional = Math.round((c.maxScore / totalMax) * targetPoints);
    const jitter = faker.number.int({ min: -2, max: 2 });
    const score = Math.max(0, Math.min(c.maxScore, proportional + jitter));
    allocated += score;
    return score;
  });

  return template.map((c, i) => ({
    name: c.name,
    score: scores[i],
    maxScore: c.maxScore,
  }));
}

function realisticGrade() {
  // Bias toward 75-90 with occasional outliers
  const r = Math.random();
  if (r < 0.05) return faker.number.int({ min: 50, max: 64 }); // 5% struggling
  if (r < 0.15) return faker.number.int({ min: 65, max: 74 }); // 10% passing
  if (r < 0.55) return faker.number.int({ min: 75, max: 84 }); // 40% good
  if (r < 0.90) return faker.number.int({ min: 85, max: 92 }); // 35% great
  return faker.number.int({ min: 93, max: 100 });              // 10% excellent
}

// ─── Cleanup (delete in FK-safe order) ──────────────────────────────────────

async function cleanup() {
  console.log("Cleaning up existing data...");

  // Notifications + chat (depend on users)
  await prisma.notification.deleteMany();
  await prisma.directChatMessage.deleteMany();
  await prisma.directChatConversation.deleteMany();
  await prisma.teamGroupMessage.deleteMany();
  await prisma.teamGroupConversationParticipant.deleteMany();
  await prisma.teamGroupConversation.deleteMany();

  // Discussions
  await prisma.discussionView.deleteMany();
  await prisma.discussionLike.deleteMany();
  await prisma.discussionComment.deleteMany();
  await prisma.discussion.deleteMany();

  // Meetings
  await prisma.meetingApproval.deleteMany();
  await prisma.meetingParticipant.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.calendarIntegration.deleteMany();

  // New supervisor tooling
  await prisma.announcement.deleteMany();
  await prisma.teamDeliverableDeadline.deleteMany();
  await prisma.teamSupervisorNote.deleteMany();

  // Team work
  await prisma.proposal.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.weeklyReport.deleteMany();
  await prisma.task.deleteMany();
  await prisma.risk.deleteMany();
  await prisma.teamResource.deleteMany();
  await prisma.teamDocument.deleteMany();

  // GitHub
  await prisma.gitHubSyncCursor.deleteMany();
  await prisma.gitHubWebhookDelivery.deleteMany();
  await prisma.gitHubTeamRepository.deleteMany();
  await prisma.gitHubUserConnection.deleteMany();

  // Team relations
  await prisma.teamSupervisorRequest.deleteMany();
  await prisma.teamJoinRequest.deleteMany();
  await prisma.teamInvitation.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();

  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();
}

// ─── User seeding ───────────────────────────────────────────────────────────

async function seedUsers(passwordHash) {
  console.log("Seeding users...");

  const admin = await prisma.user.create({
    data: {
      firstName: "Admin",
      lastName: "User",
      email: "admin@university.edu",
      role: "ADMIN",
      academicId: "ADMIN-0001",
      phone: "01012345678",
      passwordHash,
      isEmailVerified: true,
      accountStatus: "ACTIVE",
      department: "COMPUTER_SCIENCE",
      academicYear: "YEAR_5",
      preferredTrack: "SOFTWARE_ARCHITECTURE",
    },
  });

  const doctors = [];
  for (let i = 0; i < 10; i++) {
    const doctor = await prisma.user.create({
      data: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: `doctor${i}@university.edu`,
        role: "DOCTOR",
        academicId: `STAFF-D-${1000 + i}`,
        phone: faker.phone.number(),
        passwordHash,
        isEmailVerified: true,
        accountStatus: "ACTIVE",
        department: pick(DEPARTMENTS),
        academicYear: "YEAR_5",
        preferredTrack: pick(PREFERRED_TRACKS),
        bio: faker.lorem.sentence(),
      },
    });
    doctors.push(doctor);
  }

  const tas = [];
  for (let i = 0; i < 10; i++) {
    const ta = await prisma.user.create({
      data: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: `ta${i}@university.edu`,
        role: "TA",
        academicId: `STAFF-TA-${2000 + i}`,
        phone: faker.phone.number(),
        passwordHash,
        isEmailVerified: true,
        accountStatus: "ACTIVE",
        department: pick(DEPARTMENTS),
        academicYear: "YEAR_5",
        preferredTrack: pick(PREFERRED_TRACKS),
        bio: faker.lorem.sentence(),
      },
    });
    tas.push(ta);
  }

  const students = [];
  for (let i = 0; i < 200; i++) {
    const student = await prisma.user.create({
      data: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: `student${i}@student.edu`,
        role: "STUDENT",
        academicId: `STU-${3000 + i}`,
        phone: faker.phone.number(),
        passwordHash,
        isEmailVerified: true,
        accountStatus: "ACTIVE",
        department: pick(DEPARTMENTS),
        academicYear: pick(ACADEMIC_YEARS),
        preferredTrack: pick(PREFERRED_TRACKS),
        bio: faker.lorem.sentence(),
      },
    });
    students.push(student);
  }

  return { admin, doctors, tas, students };
}

// ─── Team-level seeding ─────────────────────────────────────────────────────

/**
 * Decide team stage distribution so the demo has teams at every phase.
 * 30 teams: 5 REQ, 5 DESIGN, 8 IMPLEMENTATION, 5 TESTING, 5 DEPLOYMENT, 2 MAINTENANCE
 */
function pickTeamStage(index) {
  if (index < 5)  return "REQUIREMENTS";
  if (index < 10) return "DESIGN";
  if (index < 18) return "IMPLEMENTATION";
  if (index < 23) return "TESTING";
  if (index < 28) return "DEPLOYMENT";
  return "MAINTENANCE";
}

/**
 * Realistic proposal state given the team's current SDLC stage.
 * Any team past REQUIREMENTS must have an APPROVED proposal.
 */
function pickProposalStatus(teamStage) {
  if (teamStage === "REQUIREMENTS") {
    return pick(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED", "APPROVED"]);
  }
  return "APPROVED";
}

/**
 * Returns the list of SDLC phases this team has *completed* (relative to stage).
 * E.g. a team in TESTING has REQ + DESIGN + IMPLEMENTATION completed.
 */
function completedPhases(stage) {
  const idx = TEAM_STAGE_ORDER.indexOf(stage);
  return TEAM_STAGE_ORDER.slice(0, idx);
}

// ─── Per-team feature seeding ───────────────────────────────────────────────

async function seedProposalForTeam(team, leader, doctors) {
  const status = pickProposalStatus(team.stage);
  const techPool = ["React", "Next.js", "Vue", "Angular", "Node.js", "Express", "PostgreSQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS", "GCP", "Python", "FastAPI", "Django", "TensorFlow", "PyTorch"];

  // Pick the team's real doctor if assigned; otherwise random
  const reviewer = team.doctorId ? doctors.find((d) => d.id === team.doctorId) : pick(doctors);

  const submittedAt = status === "DRAFT" ? null : daysAgo(faker.number.int({ min: 14, max: 90 }));
  const reviewedAt = (status === "APPROVED" || status === "REJECTED" || status === "REVISION_REQUESTED")
    ? daysAgo(faker.number.int({ min: 1, max: 60 }))
    : null;

  let feedback = null;
  if (status === "APPROVED")           feedback = "Strong proposal — clear problem statement and realistic scope. Approved.";
  if (status === "REVISION_REQUESTED") feedback = "Solid direction but the methodology section needs more detail. Please clarify your testing strategy and timeline.";
  if (status === "REJECTED")           feedback = "Scope is too broad for a single-semester project. Please narrow the problem domain and resubmit.";

  await prisma.proposal.create({
    data: {
      teamId: team.id,
      authoredByUserId: leader.id,
      title: `${faker.company.catchPhraseAdjective()} ${faker.company.buzzNoun()} platform`,
      abstract: faker.lorem.paragraph(4),
      problemStatement: faker.lorem.paragraph(5),
      scope: faker.lorem.paragraph(3),
      methodology: `Agile SDLC with ${faker.helpers.arrayElement(["weekly", "bi-weekly", "monthly"])} sprints. ${faker.lorem.sentences(2)}`,
      timeline: `Phase 1 (Requirements): Weeks 1-3\nPhase 2 (Design): Weeks 4-6\nPhase 3 (Implementation): Weeks 7-12\nPhase 4 (Testing): Weeks 13-14\nPhase 5 (Deployment): Weeks 15-16`,
      objectives: [
        "Solve a real-world problem identified in the abstract",
        "Apply software engineering best practices",
        "Deliver a working MVP by mid-semester",
        "Document the system thoroughly",
        ...pickSome([
          "Achieve 80%+ test coverage",
          "Deploy to a public cloud provider",
          "Conduct user testing with at least 10 participants",
          "Open-source the final code",
        ], faker.number.int({ min: 1, max: 3 })),
      ],
      technologies: pickSome(techPool, faker.number.int({ min: 4, max: 8 })),
      deliverables: [
        "SRS Document",
        "UML Diagrams",
        "Source Code (GitHub repo)",
        "Test Plan & Reports",
        "Final Project Report",
        "Project Presentation",
      ],
      status,
      feedback,
      reviewedByUserId: reviewedAt ? reviewer.id : null,
      reviewedAt,
      submittedAt,
      version: status === "REVISION_REQUESTED" ? 2 : 1,
      revisionCount: status === "REVISION_REQUESTED" ? 1 : 0,
    },
  });
}

async function seedSubmissionsForTeam(team, leader, doctor, ta) {
  // Past phases → all required deliverables APPROVED with grades
  // Current phase → mixed state (some PENDING, some UNDER_REVIEW, some APPROVED)
  // Future phases → nothing

  const phaseConfig = {
    REQUIREMENTS:   ["SRS"],
    DESIGN:         ["UML"],
    IMPLEMENTATION: ["CODE", "PROTOTYPE"],
    TESTING:        ["TEST_PLAN"],
    DEPLOYMENT:     ["FINAL_REPORT", "PRESENTATION"],
    MAINTENANCE:    [],
  };

  const past = completedPhases(team.stage);
  const all = [...past, team.stage];

  for (const phase of all) {
    const deliverables = phaseConfig[phase] ?? [];
    for (const type of deliverables) {
      const isPastPhase = phase !== team.stage;
      let status, grade = null, taRecommendedGrade = null, taFeedback = null;
      let rubric = null, doctorFeedback = null;
      let taReviewedAt = null, taReviewedByUserId = null;
      let reviewedAt = null, reviewedByUserId = null;

      if (isPastPhase) {
        // Past phases: must be APPROVED to allow progression
        const finalGrade = realisticGrade();
        const taGrade = Math.max(0, Math.min(100, finalGrade + faker.number.int({ min: -5, max: 5 })));

        status = "APPROVED";
        grade = finalGrade;
        taRecommendedGrade = taGrade;
        taFeedback = "Good work overall. " + faker.lorem.sentence();
        doctorFeedback = "Approved. " + faker.lorem.sentence();
        rubric = buildRubricForGrade(type, finalGrade);
        taReviewedAt = daysAgo(faker.number.int({ min: 30, max: 120 }));
        taReviewedByUserId = ta?.id;
        reviewedAt = daysAgo(faker.number.int({ min: 1, max: 30 }));
        reviewedByUserId = doctor?.id;
      } else {
        // Current phase: mix of states
        const stateRoll = Math.random();

        if (stateRoll < 0.25) {
          // 25% — still pending (just uploaded, awaiting TA)
          status = "PENDING";
        } else if (stateRoll < 0.55) {
          // 30% — TA reviewed, doctor pending
          const taGrade = realisticGrade();
          status = "UNDER_REVIEW";
          taRecommendedGrade = taGrade;
          taFeedback = "Quality work. " + faker.lorem.sentence();
          rubric = buildRubricForGrade(type, taGrade);
          taReviewedAt = daysAgo(faker.number.int({ min: 1, max: 7 }));
          taReviewedByUserId = ta?.id;
        } else if (stateRoll < 0.75) {
          // 20% — revision required
          status = "REVISION_REQUIRED";
          doctorFeedback = "Please address the following: " + faker.lorem.sentences(2);
          reviewedAt = daysAgo(faker.number.int({ min: 1, max: 14 }));
          reviewedByUserId = doctor?.id ?? ta?.id;
        } else {
          // 25% — already approved (team is wrapping up this phase)
          const finalGrade = realisticGrade();
          const taGrade = Math.max(0, Math.min(100, finalGrade + faker.number.int({ min: -5, max: 5 })));
          status = "APPROVED";
          grade = finalGrade;
          taRecommendedGrade = taGrade;
          taFeedback = "Good work. " + faker.lorem.sentence();
          doctorFeedback = "Approved. " + faker.lorem.sentence();
          rubric = buildRubricForGrade(type, finalGrade);
          taReviewedAt = daysAgo(faker.number.int({ min: 7, max: 21 }));
          taReviewedByUserId = ta?.id;
          reviewedAt  = daysAgo(faker.number.int({ min: 1, max: 7 }));
          reviewedByUserId = doctor?.id;
        }
      }

      await prisma.submission.create({
        data: {
          teamId: team.id,
          deliverableType: type,
          sdlcPhase: phase,
          sourceType: "MANUAL_UPLOAD",
          title: `${type} — v${faker.number.int({ min: 1, max: 3 })}`,
          notes: faker.lorem.sentence(),
          status,
          fileName: `${type.toLowerCase()}-${team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
          fileSize: faker.number.int({ min: 50_000, max: 5_000_000 }),
          fileType: "PDF",
          fileUrl: faker.internet.url(),
          version: 1,
          submittedByUserId: leader.id,
          submittedAt: isPastPhase
            ? daysAgo(faker.number.int({ min: 60, max: 180 }))
            : daysAgo(faker.number.int({ min: 1, max: 14 })),
          deadline: daysFromNow(faker.number.int({ min: -30, max: 30 })),
          late: isPastPhase ? false : chance(0.15),

          // Two-step review
          taRecommendedGrade,
          taFeedback,
          taReviewedAt,
          taReviewedByUserId,

          grade,
          feedback: doctorFeedback,
          reviewedAt,
          reviewedByUserId,

          rubric,
        },
      });
    }
  }
}

async function seedSupervisorNotesForTeam(team, doctor, ta) {
  const noteCount = faker.number.int({ min: 2, max: 5 });
  const noteTemplates = [
    "Team is making steady progress. Stand-ups are productive.",
    "Concerns about timeline — they're slightly behind on the current phase.",
    "Leader is doing a great job coordinating the team.",
    "Members seem disengaged in the last meeting. Worth a chat.",
    "Excellent technical depth in their architecture decisions.",
    "Need to double-check their testing approach next milestone.",
    "Communication with stakeholders could be improved.",
    "Code reviews are thorough — good engineering culture.",
    "Considering recommending this team for the showcase event.",
    "Watch the scope creep — they keep adding features.",
  ];

  for (let i = 0; i < noteCount; i++) {
    const author = chance(0.6) ? doctor : ta;
    if (!author) continue;
    await prisma.teamSupervisorNote.create({
      data: {
        teamId: team.id,
        authorUserId: author.id,
        authorRole: author.role,
        content: pick(noteTemplates),
        createdAt: daysAgo(faker.number.int({ min: 1, max: 90 })),
      },
    });
  }
}

async function seedDeadlinesForTeam(team, doctor, ta) {
  const upcomingDeliverables = {
    REQUIREMENTS:   ["SRS"],
    DESIGN:         ["UML"],
    IMPLEMENTATION: ["CODE", "PROTOTYPE"],
    TESTING:        ["TEST_PLAN"],
    DEPLOYMENT:     ["FINAL_REPORT", "PRESENTATION"],
    MAINTENANCE:    [],
  };

  const author = doctor ?? ta;
  if (!author) return;

  // Set deadlines for the current + next phase deliverables
  const currentIdx = TEAM_STAGE_ORDER.indexOf(team.stage);
  const phasesToSeed = [team.stage, TEAM_STAGE_ORDER[currentIdx + 1]].filter(Boolean);

  for (const phase of phasesToSeed) {
    const deliverables = upcomingDeliverables[phase] ?? [];
    for (const type of deliverables) {
      // Avoid unique-key collision: only one deadline per (team, deliverableType)
      const offset = phase === team.stage
        ? faker.number.int({ min: -7, max: 21 })  // current phase: maybe overdue, maybe soon
        : faker.number.int({ min: 21, max: 60 }); // next phase: future

      await prisma.teamDeliverableDeadline.create({
        data: {
          teamId: team.id,
          deliverableType: type,
          dueDate: daysFromNow(offset),
          setByUserId: author.id,
          note: chance(0.4) ? `Target deadline for the ${type} deliverable.` : null,
        },
      }).catch(() => {}); // Skip if a deadline for this (team, type) already exists
    }
  }
}

async function seedRisksForTeam(team, leader, doctor) {
  const riskCount = faker.number.int({ min: 1, max: 4 });
  const riskTemplates = [
    { title: "Tight timeline for testing", category: "Schedule" },
    { title: "Third-party API rate limits", category: "Technical" },
    { title: "Team member workload imbalance", category: "Team" },
    { title: "Cloud hosting costs may exceed budget", category: "Budget" },
    { title: "Database migration risk on deployment", category: "Technical" },
    { title: "Security concerns with auth flow", category: "Security" },
    { title: "User feedback may require redesign", category: "Scope" },
    { title: "Dependency on external dataset", category: "Data" },
  ];

  const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const CHANCES = ["LOW", "MEDIUM", "HIGH"];
  const STATUSES = ["OPEN", "MONITORING", "RESOLVED"];

  for (let i = 0; i < riskCount; i++) {
    const t = pick(riskTemplates);
    const status = pick(STATUSES);
    const approvalStatus = status === "RESOLVED" ? "APPROVED" : pick(["PENDING", "APPROVED", "REVISION_REQUESTED"]);

    await prisma.risk.create({
      data: {
        teamId: team.id,
        title: t.title,
        description: faker.lorem.paragraph(2),
        category: t.category,
        chance: pick(CHANCES),
        impact: pick(CHANCES),
        severity: pick(SEVERITIES),
        status,
        approvalStatus,
        mitigation: chance(0.7) ? faker.lorem.sentences(2) : null,
        monitoringNotes: status === "MONITORING" ? faker.lorem.sentence() : null,
        resolutionNotes: status === "RESOLVED" ? faker.lorem.sentence() : null,
        createdByUserId: leader.id,
        approvedByUserId: approvalStatus === "APPROVED" && doctor ? doctor.id : null,
        approvedAt: approvalStatus === "APPROVED" ? daysAgo(faker.number.int({ min: 1, max: 30 })) : null,
        createdAt: daysAgo(faker.number.int({ min: 14, max: 90 })),
      },
    });
  }
}

async function seedMeetingsForTeam(team, leader, doctor, ta) {
  const meetingCount = faker.number.int({ min: 2, max: 5 });
  const STATUSES = ["CONFIRMED", "CONFIRMED", "CONFIRMED", "COMPLETED", "CANCELLED"];
  const MODES = ["VIRTUAL", "VIRTUAL", "IN_PERSON", "HYBRID"];

  for (let i = 0; i < meetingCount; i++) {
    const isPast = chance(0.6);
    const startAt = isPast
      ? daysAgo(faker.number.int({ min: 1, max: 60 }))
      : daysFromNow(faker.number.int({ min: 1, max: 30 }));
    const endAt = new Date(startAt.getTime() + faker.number.int({ min: 30, max: 90 }) * 60 * 1000);

    const status = isPast ? "COMPLETED" : pick(STATUSES);
    const organizer = chance(0.5) ? leader : (chance(0.7) ? (doctor ?? ta) : (ta ?? doctor));
    if (!organizer) continue;

    await prisma.meeting.create({
      data: {
        teamId: team.id,
        organizerId: organizer.id,
        organizerRole: organizer.role,
        title: pick([
          "Sprint planning",
          "Phase review",
          "Doctor checkpoint",
          "Technical deep-dive",
          "Demo rehearsal",
          "Risk review",
          "Mid-phase check-in",
        ]),
        description: faker.lorem.sentences(2),
        agenda: faker.lorem.paragraph(),
        startAt,
        endAt,
        timezone: "Africa/Cairo",
        mode: pick(MODES),
        status,
        provider: pick(["GOOGLE_MEET", "MICROSOFT_TEAMS", "MANUAL"]),
        location: chance(0.4) ? faker.location.streetAddress() : null,
        joinUrl: chance(0.6) ? faker.internet.url() : null,
        requiresApproval: false,
        confirmedAt: status === "CONFIRMED" || status === "COMPLETED" ? daysAgo(1) : null,
        cancelledAt: status === "CANCELLED" ? daysAgo(1) : null,
      },
    });
  }
}

async function seedTasksForTeam(team, allTeamUsers, leader, ta) {
  for (let k = 0; k < 40; k++) {
    const status = pick(TASK_STATUSES);
    const assignee = pick(allTeamUsers);
    const isReviewed = status === "APPROVED" || status === "DONE";

    await prisma.task.create({
      data: {
        teamId: team.id,
        title: faker.hacker.phrase(),
        description: faker.lorem.paragraph(),
        status,
        priority: pick(TASK_PRIORITIES),
        taskType: pick(TASK_TYPES),
        assigneeUserId: assignee.id,
        createdByUserId: leader.id,
        reviewedByUserId: isReviewed && ta ? ta.id : null,
        reviewedAt: isReviewed ? daysAgo(faker.number.int({ min: 1, max: 30 })) : null,
        reviewDecision: isReviewed ? "APPROVED" : null,
        labels: [faker.hacker.adjective(), faker.hacker.noun()],
        dueDate: faker.date.future(),
        createdAt: faker.date.past(),
        acceptedAt: status !== "BACKLOG" && status !== "TODO" ? daysAgo(faker.number.int({ min: 1, max: 60 })) : null,
        submittedForReviewAt: status === "REVIEW" || isReviewed ? daysAgo(faker.number.int({ min: 1, max: 14 })) : null,
      },
    });
  }
}

async function seedWeeklyReportsForTeam(team, leader) {
  for (let w = 1; w <= 8; w++) {
    await prisma.weeklyReport.create({
      data: {
        teamId: team.id,
        submittedById: leader.id,
        weekLabel: `Week ${w}`,
        summaryFinal: faker.lorem.sentences(3),
        isSubmitted: true,
        submittedAt: daysAgo(w * 7 + faker.number.int({ min: 0, max: 5 })),
      },
    }).catch(() => {}); // unique on (teamId, weekLabel) — safe to skip if collide
  }
}

// ─── Global content (announcements, interactions) ───────────────────────────

async function seedGlobalAnnouncements(doctors, tas) {
  const announcements = [
    {
      author: pick(doctors),
      title: "Phase 1 deadline reminder",
      content: "All teams in REQUIREMENTS — your SRS deliverable is due next Friday. Please review the rubric on the submission page before finalising.",
      pinned: true,
    },
    {
      author: pick(doctors),
      title: "Final defense schedule released",
      content: "The schedule for final project defenses has been posted. Please check your assigned slot and confirm availability with your team.",
      pinned: false,
    },
    {
      author: pick(tas),
      title: "New rubric templates available",
      content: "We've rolled out default rubrics for each deliverable type. When you submit, you'll see a suggested rubric — feel free to ask if anything's unclear.",
      pinned: false,
    },
    {
      author: pick(doctors),
      title: "Code freeze policy for IMPLEMENTATION phase",
      content: "Teams in the IMPLEMENTATION phase: starting next week, only bug-fix commits will be accepted. Plan your feature work accordingly.",
      pinned: false,
    },
  ];

  for (const a of announcements) {
    await prisma.announcement.create({
      data: {
        authorUserId: a.author.id,
        authorRole: a.author.role,
        teamId: null, // broadcast
        title: a.title,
        content: a.content,
        pinned: a.pinned,
        createdAt: daysAgo(faker.number.int({ min: 1, max: 30 })),
      },
    });
  }
}

async function seedInteractions(teams, students, doctors, tas) {
  console.log("Seeding invitations + join requests...");
  for (let i = 0; i < 50; i++) {
    const team = pick(teams);
    const student = pick(students);

    const isMember = await prisma.teamMember.findFirst({ where: { userId: student.id } });
    const isLeader = await prisma.team.findFirst({ where: { leaderId: student.id } });
    if (isMember || isLeader) continue;

    if (chance(0.5)) {
      await prisma.teamJoinRequest.create({
        data: {
          teamId: team.id,
          userId: student.id,
          message: faker.lorem.sentence(),
          status: "PENDING",
        },
      }).catch(() => {});
    } else {
      await prisma.teamInvitation.create({
        data: {
          teamId: team.id,
          invitedUserId: student.id,
          invitedById: team.leaderId,
          status: "PENDING",
        },
      }).catch(() => {});
    }
  }

  console.log("Seeding supervisor requests...");
  for (let i = 0; i < 20; i++) {
    const team = pick(teams);
    const doctor = pick(doctors);
    const ta = pick(tas);

    await prisma.teamSupervisorRequest.create({
      data: {
        teamId: team.id,
        supervisorId: doctor.id,
        requestedById: team.leaderId,
        supervisorRole: "DOCTOR",
        projectName: team.name,
        projectDescription: team.bio,
        status: pick(["PENDING", "ACCEPTED", "DECLINED"]),
      },
    }).catch(() => {});

    await prisma.teamSupervisorRequest.create({
      data: {
        teamId: team.id,
        supervisorId: ta.id,
        requestedById: team.leaderId,
        supervisorRole: "TA",
        projectName: team.name,
        projectDescription: team.bio,
        status: pick(["PENDING", "ACCEPTED", "DECLINED"]),
      },
    }).catch(() => {});
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const password = "demo123";
  const passwordHash = await bcrypt.hash(password, 10);

  await cleanup();

  const { admin, doctors, tas, students } = await seedUsers(passwordHash);

  console.log("Seeding teams + per-team data...");
  const teams = [];
  const TEAM_COUNT = 30;

  for (let i = 0; i < TEAM_COUNT; i++) {
    const leaderIndex = i * 4;
    const leader = students[leaderIndex];

    await prisma.user.update({
      where: { id: leader.id },
      data: { role: "LEADER" },
    });

    const stage = pickTeamStage(i);
    const doctor = pick(doctors);
    const ta = pick(tas);

    const team = await prisma.team.create({
      data: {
        name: faker.company.name().replace(/[^a-zA-Z0-9 ]/g, "") + " Project",
        bio: faker.company.catchPhrase(),
        leaderId: leader.id,
        doctorId: doctor.id,
        taId: ta.id,
        inviteCode: faker.string.alphanumeric(8).toUpperCase(),
        maxMembers: 5,
        visibility: pick(["PUBLIC", "PRIVATE"]),
        stage,
        stack: [
          pick(["React", "Next.js", "Vue", "Angular"]),
          pick(["Node.js", "Python", "Go", "Java"]),
          pick(["PostgreSQL", "MongoDB", "MySQL"]),
        ],
      },
    });
    teams.push({ ...team, leader, doctor, ta });

    // Add 1-3 members
    const memberCount = faker.number.int({ min: 1, max: 3 });
    const members = [];
    for (let j = 1; j <= memberCount; j++) {
      const member = students[leaderIndex + j];
      if (!member) continue;
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: member.id },
      }).catch(() => {});
      members.push(member);
    }

    const teamForChildren = { ...team, stage };
    const allTeamUsers = [leader, ...members];

    // Order matters less here since we're not relying on cross-row state
    await seedProposalForTeam(teamForChildren, leader, doctors);
    await seedSubmissionsForTeam(teamForChildren, leader, doctor, ta);
    await seedSupervisorNotesForTeam(teamForChildren, doctor, ta);
    await seedDeadlinesForTeam(teamForChildren, doctor, ta);
    await seedRisksForTeam(teamForChildren, leader, doctor);
    await seedMeetingsForTeam(teamForChildren, leader, doctor, ta);
    await seedTasksForTeam(teamForChildren, allTeamUsers, leader, ta);
    await seedWeeklyReportsForTeam(teamForChildren, leader);

    if ((i + 1) % 5 === 0) {
      console.log(`  ✓ Seeded ${i + 1}/${TEAM_COUNT} teams (current: ${team.name}, stage=${stage})`);
    }
  }

  console.log("Seeding global announcements...");
  await seedGlobalAnnouncements(doctors, tas);

  await seedInteractions(teams, students, doctors, tas);

  // ─── Summary ────────────────────────────────────────────────────────────
  const counts = {
    users: await prisma.user.count(),
    teams: await prisma.team.count(),
    proposals: await prisma.proposal.count(),
    submissions: await prisma.submission.count(),
    tasks: await prisma.task.count(),
    weeklyReports: await prisma.weeklyReport.count(),
    risks: await prisma.risk.count(),
    meetings: await prisma.meeting.count(),
    notes: await prisma.teamSupervisorNote.count(),
    deadlines: await prisma.teamDeliverableDeadline.count(),
    announcements: await prisma.announcement.count(),
    invitations: await prisma.teamInvitation.count(),
    joinRequests: await prisma.teamJoinRequest.count(),
    supervisorRequests: await prisma.teamSupervisorRequest.count(),
  };

  console.log("\n────────────────────────────────────────────");
  console.log("  Seed complete — login: any@user.edu / demo123");
  console.log("────────────────────────────────────────────");
  console.log(`  Users:                ${counts.users}`);
  console.log(`    1 Admin, 10 Doctors, 10 TAs, 200 Students (~30 are now Leaders)`);
  console.log(`  Teams:                ${counts.teams}`);
  console.log(`    Distributed across all 6 SDLC stages`);
  console.log(`  Proposals:            ${counts.proposals}`);
  console.log(`  Submissions:          ${counts.submissions}`);
  console.log(`    Two-step grading + rubric data, mix of states`);
  console.log(`  Tasks:                ${counts.tasks}`);
  console.log(`  Weekly reports:       ${counts.weeklyReports}`);
  console.log(`  Risks:                ${counts.risks}`);
  console.log(`  Meetings:             ${counts.meetings}`);
  console.log(`  Supervisor notes:     ${counts.notes}     (private per team)`);
  console.log(`  Deadlines:            ${counts.deadlines}`);
  console.log(`  Announcements:        ${counts.announcements}`);
  console.log(`  Join requests:        ${counts.joinRequests}`);
  console.log(`  Invitations:          ${counts.invitations}`);
  console.log(`  Supervisor requests:  ${counts.supervisorRequests}`);
  console.log("────────────────────────────────────────────");
  console.log(`  Try logging in as:`);
  console.log(`    admin@university.edu  (Admin)`);
  console.log(`    doctor0@university.edu (Doctor)`);
  console.log(`    ta0@university.edu    (TA)`);
  console.log(`    student0@student.edu  (Student/Leader)`);
  console.log("────────────────────────────────────────────\n");
}

main()
  .then(async () => {
    console.log("Huge data seeding finished.");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
