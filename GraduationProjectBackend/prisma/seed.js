import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function upsertUser(user, passwordHash) {
  return prisma.user.upsert({
    where: { email: user.email },
    update: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? null,
      role: user.role,
      accountStatus: "ACTIVE",
      academicId: user.academicId,
      department: user.department ?? null,
      academicYear: user.academicYear ?? null,
      preferredTrack: user.preferredTrack ?? null,
      bio: user.bio ?? null,
      githubUsername: user.githubUsername ?? null,
      linkedinUrl: user.linkedinUrl ?? null,
      passwordHash,
      isEmailVerified: true,
    },
    create: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      accountStatus: "ACTIVE",
      academicId: user.academicId,
      department: user.department ?? null,
      academicYear: user.academicYear ?? null,
      preferredTrack: user.preferredTrack ?? null,
      bio: user.bio ?? null,
      githubUsername: user.githubUsername ?? null,
      linkedinUrl: user.linkedinUrl ?? null,
      passwordHash,
      isEmailVerified: true,
    },
  });
}

async function main() {
  const password = "demo123";
  const passwordHash = await bcrypt.hash(password, 10);

  console.log("Seeding users...");
  const demoUsers = [
    {
      firstName: "Sarah",
      lastName: "Admin",
      email: "admin@university.edu",
      role: "ADMIN",
      academicId: "ADMIN-0001",
      phone: "01000000001",
      department: "COMPUTER_SCIENCE",
      academicYear: "YEAR_5",
      preferredTrack: "SOFTWARE_ARCHITECTURE",
      bio: "Platform administrator responsible for managing GPMS users and system access.",
    },
    {
      firstName: "Ahmed",
      lastName: "Hassan",
      email: "ahmed.hassan@university.edu",
      role: "DOCTOR",
      academicId: "STAFF-0002",
      phone: "01000000002",
      department: "COMPUTER_SCIENCE",
      academicYear: "YEAR_5",
      preferredTrack: "CLOUD_ENGINEERING",
      bio: "Graduation project supervisor focused on scalable systems and cloud-native architecture.",
    },
    {
      firstName: "Mona",
      lastName: "Zaki",
      email: "mona.zaki@university.edu",
      role: "DOCTOR",
      academicId: "STAFF-0004",
      phone: "01000000004",
      department: "SOFTWARE_ENGINEERING",
      academicYear: "YEAR_5",
      preferredTrack: "SOFTWARE_ARCHITECTURE",
      bio: "Professor specializing in software engineering methodologies and agile processes.",
    },
    {
      firstName: "Layla",
      lastName: "Ibrahim",
      email: "layla.ibrahim@university.edu",
      role: "TA",
      academicId: "STAFF-0003",
      phone: "01000000003",
      department: "SOFTWARE_ENGINEERING",
      academicYear: "YEAR_5",
      preferredTrack: "QUALITY_ASSURANCE",
      bio: "TA supporting teams with testing strategy, release quality, and sprint execution.",
    },
    {
      firstName: "Omar",
      lastName: "Kamal",
      email: "omar.kamal@university.edu",
      role: "TA",
      academicId: "STAFF-0005",
      phone: "01000000005",
      department: "COMPUTER_SCIENCE",
      academicYear: "YEAR_5",
      preferredTrack: "BACKEND_DEVELOPMENT",
      bio: "Graduate assistant focusing on distributed systems and backend technologies.",
    },
    {
      firstName: "Mariam",
      lastName: "Salah",
      email: "mariam.salah@student.edu",
      role: "LEADER",
      academicId: "CS2021010",
      phone: "01000001010",
      department: "COMPUTER_SCIENCE",
      academicYear: "YEAR_4",
      preferredTrack: "FRONTEND_DEVELOPMENT",
      bio: "Team leader passionate about product design, frontend architecture, and polished user experience.",
      githubUsername: "mariam-salah",
    },
    {
      firstName: "Nour",
      lastName: "Hassan",
      email: "nour.hassan@student.edu",
      role: "LEADER",
      academicId: "CS2021002",
      phone: "01000001002",
      department: "COMPUTER_SCIENCE",
      academicYear: "YEAR_4",
      preferredTrack: "FULLSTACK_DEVELOPMENT",
      bio: "AI-focused team leader who enjoys translating research ideas into practical student products.",
      githubUsername: "nour-hassan",
    },
    {
      firstName: "Karim",
      lastName: "Mostafa",
      email: "karim.mostafa@student.edu",
      role: "LEADER",
      academicId: "CS2021003",
      phone: "01000001003",
      department: "SOFTWARE_ENGINEERING",
      academicYear: "YEAR_4",
      preferredTrack: "BACKEND_DEVELOPMENT",
      bio: "Backend-focused leader currently looking for the right project idea and teammates.",
      githubUsername: "karim-mostafa",
    },
    {
      firstName: "Ali",
      lastName: "Mahmoud",
      email: "ali.mahmoud@student.edu",
      role: "STUDENT",
      academicId: "CS2021011",
      phone: "01000001011",
      department: "SOFTWARE_ENGINEERING",
      academicYear: "YEAR_4",
      preferredTrack: "BACKEND_DEVELOPMENT",
      bio: "Backend student who enjoys API design, database modeling, and clean service architecture.",
      githubUsername: "ali-mahmoud",
    },
    {
      firstName: "Salma",
      lastName: "Youssef",
      email: "salma.youssef@student.edu",
      role: "STUDENT",
      academicId: "CS2021012",
      phone: "01000001012",
      department: "INFORMATION_TECHNOLOGY",
      academicYear: "YEAR_4",
      preferredTrack: "FRONTEND_DEVELOPMENT",
      bio: "Frontend student who loves accessible UI, smooth interactions, and thoughtful design systems.",
      githubUsername: "salma-youssef",
    },
    {
      firstName: "Hassan",
      lastName: "Omar",
      email: "hassan.omar@student.edu",
      role: "STUDENT",
      academicId: "CS2021013",
      phone: "01000001013",
      department: "CYBERSECURITY_INFOSEC",
      academicYear: "YEAR_4",
      preferredTrack: "DEVOPS",
      bio: "Security-minded student interested in deployment pipelines, infrastructure, and secure coding.",
      githubUsername: "hassan-omar",
    },
    {
      firstName: "Amira",
      lastName: "Khalil",
      email: "amira.khalil@student.edu",
      role: "STUDENT",
      academicId: "CS2021015",
      phone: "01000001015",
      department: "INFORMATION_SYSTEMS",
      academicYear: "YEAR_4",
      preferredTrack: "FULLSTACK_DEVELOPMENT",
      bio: "Full-stack student exploring collaboration opportunities and strong product-oriented teams.",
      githubUsername: "amira-khalil",
    },
    {
      firstName: "Hana",
      lastName: "Adel",
      email: "hana.adel@student.edu",
      role: "STUDENT",
      academicId: "CS2021014",
      phone: "01000001014",
      department: "COMPUTER_SCIENCE",
      academicYear: "YEAR_4",
      preferredTrack: "FRONTEND_DEVELOPMENT",
      bio: "Frontend student interested in collaborative projects, storytelling, and polished interfaces.",
      githubUsername: "hana-adel",
    },
  ];

  const users = {};
  for (const user of demoUsers) {
    const savedUser = await upsertUser(user, passwordHash);
    users[user.email] = savedUser;
  }

  console.log("Cleaning up existing team data...");
  await prisma.submission.deleteMany();
  await prisma.weeklyReport.deleteMany();
  await prisma.task.deleteMany();
  await prisma.gitHubSyncCursor.deleteMany();
  await prisma.gitHubWebhookDelivery.deleteMany();
  await prisma.gitHubTeamRepository.deleteMany();
  await prisma.gitHubUserConnection.deleteMany();
  await prisma.teamSupervisorRequest.deleteMany();
  await prisma.teamJoinRequest.deleteMany();
  await prisma.teamInvitation.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();

  console.log("Seeding teams...");
  const smartCampus = await prisma.team.create({
    data: {
      name: "Smart Campus",
      bio: "A connected campus platform for announcements, navigation, and smart facility usage insights.",
      leaderId: users["mariam.salah@student.edu"].id,
      doctorId: users["ahmed.hassan@university.edu"].id,
      taId: users["layla.ibrahim@university.edu"].id,
      inviteCode: "SMART-25A1",
      maxMembers: 5,
      visibility: "PUBLIC",
      allowJoinRequests: true,
      stage: "IMPLEMENTATION",
      stack: ["Next.js", "Node.js", "PostgreSQL", "Tailwind CSS"],
    },
  });

  const aiStudyAssistant = await prisma.team.create({
    data: {
      name: "AI Study Assistant",
      bio: "An AI-powered graduation project assistant that helps students organize materials and learning plans.",
      leaderId: users["nour.hassan@student.edu"].id,
      doctorId: users["ahmed.hassan@university.edu"].id,
      taId: users["layla.ibrahim@university.edu"].id,
      inviteCode: "AISTUD-Y2B",
      maxMembers: 4,
      visibility: "PRIVATE",
      allowJoinRequests: false,
      stage: "DESIGN",
      stack: ["Python", "FastAPI", "React", "OpenAI"],
    },
  });

  const cyberGuard = await prisma.team.create({
    data: {
      name: "CyberGuard",
      bio: "A real-time network security monitoring and threat detection system for small businesses.",
      leaderId: users["karim.mostafa@student.edu"].id,
      inviteCode: "CYBER-G9X",
      maxMembers: 5,
      visibility: "PUBLIC",
      allowJoinRequests: true,
      stage: "REQUIREMENTS",
      stack: ["Go", "Python", "ELK Stack", "Docker"],
    },
  });

  console.log("Seeding team members...");
  await prisma.teamMember.createMany({
    data: [
      { teamId: smartCampus.id, userId: users["ali.mahmoud@student.edu"].id },
      { teamId: smartCampus.id, userId: users["salma.youssef@student.edu"].id },
      { teamId: aiStudyAssistant.id, userId: users["hassan.omar@student.edu"].id },
    ],
  });

  console.log("Seeding team interactions...");
  await prisma.teamInvitation.create({
    data: {
      teamId: aiStudyAssistant.id,
      invitedUserId: users["amira.khalil@student.edu"].id,
      invitedById: users["nour.hassan@student.edu"].id,
      status: "PENDING",
    },
  });

  await prisma.teamJoinRequest.create({
    data: {
      teamId: smartCampus.id,
      userId: users["hana.adel@student.edu"].id,
      message: "I’d love to contribute on the frontend and help shape the student experience side of this project.",
      status: "PENDING",
    },
  });

  console.log("Seeding supervisor requests...");
  await prisma.teamSupervisorRequest.create({
    data: {
      teamId: cyberGuard.id,
      supervisorId: users["mona.zaki@university.edu"].id,
      requestedById: users["karim.mostafa@student.edu"].id,
      supervisorRole: "DOCTOR",
      projectName: "CyberGuard Threat Detection",
      projectDescription: "We are building a system that uses machine learning to detect network anomalies and alert administrators in real-time.",
      technologies: ["Python", "TensorFlow", "Scapy"],
      status: "PENDING",
    },
  });

  await prisma.teamSupervisorRequest.create({
    data: {
      teamId: cyberGuard.id,
      supervisorId: users["omar.kamal@university.edu"].id,
      requestedById: users["karim.mostafa@student.edu"].id,
      supervisorRole: "TA",
      projectName: "CyberGuard Threat Detection",
      projectDescription: "Seeking TA guidance for the backend architecture and data processing pipeline.",
      technologies: ["Go", "Kafka", "PostgreSQL"],
      status: "ACCEPTED",
      respondedAt: new Date(),
    },
  });

  console.log("Seeding GitHub data...");
  const gitHubRepo = await prisma.gitHubTeamRepository.create({
    data: {
      teamId: smartCampus.id,
      ownerLogin: "university-projects",
      ownerType: "ORGANIZATION",
      repoName: "smart-campus-gp",
      fullName: "university-projects/smart-campus-gp",
      defaultBranch: "main",
      visibility: "PUBLIC",
      repoUrl: "https://github.com/university-projects/smart-campus-gp",
      connectionStatus: "ACTIVE",
      syncStatus: "IDLE",
      lastSyncAt: new Date(),
    },
  });

  await prisma.gitHubUserConnection.create({
    data: {
      userId: users["mariam.salah@student.edu"].id,
      githubUserId: "12345678",
      login: "mariam-salah",
      displayName: "Mariam Salah",
      avatarUrl: "https://avatars.githubusercontent.com/u/12345678?v=4",
      accessTokenEncrypted: "encrypted-token-placeholder",
      isActive: true,
    },
  });

  console.log("Seeding tasks...");
  const tasks = [
    {
      teamId: smartCampus.id,
      title: "Design System Implementation",
      description: "Establish core UI components using Tailwind CSS and Radix UI.",
      status: "DONE",
      priority: "HIGH",
      assigneeUserId: users["mariam.salah@student.edu"].id,
      labels: ["UI/UX", "Frontend"],
    },
    {
      teamId: smartCampus.id,
      title: "Authentication Flow",
      description: "Implement JWT-based auth with refresh tokens and protected routes.",
      status: "IN_PROGRESS",
      priority: "CRITICAL",
      assigneeUserId: users["ali.mahmoud@student.edu"].id,
      labels: ["Security", "Backend"],
    },
    {
      teamId: smartCampus.id,
      title: "Interactive Campus Map",
      description: "Integrate Mapbox API to show facility locations and real-time navigation.",
      status: "TODO",
      priority: "MEDIUM",
      assigneeUserId: users["salma.youssef@student.edu"].id,
      labels: ["Feature", "API"],
    },
    {
      teamId: aiStudyAssistant.id,
      title: "OpenAI Integration",
      description: "Connect to GPT-4 API and implement initial prompt engineering for study plans.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeUserId: users["nour.hassan@student.edu"].id,
      labels: ["AI", "Backend"],
    },
    {
      teamId: aiStudyAssistant.id,
      title: "Database Schema Design",
      description: "Finalize the data models for student profiles, materials, and learning paths.",
      status: "DONE",
      priority: "MEDIUM",
      assigneeUserId: users["hassan.omar@student.edu"].id,
      labels: ["Database"],
    },
  ];

  for (const task of tasks) {
    await prisma.task.create({ data: task });
  }

  console.log("Seeding weekly reports...");
  await prisma.weeklyReport.create({
    data: {
      teamId: smartCampus.id,
      submittedById: users["mariam.salah@student.edu"].id,
      weekLabel: "Week 1 - Project Kickoff",
      periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(),
      summaryFinal: "Successfully initialized the repository, set up the development environment, and finalized the core requirements document. Team roles have been assigned and the initial design system is under development.",
      isSubmitted: true,
      submittedAt: new Date(),
    },
  });

  console.log("Seeding submissions...");
  await prisma.submission.create({
    data: {
      teamId: smartCampus.id,
      deliverableType: "SRS",
      sdlcPhase: "REQUIREMENTS",
      sourceType: "MANUAL_UPLOAD",
      artifactUrl: "https://example.com/docs/smart-campus-srs.pdf",
      version: 1,
      submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      deadline: new Date(),
      late: false,
      feedback: "Well-structured document. Please ensure the sequence diagrams are updated in the next version.",
      grade: 95,
    },
  });

  await prisma.submission.create({
    data: {
      teamId: smartCampus.id,
      deliverableType: "UML",
      sdlcPhase: "DESIGN",
      sourceType: "MANUAL_UPLOAD",
      artifactUrl: "https://example.com/docs/smart-campus-uml.pdf",
      version: 1,
      submittedAt: new Date(),
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      late: false,
    },
  });

  // ─── Gamification: Seed Rules & Badges ───────────────────────
  await seedGamificationRules();
  await seedBadgeDefinitions();

  console.log("Seed completed successfully!");
}

// ─────────────────────────────────────────────────────────────
// Gamification Rules (v1) — idempotent via upsert on [code, version]
// ─────────────────────────────────────────────────────────────
async function seedGamificationRules() {
  console.log("Seeding gamification rules...");

  const rules = [
    // ── Task XP rules ──
    {
      code: "TASK_APPROVED_CODE",
      name: "Code Task Approved",
      description: "XP awarded to assignee when a CODE task is approved.",
      eventType: "TASK_APPROVED",
      targetType: "USER",
      baseXp: 80,
      conditions: { taskType: "CODE" },
      multipliers: {
        difficulty: { LOW: 0.8, MEDIUM: 1.0, HIGH: 1.25, CRITICAL: 1.5 },
        timeliness: { onTime: 1.0, lt24h: 0.8, lt3d: 0.6, lt7d: 0.4, gt7d: 0 },
        evidence: { repoBackedWithPR: 1.15, repoBackedNoPR: 1.0, manual: 0.5 },
      },
      caps: { maxPerTask: 1 },
    },
    {
      code: "TASK_APPROVED_DOCUMENTATION",
      name: "Documentation Task Approved",
      description: "XP awarded to assignee when a DOCUMENTATION task is approved.",
      eventType: "TASK_APPROVED",
      targetType: "USER",
      baseXp: 60,
      conditions: { taskType: "DOCUMENTATION" },
      multipliers: {
        difficulty: { LOW: 0.8, MEDIUM: 1.0, HIGH: 1.25, CRITICAL: 1.5 },
        timeliness: { onTime: 1.0, lt24h: 0.8, lt3d: 0.6, lt7d: 0.4, gt7d: 0 },
      },
      caps: { maxPerTask: 1 },
    },
    {
      code: "TASK_APPROVED_DESIGN",
      name: "Design Task Approved",
      description: "XP awarded to assignee when a DESIGN task is approved.",
      eventType: "TASK_APPROVED",
      targetType: "USER",
      baseXp: 70,
      conditions: { taskType: "DESIGN" },
      multipliers: {
        difficulty: { LOW: 0.8, MEDIUM: 1.0, HIGH: 1.25, CRITICAL: 1.5 },
        timeliness: { onTime: 1.0, lt24h: 0.8, lt3d: 0.6, lt7d: 0.4, gt7d: 0 },
      },
      caps: { maxPerTask: 1 },
    },
    {
      code: "TASK_APPROVED_RESEARCH",
      name: "Research Task Approved",
      description: "XP awarded to assignee when a RESEARCH task is approved.",
      eventType: "TASK_APPROVED",
      targetType: "USER",
      baseXp: 50,
      conditions: { taskType: "RESEARCH" },
      multipliers: {
        difficulty: { LOW: 0.8, MEDIUM: 1.0, HIGH: 1.25, CRITICAL: 1.5 },
        timeliness: { onTime: 1.0, lt24h: 0.8, lt3d: 0.6, lt7d: 0.4, gt7d: 0 },
      },
      caps: { maxPerTask: 1 },
    },
    {
      code: "TASK_APPROVED_MEETING",
      name: "Meeting Task Approved",
      description: "XP awarded to assignee when a MEETING task is approved.",
      eventType: "TASK_APPROVED",
      targetType: "USER",
      baseXp: 20,
      conditions: { taskType: "MEETING" },
      multipliers: {},
      caps: { maxPerTask: 1 },
    },
    {
      code: "TASK_APPROVED_PRESENTATION",
      name: "Presentation Task Approved",
      description: "XP awarded to assignee when a PRESENTATION task is approved.",
      eventType: "TASK_APPROVED",
      targetType: "USER",
      baseXp: 60,
      conditions: { taskType: "PRESENTATION" },
      multipliers: {
        difficulty: { LOW: 0.8, MEDIUM: 1.0, HIGH: 1.25, CRITICAL: 1.5 },
        timeliness: { onTime: 1.0, lt24h: 0.8, lt3d: 0.6, lt7d: 0.4, gt7d: 0 },
      },
      caps: { maxPerTask: 1 },
    },
    {
      code: "TASK_APPROVED_OTHER",
      name: "Other Task Approved",
      description: "XP awarded to assignee when an OTHER task is approved.",
      eventType: "TASK_APPROVED",
      targetType: "USER",
      baseXp: 30,
      conditions: { taskType: "OTHER" },
      multipliers: {
        difficulty: { LOW: 0.8, MEDIUM: 1.0, HIGH: 1.25, CRITICAL: 1.5 },
      },
      caps: { maxPerTask: 1 },
    },
    // ── Submission / Deliverable XP rules ──
    {
      code: "SUBMISSION_APPROVED_SRS_TEAM",
      name: "SRS Submission Approved (Team)",
      description: "Team XP for approved SRS deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "TEAM",
      baseXp: 300,
      conditions: { deliverableType: "SRS" },
      multipliers: {
        quality: { "90-100": 1.2, "80-89": 1.0, "70-79": 0.8, "60-69": 0.5, below60: 0 },
      },
      caps: { maxPerSubmissionVersion: 1 },
    },
    {
      code: "SUBMISSION_APPROVED_SRS_SUBMITTER",
      name: "SRS Submission Approved (Submitter)",
      description: "Submitter XP for approved SRS deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "USER",
      baseXp: 30,
      conditions: { deliverableType: "SRS" },
      multipliers: {},
      caps: { maxPerSubmissionVersion: 1 },
    },
    {
      code: "SUBMISSION_APPROVED_UML_TEAM",
      name: "UML Submission Approved (Team)",
      description: "Team XP for approved UML deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "TEAM",
      baseXp: 250,
      conditions: { deliverableType: "UML" },
      multipliers: {
        quality: { "90-100": 1.2, "80-89": 1.0, "70-79": 0.8, "60-69": 0.5, below60: 0 },
      },
      caps: { maxPerSubmissionVersion: 1 },
    },
    {
      code: "SUBMISSION_APPROVED_UML_SUBMITTER",
      name: "UML Submission Approved (Submitter)",
      description: "Submitter XP for approved UML deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "USER",
      baseXp: 25,
      conditions: { deliverableType: "UML" },
      multipliers: {},
      caps: { maxPerSubmissionVersion: 1 },
    },
    {
      code: "SUBMISSION_APPROVED_PROTOTYPE_TEAM",
      name: "Prototype Submission Approved (Team)",
      description: "Team XP for approved Prototype deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "TEAM",
      baseXp: 300,
      conditions: { deliverableType: "PROTOTYPE" },
      multipliers: {
        quality: { "90-100": 1.2, "80-89": 1.0, "70-79": 0.8, "60-69": 0.5, below60: 0 },
      },
      caps: { maxPerSubmissionVersion: 1 },
    },
    {
      code: "SUBMISSION_APPROVED_PROTOTYPE_SUBMITTER",
      name: "Prototype Submission Approved (Submitter)",
      description: "Submitter XP for approved Prototype deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "USER",
      baseXp: 30,
      conditions: { deliverableType: "PROTOTYPE" },
      multipliers: {},
      caps: { maxPerSubmissionVersion: 1 },
    },
    {
      code: "SUBMISSION_APPROVED_CODE_TEAM",
      name: "Code Submission Approved (Team)",
      description: "Team XP for approved Code deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "TEAM",
      baseXp: 500,
      conditions: { deliverableType: "CODE" },
      multipliers: {
        quality: { "90-100": 1.2, "80-89": 1.0, "70-79": 0.8, "60-69": 0.5, below60: 0 },
      },
      caps: { maxPerSubmissionVersion: 1 },
    },
    {
      code: "SUBMISSION_APPROVED_CODE_SUBMITTER",
      name: "Code Submission Approved (Submitter)",
      description: "Submitter XP for approved Code deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "USER",
      baseXp: 40,
      conditions: { deliverableType: "CODE" },
      multipliers: {},
      caps: { maxPerSubmissionVersion: 1 },
    },
    {
      code: "SUBMISSION_APPROVED_TEST_PLAN_TEAM",
      name: "Test Plan Submission Approved (Team)",
      description: "Team XP for approved Test Plan deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "TEAM",
      baseXp: 300,
      conditions: { deliverableType: "TEST_PLAN" },
      multipliers: {
        quality: { "90-100": 1.2, "80-89": 1.0, "70-79": 0.8, "60-69": 0.5, below60: 0 },
      },
      caps: { maxPerSubmissionVersion: 1 },
    },
    {
      code: "SUBMISSION_APPROVED_TEST_PLAN_SUBMITTER",
      name: "Test Plan Submission Approved (Submitter)",
      description: "Submitter XP for approved Test Plan deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "USER",
      baseXp: 30,
      conditions: { deliverableType: "TEST_PLAN" },
      multipliers: {},
      caps: { maxPerSubmissionVersion: 1 },
    },
    {
      code: "SUBMISSION_APPROVED_FINAL_REPORT_TEAM",
      name: "Final Report Submission Approved (Team)",
      description: "Team XP for approved Final Report deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "TEAM",
      baseXp: 450,
      conditions: { deliverableType: "FINAL_REPORT" },
      multipliers: {
        quality: { "90-100": 1.2, "80-89": 1.0, "70-79": 0.8, "60-69": 0.5, below60: 0 },
      },
      caps: { maxPerSubmissionVersion: 1 },
    },
    {
      code: "SUBMISSION_APPROVED_FINAL_REPORT_SUBMITTER",
      name: "Final Report Submission Approved (Submitter)",
      description: "Submitter XP for approved Final Report deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "USER",
      baseXp: 40,
      conditions: { deliverableType: "FINAL_REPORT" },
      multipliers: {},
      caps: { maxPerSubmissionVersion: 1 },
    },
    {
      code: "SUBMISSION_APPROVED_PRESENTATION_TEAM",
      name: "Presentation Submission Approved (Team)",
      description: "Team XP for approved Presentation deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "TEAM",
      baseXp: 300,
      conditions: { deliverableType: "PRESENTATION" },
      multipliers: {
        quality: { "90-100": 1.2, "80-89": 1.0, "70-79": 0.8, "60-69": 0.5, below60: 0 },
      },
      caps: { maxPerSubmissionVersion: 1 },
    },
    {
      code: "SUBMISSION_APPROVED_PRESENTATION_SUBMITTER",
      name: "Presentation Submission Approved (Submitter)",
      description: "Submitter XP for approved Presentation deliverable.",
      eventType: "SUBMISSION_APPROVED",
      targetType: "USER",
      baseXp: 30,
      conditions: { deliverableType: "PRESENTATION" },
      multipliers: {},
      caps: { maxPerSubmissionVersion: 1 },
    },
    // ── GitHub XP rules ──
    {
      code: "GITHUB_PR_MERGED_TASK_LINKED",
      name: "Task-Linked PR Merged",
      description: "XP for PR author when a task-linked PR is merged and validated.",
      eventType: "GITHUB_PR_MERGED",
      targetType: "USER",
      baseXp: 60,
      conditions: { requireTaskLink: true },
      multipliers: {
        evidence: { highValueDiff: 2.0, normalDiff: 1.0, trivialDiff: 0 },
      },
      caps: { maxPerTask: 1, maxXpPerPR: 120 },
    },
    {
      code: "GITHUB_PR_REVIEWED",
      name: "PR Review Submitted",
      description: "XP for non-author reviewer who submits a meaningful PR review.",
      eventType: "GITHUB_PR_REVIEWED",
      targetType: "USER",
      baseXp: 20,
      conditions: { excludeSelfReview: true, requireBody: true },
      multipliers: {},
      caps: { maxPerUserPerDay: 3, maxPerUserPerWeek: 10 },
    },
    // ── Release & Milestone rules ──
    {
      code: "GITHUB_RELEASE_CREATED_TEAM",
      name: "GitHub Release Created (Team)",
      description: "Team XP for creating a validated release tied to a submission or milestone.",
      eventType: "GITHUB_RELEASE_CREATED",
      targetType: "TEAM",
      baseXp: 100,
      conditions: { requireSubmissionOrMilestone: true },
      multipliers: {},
      caps: { maxPerRelease: 1 },
    },
    {
      code: "TEAM_STAGE_ADVANCED_TEAM",
      name: "SDLC Stage Advanced (Team)",
      description: "Team XP for advancing to the next SDLC stage.",
      eventType: "TEAM_STAGE_ADVANCED",
      targetType: "TEAM",
      baseXp: 150,
      conditions: {},
      multipliers: {},
      caps: { maxPerStageTransition: 1 },
    },
    // ── Manual adjustment rule ──
    {
      code: "MANUAL_XP_ADJUSTMENT",
      name: "Manual XP Adjustment",
      description: "XP granted or deducted via approved staff manual adjustment.",
      eventType: "MANUAL_XP_ADJUSTMENT_APPROVED",
      targetType: "USER",
      baseXp: 0,
      conditions: {},
      multipliers: {},
      caps: {},
    },
    // ── Badge unlock XP rule ──
    {
      code: "BADGE_UNLOCK_XP",
      name: "Badge Unlock XP Reward",
      description: "One-time XP reward when a badge is unlocked.",
      eventType: "BADGE_UNLOCKED",
      targetType: "USER",
      baseXp: 0,
      conditions: {},
      multipliers: {},
      caps: { maxPerBadgePerRecipient: 1 },
    },
  ];

  for (const rule of rules) {
    await prisma.gamificationRule.upsert({
      where: {
        code_version: { code: rule.code, version: 1 },
      },
      update: {
        name: rule.name,
        description: rule.description,
        eventType: rule.eventType,
        targetType: rule.targetType,
        baseXp: rule.baseXp,
        conditions: rule.conditions,
        multipliers: rule.multipliers,
        caps: rule.caps,
        isActive: true,
      },
      create: {
        code: rule.code,
        version: 1,
        name: rule.name,
        description: rule.description,
        eventType: rule.eventType,
        targetType: rule.targetType,
        baseXp: rule.baseXp,
        conditions: rule.conditions,
        multipliers: rule.multipliers,
        caps: rule.caps,
        isActive: true,
      },
    });
  }

  console.log(`  → ${rules.length} gamification rules seeded.`);
}

// ─────────────────────────────────────────────────────────────
// Badge Definitions — idempotent via upsert on unique code
// ─────────────────────────────────────────────────────────────
async function seedBadgeDefinitions() {
  console.log("Seeding badge definitions...");

  const badges = [
    // ── Task badges ──
    {
      code: "FIRST_TASK_APPROVED",
      name: "First Steps",
      description: "Earned when your first task is approved.",
      category: "tasks",
      rarity: "COMMON",
      targetType: "USER",
      criteria: { event: "TASK_APPROVED", count: 1 },
      xpReward: 15,
      icon: "check-circle",
    },
    {
      code: "TASKS_APPROVED_10",
      name: "Task Champion",
      description: "10 approved tasks completed.",
      category: "tasks",
      rarity: "RARE",
      targetType: "USER",
      criteria: { event: "TASK_APPROVED", count: 10 },
      xpReward: 30,
      icon: "award",
    },
    {
      code: "TASKS_APPROVED_25",
      name: "Task Master",
      description: "25 approved tasks completed.",
      category: "tasks",
      rarity: "EPIC",
      targetType: "USER",
      criteria: { event: "TASK_APPROVED", count: 25 },
      xpReward: 50,
      icon: "trophy",
    },
    {
      code: "TASKS_APPROVED_50",
      name: "Task Legend",
      description: "50 approved tasks completed.",
      category: "tasks",
      rarity: "LEGENDARY",
      targetType: "USER",
      criteria: { event: "TASK_APPROVED", count: 50 },
      xpReward: 100,
      icon: "crown",
    },
    // ── Submission badges ──
    {
      code: "FIRST_SUBMISSION_APPROVED",
      name: "Deliverable Pioneer",
      description: "Earned when your first submission is approved.",
      category: "submissions",
      rarity: "COMMON",
      targetType: "USER",
      criteria: { event: "SUBMISSION_APPROVED", count: 1 },
      xpReward: 20,
      icon: "file-check",
    },
    {
      code: "PERFECT_SCORE",
      name: "Perfect Score",
      description: "Earned when a submission receives a grade of 100.",
      category: "submissions",
      rarity: "EPIC",
      targetType: "USER",
      criteria: { event: "SUBMISSION_APPROVED", gradeEquals: 100 },
      xpReward: 40,
      icon: "star",
    },
    // ── GitHub badges ──
    {
      code: "FIRST_PR_MERGED",
      name: "Code Contributor",
      description: "Earned when your first validated PR is merged.",
      category: "github",
      rarity: "COMMON",
      targetType: "USER",
      criteria: { event: "GITHUB_PR_MERGED", count: 1 },
      xpReward: 15,
      icon: "git-pull-request",
    },
    {
      code: "PR_REVIEWS_10",
      name: "Code Reviewer",
      description: "Reviewed 10 pull requests.",
      category: "github",
      rarity: "RARE",
      targetType: "USER",
      criteria: { event: "GITHUB_PR_REVIEWED", count: 10 },
      xpReward: 25,
      icon: "eye",
    },
    {
      code: "GITHUB_CONNECTED",
      name: "Connected",
      description: "Earned when you link your GitHub account.",
      category: "setup",
      rarity: "COMMON",
      targetType: "USER",
      criteria: { event: "GITHUB_CONNECTED" },
      xpReward: 15,
      icon: "github",
    },
    // ── Team badges ──
    {
      code: "TEAM_FOUNDER",
      name: "Team Founder",
      description: "Earned by the leader who creates a team.",
      category: "team",
      rarity: "COMMON",
      targetType: "USER",
      criteria: { event: "TEAM_CREATED" },
      xpReward: 25,
      icon: "users",
    },
    {
      code: "STAGE_DESIGN_REACHED",
      name: "Design Phase",
      description: "Team reached the Design stage.",
      category: "milestones",
      rarity: "COMMON",
      targetType: "TEAM",
      criteria: { event: "TEAM_STAGE_ADVANCED", stage: "DESIGN" },
      xpReward: 20,
      icon: "pen-tool",
    },
    {
      code: "STAGE_IMPLEMENTATION_REACHED",
      name: "Building It",
      description: "Team reached the Implementation stage.",
      category: "milestones",
      rarity: "RARE",
      targetType: "TEAM",
      criteria: { event: "TEAM_STAGE_ADVANCED", stage: "IMPLEMENTATION" },
      xpReward: 30,
      icon: "code",
    },
    {
      code: "STAGE_TESTING_REACHED",
      name: "Quality Check",
      description: "Team reached the Testing stage.",
      category: "milestones",
      rarity: "RARE",
      targetType: "TEAM",
      criteria: { event: "TEAM_STAGE_ADVANCED", stage: "TESTING" },
      xpReward: 30,
      icon: "test-tube",
    },
    {
      code: "STAGE_DEPLOYMENT_REACHED",
      name: "Launch Ready",
      description: "Team reached the Deployment stage.",
      category: "milestones",
      rarity: "EPIC",
      targetType: "TEAM",
      criteria: { event: "TEAM_STAGE_ADVANCED", stage: "DEPLOYMENT" },
      xpReward: 50,
      icon: "rocket",
    },
    {
      code: "STAGE_MAINTENANCE_REACHED",
      name: "Project Complete",
      description: "Team reached the Maintenance stage — project delivered!",
      category: "milestones",
      rarity: "LEGENDARY",
      targetType: "TEAM",
      criteria: { event: "TEAM_STAGE_ADVANCED", stage: "MAINTENANCE" },
      xpReward: 75,
      icon: "shield-check",
    },
  ];

  for (const badge of badges) {
    await prisma.badgeDefinition.upsert({
      where: { code: badge.code },
      update: {
        name: badge.name,
        description: badge.description,
        category: badge.category,
        rarity: badge.rarity,
        targetType: badge.targetType,
        criteria: badge.criteria,
        xpReward: badge.xpReward,
        icon: badge.icon,
        isActive: true,
      },
      create: {
        code: badge.code,
        name: badge.name,
        description: badge.description,
        category: badge.category,
        rarity: badge.rarity,
        targetType: badge.targetType,
        criteria: badge.criteria,
        xpReward: badge.xpReward,
        icon: badge.icon,
        isActive: true,
      },
    });
  }

  console.log(`  → ${badges.length} badge definitions seeded.`);
}

main()
  .then(async () => {
    console.log("You can login using password: demo123");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
