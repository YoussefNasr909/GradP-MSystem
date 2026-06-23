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
    {
      firstName: "Yusuf",
      lastName: "Sameh",
      email: "yusuf.sameh@student.edu",
      role: "LEADER",
      academicId: "CS2021006",
      phone: "01000001006",
      department: "INFORMATION_SYSTEMS",
      academicYear: "YEAR_4",
      preferredTrack: "FULLSTACK_DEVELOPMENT",
      bio: "Product-minded leader focused on healthcare workflow automation and usable dashboards.",
      githubUsername: "yusuf-sameh",
    },
    {
      firstName: "Farah",
      lastName: "Nabil",
      email: "farah.nabil@student.edu",
      role: "LEADER",
      academicId: "CS2021007",
      phone: "01000001007",
      department: "COMPUTER_SCIENCE",
      academicYear: "YEAR_4",
      preferredTrack: "CLOUD_ENGINEERING",
      bio: "Leader interested in sustainability products, geospatial systems, and resilient cloud services.",
      githubUsername: "farah-nabil",
    },
    {
      firstName: "Tarek",
      lastName: "Amin",
      email: "tarek.amin@student.edu",
      role: "LEADER",
      academicId: "CS2021008",
      phone: "01000001008",
      department: "SOFTWARE_ENGINEERING",
      academicYear: "YEAR_4",
      preferredTrack: "BACKEND_DEVELOPMENT",
      bio: "Backend-oriented leader building marketplace and payment-heavy graduation project ideas.",
      githubUsername: "tarek-amin",
    },
    {
      firstName: "Dina",
      lastName: "Fouad",
      email: "dina.fouad@student.edu",
      role: "LEADER",
      academicId: "CS2021009",
      phone: "01000001009",
      department: "INFORMATION_TECHNOLOGY",
      academicYear: "YEAR_4",
      preferredTrack: "FRONTEND_DEVELOPMENT",
      bio: "Leader focused on educational tooling, mentoring experiences, and clear learning journeys.",
      githubUsername: "dina-fouad",
    },
    {
      firstName: "Seif",
      lastName: "Ramadan",
      email: "seif.ramadan@student.edu",
      role: "LEADER",
      academicId: "CS2021016",
      phone: "01000001016",
      department: "CYBERSECURITY_INFOSEC",
      academicYear: "YEAR_4",
      preferredTrack: "QUALITY_ASSURANCE",
      bio: "Computer vision team leader with a strong interest in testing, model reliability, and demos.",
      githubUsername: "seif-ramadan",
    },
    {
      firstName: "Ahmed",
      lastName: "Samir",
      email: "ahmed.samir@student.edu",
      role: "STUDENT",
      academicId: "CS2021017",
      phone: "01000001017",
      department: "CYBERSECURITY_INFOSEC",
      academicYear: "YEAR_4",
      preferredTrack: "DEVOPS",
      bio: "Student interested in secure infrastructure, incident response tooling, and deployment automation.",
      githubUsername: "ahmed-samir",
    },
    {
      firstName: "Jana",
      lastName: "Essam",
      email: "jana.essam@student.edu",
      role: "STUDENT",
      academicId: "CS2021018",
      phone: "01000001018",
      department: "INFORMATION_SYSTEMS",
      academicYear: "YEAR_4",
      preferredTrack: "FRONTEND_DEVELOPMENT",
      bio: "Frontend student who enjoys clean healthcare interfaces and accessible form-heavy workflows.",
      githubUsername: "jana-essam",
    },
    {
      firstName: "Youssef",
      lastName: "Fathy",
      email: "youssef.fathy@student.edu",
      role: "STUDENT",
      academicId: "CS2021019",
      phone: "01000001019",
      department: "COMPUTER_SCIENCE",
      academicYear: "YEAR_4",
      preferredTrack: "BACKEND_DEVELOPMENT",
      bio: "Backend student focused on APIs, database performance, and reliable service boundaries.",
      githubUsername: "youssef-fathy",
    },
    {
      firstName: "Laila",
      lastName: "Mourad",
      email: "laila.mourad@student.edu",
      role: "STUDENT",
      academicId: "CS2021020",
      phone: "01000001020",
      department: "COMPUTER_SCIENCE",
      academicYear: "YEAR_4",
      preferredTrack: "CLOUD_ENGINEERING",
      bio: "Cloud student interested in route optimization, observability, and production deployment.",
      githubUsername: "laila-mourad",
    },
    {
      firstName: "Mostafa",
      lastName: "Said",
      email: "mostafa.said@student.edu",
      role: "STUDENT",
      academicId: "CS2021021",
      phone: "01000001021",
      department: "SOFTWARE_ENGINEERING",
      academicYear: "YEAR_4",
      preferredTrack: "FULLSTACK_DEVELOPMENT",
      bio: "Full-stack student who likes maps, analytics, and thoughtful project structure.",
      githubUsername: "mostafa-said",
    },
    {
      firstName: "Yara",
      lastName: "Adel",
      email: "yara.adel@student.edu",
      role: "STUDENT",
      academicId: "CS2021022",
      phone: "01000001022",
      department: "INFORMATION_SYSTEMS",
      academicYear: "YEAR_4",
      preferredTrack: "FRONTEND_DEVELOPMENT",
      bio: "Frontend student focused on marketplace flows, responsive layouts, and design systems.",
      githubUsername: "yara-adel",
    },
    {
      firstName: "Bassel",
      lastName: "Hany",
      email: "bassel.hany@student.edu",
      role: "STUDENT",
      academicId: "CS2021023",
      phone: "01000001023",
      department: "SOFTWARE_ENGINEERING",
      academicYear: "YEAR_4",
      preferredTrack: "BACKEND_DEVELOPMENT",
      bio: "Backend student interested in payment flows, search, and marketplace moderation.",
      githubUsername: "bassel-hany",
    },
    {
      firstName: "Reem",
      lastName: "Farouk",
      email: "reem.farouk@student.edu",
      role: "STUDENT",
      academicId: "CS2021024",
      phone: "01000001024",
      department: "INFORMATION_TECHNOLOGY",
      academicYear: "YEAR_4",
      preferredTrack: "FRONTEND_DEVELOPMENT",
      bio: "Student interested in learning interfaces, course planning, and interactive feedback.",
      githubUsername: "reem-farouk",
    },
    {
      firstName: "Nadine",
      lastName: "Ehab",
      email: "nadine.ehab@student.edu",
      role: "STUDENT",
      academicId: "CS2021025",
      phone: "01000001025",
      department: "COMPUTER_SCIENCE",
      academicYear: "YEAR_4",
      preferredTrack: "FULLSTACK_DEVELOPMENT",
      bio: "Full-stack student who enjoys knowledge graphs, mentoring flows, and data visualization.",
      githubUsername: "nadine-ehab",
    },
    {
      firstName: "Ziad",
      lastName: "Magdy",
      email: "ziad.magdy@student.edu",
      role: "STUDENT",
      academicId: "CS2021026",
      phone: "01000001026",
      department: "CYBERSECURITY_INFOSEC",
      academicYear: "YEAR_4",
      preferredTrack: "QUALITY_ASSURANCE",
      bio: "QA-focused student interested in model evaluation, testing plans, and release confidence.",
      githubUsername: "ziad-magdy",
    },
    {
      firstName: "Malak",
      lastName: "Tarek",
      email: "malak.tarek@student.edu",
      role: "STUDENT",
      academicId: "CS2021027",
      phone: "01000001027",
      department: "INFORMATION_SYSTEMS",
      academicYear: "YEAR_4",
      preferredTrack: "FRONTEND_DEVELOPMENT",
      bio: "Frontend student interested in visual review tools, annotation workflows, and usability.",
      githubUsername: "malak-tarek",
    },
  ];

  const users = {};
  for (const user of demoUsers) {
    const savedUser = await upsertUser(user, passwordHash);
    users[user.email] = savedUser;
  }

  console.log("Cleaning up existing team data...");
  await prisma.rewardPurchase.deleteMany();
  await prisma.userQuestProgress.deleteMany();
  await prisma.coinTransaction.deleteMany();
  await prisma.userCoinBalance.deleteMany();
  await prisma.rewardItem.deleteMany();
  await prisma.quest.deleteMany();
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
  const teamDefinitions = [
    {
      key: "smartCampus",
      name: "Smart Campus",
      bio: "A connected campus platform for announcements, navigation, and smart facility usage insights.",
      leaderEmail: "mariam.salah@student.edu",
      doctorEmail: "ahmed.hassan@university.edu",
      taEmail: "layla.ibrahim@university.edu",
      memberEmails: ["ali.mahmoud@student.edu", "salma.youssef@student.edu"],
      inviteCode: "SMART-25A1",
      maxMembers: 5,
      visibility: "PUBLIC",
      allowJoinRequests: true,
      stage: "IMPLEMENTATION",
      stack: ["Next.js", "Node.js", "PostgreSQL", "Tailwind CSS"],
    },
    {
      key: "aiStudyAssistant",
      name: "AI Study Assistant",
      bio: "An AI-powered graduation project assistant that helps students organize materials and learning plans.",
      leaderEmail: "nour.hassan@student.edu",
      doctorEmail: "ahmed.hassan@university.edu",
      taEmail: "omar.kamal@university.edu",
      memberEmails: ["hassan.omar@student.edu", "amira.khalil@student.edu"],
      inviteCode: "AISTUD-Y2B",
      maxMembers: 4,
      visibility: "PRIVATE",
      allowJoinRequests: false,
      stage: "DESIGN",
      stack: ["Python", "FastAPI", "React", "OpenAI"],
    },
    {
      key: "cyberGuard",
      name: "CyberGuard",
      bio: "A real-time network security monitoring and threat detection system for small businesses.",
      leaderEmail: "karim.mostafa@student.edu",
      doctorEmail: "mona.zaki@university.edu",
      taEmail: "omar.kamal@university.edu",
      memberEmails: ["hana.adel@student.edu", "ahmed.samir@student.edu"],
      inviteCode: "CYBER-G9X",
      maxMembers: 5,
      visibility: "PUBLIC",
      allowJoinRequests: true,
      stage: "REQUIREMENTS",
      stack: ["Go", "Python", "ELK Stack", "Docker"],
    },
    {
      key: "mediTrack",
      name: "MediTrack",
      bio: "A clinic coordination platform for appointment queues, patient follow-ups, and analytics.",
      leaderEmail: "yusuf.sameh@student.edu",
      doctorEmail: "mona.zaki@university.edu",
      taEmail: "layla.ibrahim@university.edu",
      memberEmails: ["jana.essam@student.edu", "youssef.fathy@student.edu"],
      inviteCode: "MEDTRK-4C8",
      maxMembers: 5,
      visibility: "PUBLIC",
      allowJoinRequests: true,
      stage: "TESTING",
      stack: ["React", "Express", "PostgreSQL", "Docker"],
    },
    {
      key: "ecoRoute",
      name: "EcoRoute",
      bio: "A carbon-aware route planning system that compares commute options and tracks emissions.",
      leaderEmail: "farah.nabil@student.edu",
      doctorEmail: "ahmed.hassan@university.edu",
      taEmail: "omar.kamal@university.edu",
      memberEmails: ["laila.mourad@student.edu", "mostafa.said@student.edu"],
      inviteCode: "ECO-RT8Q",
      maxMembers: 5,
      visibility: "PUBLIC",
      allowJoinRequests: true,
      stage: "DESIGN",
      stack: ["Next.js", "Mapbox", "Node.js", "Redis"],
    },
    {
      key: "campusMarket",
      name: "Campus Market",
      bio: "A trusted student marketplace for books, devices, services, and campus-safe exchanges.",
      leaderEmail: "tarek.amin@student.edu",
      doctorEmail: "mona.zaki@university.edu",
      taEmail: "layla.ibrahim@university.edu",
      memberEmails: ["yara.adel@student.edu", "bassel.hany@student.edu"],
      inviteCode: "MARKET-7P",
      maxMembers: 5,
      visibility: "PUBLIC",
      allowJoinRequests: true,
      stage: "IMPLEMENTATION",
      stack: ["Next.js", "NestJS", "PostgreSQL", "Stripe"],
    },
    {
      key: "codeMentorHub",
      name: "CodeMentor Hub",
      bio: "A peer mentoring platform that matches students with code reviewers and learning paths.",
      leaderEmail: "dina.fouad@student.edu",
      doctorEmail: "ahmed.hassan@university.edu",
      taEmail: "layla.ibrahim@university.edu",
      memberEmails: ["reem.farouk@student.edu", "nadine.ehab@student.edu"],
      inviteCode: "MENTOR-H2",
      maxMembers: 4,
      visibility: "PRIVATE",
      allowJoinRequests: false,
      stage: "REQUIREMENTS",
      stack: ["React", "Node.js", "GraphQL", "MongoDB"],
    },
    {
      key: "visionLab",
      name: "Vision Lab",
      bio: "A computer vision workspace for dataset annotation, model review, and demo comparison.",
      leaderEmail: "seif.ramadan@student.edu",
      doctorEmail: "mona.zaki@university.edu",
      taEmail: "omar.kamal@university.edu",
      memberEmails: ["ziad.magdy@student.edu", "malak.tarek@student.edu"],
      inviteCode: "VISION-6L",
      maxMembers: 5,
      visibility: "PUBLIC",
      allowJoinRequests: true,
      stage: "DEPLOYMENT",
      stack: ["Python", "PyTorch", "FastAPI", "React"],
    },
  ];

  const seededTeams = {};
  for (const team of teamDefinitions) {
    seededTeams[team.key] = await prisma.team.create({
      data: {
        name: team.name,
        bio: team.bio,
        leaderId: users[team.leaderEmail].id,
        doctorId: users[team.doctorEmail].id,
        taId: users[team.taEmail].id,
        inviteCode: team.inviteCode,
        maxMembers: team.maxMembers,
        visibility: team.visibility,
        allowJoinRequests: team.allowJoinRequests,
        stage: team.stage,
        stack: team.stack,
      },
    });
  }

  const smartCampus = seededTeams.smartCampus;
  const aiStudyAssistant = seededTeams.aiStudyAssistant;

  console.log("Seeding team members...");
  await prisma.teamMember.createMany({
    data: teamDefinitions.flatMap((team) =>
      team.memberEmails.map((email) => ({
        teamId: seededTeams[team.key].id,
        userId: users[email].id,
      })),
    ),
  });

  console.log("Seeding supervisor request history...");
  await prisma.teamSupervisorRequest.createMany({
    data: teamDefinitions.flatMap((team) => [
      {
        teamId: seededTeams[team.key].id,
        supervisorId: users[team.doctorEmail].id,
        requestedById: users[team.leaderEmail].id,
        supervisorRole: "DOCTOR",
        projectName: team.name,
        projectDescription: team.bio,
        technologies: team.stack,
        status: "ACCEPTED",
        respondedAt: new Date(),
      },
      {
        teamId: seededTeams[team.key].id,
        supervisorId: users[team.taEmail].id,
        requestedById: users[team.leaderEmail].id,
        supervisorRole: "TA",
        projectName: team.name,
        projectDescription: team.bio,
        technologies: team.stack,
        status: "ACCEPTED",
        respondedAt: new Date(),
      },
    ]),
  });

  console.log("Seeding proposals...");
  const proposalReviewByStatus = {
    DRAFT: {},
    SUBMITTED: { submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    UNDER_REVIEW: { submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    REVISION_REQUESTED: {
      submittedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      reviewedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      feedback: "Narrow the scope and clarify measurable success criteria before resubmitting.",
      revisionCount: 1,
      version: 2,
    },
    APPROVED: {
      submittedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      reviewedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      feedback: "Approved. The scope is clear and the delivery plan is feasible.",
    },
  };

  const proposalStatuses = {
    smartCampus: "APPROVED",
    aiStudyAssistant: "APPROVED",
    cyberGuard: "UNDER_REVIEW",
    mediTrack: "APPROVED",
    ecoRoute: "REVISION_REQUESTED",
    campusMarket: "APPROVED",
    codeMentorHub: "SUBMITTED",
    visionLab: "APPROVED",
  };

  for (const team of teamDefinitions) {
    const status = proposalStatuses[team.key] ?? "DRAFT";
    const reviewMeta = proposalReviewByStatus[status] ?? {};
    await prisma.proposal.create({
      data: {
        teamId: seededTeams[team.key].id,
        authoredByUserId: users[team.leaderEmail].id,
        title: `${team.name} Graduation Project`,
        abstract: team.bio,
        problemStatement: `${team.name} addresses a practical campus or industry workflow where students can demonstrate planning, implementation, testing, and evaluation.`,
        objectives: [
          "Validate the core problem with representative users.",
          "Build a usable prototype backed by reliable services.",
          "Evaluate the solution against clear technical and user-facing criteria.",
        ],
        scope: `The team will deliver the ${team.name} core workflow, supervisor-ready documentation, and a demonstrable prototype.`,
        methodology: "The team will follow an iterative SDLC process with weekly supervisor feedback, staged deliverables, and rubric-based evaluation.",
        technologies: team.stack,
        deliverables: ["SRS", "UML", "Prototype", "Source code", "Test plan", "Final report", "Presentation"],
        timeline: "Weeks 1-2 requirements, weeks 3-4 design, weeks 5-8 implementation, weeks 9-10 testing, weeks 11-12 deployment and defense preparation.",
        status,
        reviewedByUserId: reviewMeta.reviewedAt ? users[team.doctorEmail].id : null,
        ...reviewMeta,
      },
    });
  }

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
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const smartCampusSprint = await prisma.sprint.create({
    data: {
      teamId: smartCampus.id,
      name: "Sprint 1 - Core Workspace",
      goal: "Ship the first usable student workspace with authentication, UI foundations, and map planning.",
      startDate: new Date(now.getTime() - 3 * day),
      endDate: new Date(now.getTime() + 11 * day),
      status: "ACTIVE",
      createdByUserId: users["mariam.salah@student.edu"].id,
    },
  });

  const tasks = [
    {
      teamId: smartCampus.id,
      sprintId: smartCampusSprint.id,
      title: "Design System Implementation",
      description: "Establish core UI components using Tailwind CSS and Radix UI.",
      status: "DONE",
      priority: "HIGH",
      taskType: "DESIGN",
      storyPoints: 5,
      actualPoints: 5,
      assigneeUserId: users["mariam.salah@student.edu"].id,
      labels: ["UI/UX", "Frontend"],
    },
    {
      teamId: smartCampus.id,
      sprintId: smartCampusSprint.id,
      title: "Authentication Flow",
      description: "Implement JWT-based auth with refresh tokens and protected routes.",
      status: "IN_PROGRESS",
      priority: "CRITICAL",
      taskType: "CODE",
      storyPoints: 8,
      assigneeUserId: users["ali.mahmoud@student.edu"].id,
      labels: ["Security", "Backend"],
    },
    {
      teamId: smartCampus.id,
      sprintId: smartCampusSprint.id,
      title: "Interactive Campus Map",
      description: "Integrate Mapbox API to show facility locations and real-time navigation.",
      status: "TODO",
      priority: "MEDIUM",
      taskType: "CODE",
      storyPoints: 5,
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
      status: "SUBMITTED",
      isSubmitted: true,
      submittedAt: new Date(),
    },
  });

  console.log("Seeding submissions...");
  const submissionDefinitions = [
    {
      teamKey: "smartCampus",
      submittedByEmail: "mariam.salah@student.edu",
      items: [
        { deliverableType: "SRS", sdlcPhase: "REQUIREMENTS", status: "APPROVED", grade: 95, taRecommendedGrade: 94, daysAgo: 21, feedback: "Strong requirements and stakeholder mapping." },
        { deliverableType: "UML", sdlcPhase: "DESIGN", status: "APPROVED", grade: 88, taRecommendedGrade: 86, daysAgo: 14, feedback: "Good design coverage with minor notation cleanup needed." },
        { deliverableType: "PROTOTYPE", sdlcPhase: "IMPLEMENTATION", status: "UNDER_REVIEW", taRecommendedGrade: 84, daysAgo: 3, taFeedback: "Prototype is functional. Doctor review is pending." },
      ],
    },
    {
      teamKey: "aiStudyAssistant",
      submittedByEmail: "nour.hassan@student.edu",
      items: [
        { deliverableType: "SRS", sdlcPhase: "REQUIREMENTS", status: "APPROVED", grade: 91, taRecommendedGrade: 90, daysAgo: 18, feedback: "Clear AI assistant scope and risk boundaries." },
        { deliverableType: "UML", sdlcPhase: "DESIGN", status: "REVISION_REQUIRED", daysAgo: 6, feedback: "Revise the data flow around prompt history and privacy controls." },
      ],
    },
    {
      teamKey: "cyberGuard",
      submittedByEmail: "karim.mostafa@student.edu",
      items: [
        { deliverableType: "SRS", sdlcPhase: "REQUIREMENTS", status: "UNDER_REVIEW", taRecommendedGrade: 82, daysAgo: 4, taFeedback: "Threat model is promising. Needs final doctor confirmation." },
      ],
    },
    {
      teamKey: "mediTrack",
      submittedByEmail: "yusuf.sameh@student.edu",
      items: [
        { deliverableType: "SRS", sdlcPhase: "REQUIREMENTS", status: "APPROVED", grade: 86, taRecommendedGrade: 85, daysAgo: 24, feedback: "Requirements are realistic for clinic workflows." },
        { deliverableType: "UML", sdlcPhase: "DESIGN", status: "APPROVED", grade: 83, taRecommendedGrade: 82, daysAgo: 16, feedback: "Entity relationships are sound." },
        { deliverableType: "TEST_PLAN", sdlcPhase: "TESTING", status: "PENDING", daysAgo: 1, notes: "Initial test scenarios for appointments and queue updates." },
      ],
    },
    {
      teamKey: "ecoRoute",
      submittedByEmail: "farah.nabil@student.edu",
      items: [
        { deliverableType: "SRS", sdlcPhase: "REQUIREMENTS", status: "REVISION_REQUIRED", daysAgo: 5, feedback: "Success metrics need a tighter emissions calculation definition." },
      ],
    },
    {
      teamKey: "campusMarket",
      submittedByEmail: "tarek.amin@student.edu",
      items: [
        { deliverableType: "SRS", sdlcPhase: "REQUIREMENTS", status: "APPROVED", grade: 79, taRecommendedGrade: 80, daysAgo: 19, feedback: "Marketplace requirements are acceptable after scope reduction." },
        { deliverableType: "UML", sdlcPhase: "DESIGN", status: "PENDING", daysAgo: 2, notes: "Class diagram and exchange workflow submitted for first review." },
      ],
    },
    {
      teamKey: "codeMentorHub",
      submittedByEmail: "dina.fouad@student.edu",
      items: [
        { deliverableType: "SRS", sdlcPhase: "REQUIREMENTS", status: "PENDING", daysAgo: 1, notes: "Draft requirements submitted after proposal review." },
      ],
    },
    {
      teamKey: "visionLab",
      submittedByEmail: "seif.ramadan@student.edu",
      items: [
        { deliverableType: "SRS", sdlcPhase: "REQUIREMENTS", status: "APPROVED", grade: 93, taRecommendedGrade: 92, daysAgo: 30, feedback: "Excellent dataset and annotation requirements." },
        { deliverableType: "UML", sdlcPhase: "DESIGN", status: "APPROVED", grade: 89, taRecommendedGrade: 88, daysAgo: 23, feedback: "Design supports the model review workflow well." },
        { deliverableType: "CODE", sdlcPhase: "IMPLEMENTATION", status: "APPROVED", grade: 87, taRecommendedGrade: 86, daysAgo: 12, feedback: "Implementation is stable and documented." },
        { deliverableType: "TEST_PLAN", sdlcPhase: "TESTING", status: "APPROVED", grade: 90, taRecommendedGrade: 89, daysAgo: 7, feedback: "Test cases cover model quality and UI flows." },
        { deliverableType: "FINAL_REPORT", sdlcPhase: "DEPLOYMENT", status: "UNDER_REVIEW", taRecommendedGrade: 91, daysAgo: 2, taFeedback: "Report is strong. Final defense review remains." },
      ],
    },
  ];

  for (const group of submissionDefinitions) {
    const team = teamDefinitions.find((item) => item.key === group.teamKey);
    const teamRecord = seededTeams[group.teamKey];
    for (const item of group.items) {
      const submittedAt = new Date(Date.now() - item.daysAgo * day);
      const taReviewedAt = ["UNDER_REVIEW", "APPROVED"].includes(item.status)
        ? new Date(submittedAt.getTime() + day)
        : null;
      const reviewedAt = item.status === "APPROVED" || item.status === "REVISION_REQUIRED"
        ? new Date(submittedAt.getTime() + 2 * day)
        : null;

      await prisma.submission.create({
        data: {
          teamId: teamRecord.id,
          deliverableType: item.deliverableType,
          sdlcPhase: item.sdlcPhase,
          sourceType: "MANUAL_UPLOAD",
          title: `${teamRecord.name} ${item.deliverableType.replace("_", " ")}`,
          notes: item.notes ?? `${teamRecord.name} ${item.deliverableType.replace("_", " ")} deliverable package.`,
          status: item.status,
          fileName: `${group.teamKey}-${item.deliverableType.toLowerCase()}.pdf`,
          fileSize: 512000 + item.daysAgo * 1024,
          fileType: "application/pdf",
          fileUrl: `https://example.com/docs/${group.teamKey}-${item.deliverableType.toLowerCase()}.pdf`,
          artifactUrl: `https://example.com/docs/${group.teamKey}-${item.deliverableType.toLowerCase()}.pdf`,
          version: item.status === "REVISION_REQUIRED" ? 2 : 1,
          submittedByUserId: users[group.submittedByEmail].id,
          submittedAt,
          deadline: new Date(submittedAt.getTime() + 7 * day),
          late: item.status === "REVISION_REQUIRED",
          taRecommendedGrade: item.taRecommendedGrade ?? null,
          taFeedback: item.taFeedback ?? (item.taRecommendedGrade ? "TA review completed and forwarded to the doctor." : null),
          taReviewedByUserId: taReviewedAt ? users[team.taEmail].id : null,
          taReviewedAt,
          reviewedByUserId: reviewedAt ? users[team.doctorEmail].id : null,
          reviewedAt,
          feedback: item.feedback ?? null,
          grade: item.grade ?? null,
          rubric: item.grade
            ? [
                { name: "Completeness", score: Math.min(item.grade, 100), maxScore: 100 },
                { name: "Technical Quality", score: Math.max(item.grade - 3, 0), maxScore: 100 },
                { name: "Clarity", score: Math.min(item.grade + 2, 100), maxScore: 100 },
              ]
            : null,
        },
      });
    }
  }

  // ─── Gamification: Seed Rules & Badges ───────────────────────
  await seedBadgeDefinitions();
  await seedGamificationEconomy(users);

  console.log("Seed completed successfully!");
}

// ─────────────────────────────────────────────────────────────
// Gamification Rules (v1) — idempotent via upsert on [code, version]
// ─────────────────────────────────────────────────────────────
async function seedGamificationRules() {
  console.log("Seeding gamification rules...");

  // WARNING: The rule configuration here for TASK_APPROVED_* events is mirrored
  // in TASK_XP_RULE_ESTIMATES in src/modules/sprints/sprints.service.js.
  // If you update rules here, make sure to update the estimates there as well!
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
      caps: { maxPerTask: 1, maxXpPerUserPerDay: 300, maxXpPerUserPerWeek: 900 },
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
      caps: { maxPerTask: 1, maxXpPerUserPerDay: 300, maxXpPerUserPerWeek: 900 },
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
      caps: { maxPerTask: 1, maxXpPerUserPerDay: 300, maxXpPerUserPerWeek: 900 },
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
      caps: { maxPerTask: 1, maxXpPerUserPerDay: 300, maxXpPerUserPerWeek: 900 },
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
      caps: { maxPerTask: 1, maxXpPerUserPerDay: 120, maxXpPerUserPerWeek: 300 },
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
      caps: { maxPerTask: 1, maxXpPerUserPerDay: 300, maxXpPerUserPerWeek: 900 },
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
      caps: { maxPerTask: 1, maxXpPerUserPerDay: 180, maxXpPerUserPerWeek: 500 },
    },
    // ── Submission / Deliverable XP rules ──
    // Sprint/team XP rules
    {
      code: "SPRINT_COMPLETED_TEAM",
      name: "Sprint Completed (Team)",
      description: "Team XP awarded when an active sprint is completed, scaled by completion percentage.",
      eventType: "SPRINT_COMPLETED",
      targetType: "TEAM",
      baseXp: 120,
      conditions: {},
      multipliers: {
        quality: { "90-100": 1.25, "80-89": 1.0, "70-79": 0.7, "60-69": 0.4, below60: 0 },
      },
      caps: { maxPerSprint: 1 },
    },
    {
      code: "WEEKLY_REPORT_APPROVED_TEAM",
      name: "Weekly Report Approved (Team)",
      description: "Team XP for submitting a weekly progress report that is approved by staff.",
      eventType: "WEEKLY_REPORT_APPROVED",
      targetType: "TEAM",
      baseXp: 75,
      conditions: {},
      multipliers: {},
      caps: { maxPerWeeklyReport: 1 },
    },
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

async function seedGamificationEconomy(users) {
  console.log("Seeding gamification economy...");
  const quests = [
    {
      code: "DAILY_TASK_CLOSER",
      title: "Task closer",
      description: "Complete two approved tasks today.",
      type: "DAILY",
      metric: "TASKS_DONE",
      targetValue: 2,
      coinReward: 25,
      sortOrder: 10,
      metadata: { icon: "check-square", tone: "green" },
    },
    {
      code: "DAILY_REVIEW_HELPER",
      title: "Review helper",
      description: "Complete one GitHub pull request review today.",
      type: "DAILY",
      metric: "REVIEWS_GIVEN",
      targetValue: 1,
      coinReward: 20,
      sortOrder: 20,
      metadata: { icon: "git-pull-request", tone: "blue" },
    },
    {
      code: "WEEKLY_XP_PUSH",
      title: "XP push",
      description: "Earn 300 awarded XP this week.",
      type: "WEEKLY",
      metric: "XP_EARNED",
      targetValue: 300,
      coinReward: 80,
      sortOrder: 30,
      metadata: { icon: "zap", tone: "yellow" },
    },
    {
      code: "WEEKLY_SUBMISSION_READY",
      title: "Submission ready",
      description: "Get one deliverable submission approved this week.",
      type: "WEEKLY",
      metric: "SUBMISSIONS_APPROVED",
      targetValue: 1,
      coinReward: 60,
      sortOrder: 40,
      metadata: { icon: "file-check", tone: "purple" },
    },
    {
      code: "MILESTONE_RELEASE_SHIPPER",
      title: "Release shipper",
      description: "Merge three GitHub pull requests over the project lifetime.",
      type: "MILESTONE",
      metric: "PRS_MERGED",
      targetValue: 3,
      coinReward: 120,
      sortOrder: 50,
      metadata: { icon: "rocket", tone: "orange" },
    },
    {
      code: "MILESTONE_SPRINT_FINISHER",
      title: "Sprint finisher",
      description: "Contribute to two completed sprints.",
      type: "MILESTONE",
      metric: "SPRINTS_COMPLETED",
      targetValue: 2,
      coinReward: 100,
      sortOrder: 60,
      metadata: { icon: "target", tone: "emerald" },
    },
  ];

  for (const quest of quests) {
    await prisma.quest.upsert({
      where: { code: quest.code },
      update: {
        title: quest.title,
        description: quest.description,
        type: quest.type,
        metric: quest.metric,
        targetValue: quest.targetValue,
        coinReward: quest.coinReward,
        sortOrder: quest.sortOrder,
        metadata: quest.metadata,
        isActive: true,
      },
      create: {
        code: quest.code,
        title: quest.title,
        description: quest.description,
        type: quest.type,
        metric: quest.metric,
        targetValue: quest.targetValue,
        coinReward: quest.coinReward,
        sortOrder: quest.sortOrder,
        metadata: quest.metadata,
        isActive: true,
      },
    });
  }

  const rewardItems = [
    {
      code: "TITLE_SPRINT_CAPTAIN",
      name: "Sprint Captain",
      description: "A profile title for students who keep team delivery moving.",
      type: "TITLE",
      cost: 80,
      sortOrder: 10,
      metadata: { accent: "emerald", previewText: "Sprint Captain" },
    },
    {
      code: "TITLE_RELEASE_READY",
      name: "Release Ready",
      description: "A profile title for consistent shippers.",
      type: "TITLE",
      cost: 120,
      sortOrder: 20,
      metadata: { accent: "orange", previewText: "Release Ready" },
    },
    {
      code: "FRAME_BLUEPRINT",
      name: "Blueprint Frame",
      description: "A subtle profile avatar frame with project-planning styling.",
      type: "AVATAR_FRAME",
      cost: 150,
      sortOrder: 30,
      metadata: { accent: "blue", borderStyle: "blueprint" },
    },
    {
      code: "THEME_FOCUS_GRID",
      name: "Focus Grid Theme",
      description: "A dashboard theme accent for students who prefer quieter visuals.",
      type: "PROFILE_THEME",
      cost: 200,
      sortOrder: 40,
      metadata: { accent: "slate", density: "compact" },
    },
    {
      code: "BADGE_SKIN_GOLD_TRIM",
      name: "Gold Trim Badge Skin",
      description: "Adds a gold trim to earned badge displays.",
      type: "BADGE_SKIN",
      cost: 260,
      inventory: 20,
      sortOrder: 50,
      metadata: { accent: "gold", limited: true },
    },
  ];

  for (const item of rewardItems) {
    await prisma.rewardItem.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        description: item.description,
        type: item.type,
        cost: item.cost,
        inventory: item.inventory ?? null,
        sortOrder: item.sortOrder,
        metadata: item.metadata,
        status: "ACTIVE",
      },
      create: {
        code: item.code,
        name: item.name,
        description: item.description,
        type: item.type,
        cost: item.cost,
        inventory: item.inventory ?? null,
        sortOrder: item.sortOrder,
        metadata: item.metadata,
        status: "ACTIVE",
      },
    });
  }

  const starterCoinEmails = [
    "mariam.salah@student.edu",
    "ali.mahmoud@student.edu",
    "salma.youssef@student.edu",
    "nour.hassan@student.edu",
    "hassan.omar@student.edu",
    "amira.khalil@student.edu",
  ];

  for (const email of starterCoinEmails) {
    const user = users[email];
    if (!user) continue;

    const amount = user.role === "LEADER" ? 180 : 120;
    await prisma.coinTransaction.upsert({
      where: { idempotencyKey: `SEED_STARTER_COINS:${user.id}` },
      update: {},
      create: {
        idempotencyKey: `SEED_STARTER_COINS:${user.id}`,
        userId: user.id,
        amount,
        direction: "CREDIT",
        status: "POSTED",
        sourceType: "SEED",
        reason: "Starter coins for gamification economy demo data.",
      },
    });

    await prisma.userCoinBalance.upsert({
      where: { userId: user.id },
      update: {
        balance: amount,
        lifetimeEarned: amount,
        lifetimeSpent: 0,
      },
      create: {
        userId: user.id,
        balance: amount,
        lifetimeEarned: amount,
      },
    });
  }

  console.log(`  -> ${quests.length} quests, ${rewardItems.length} rewards, and ${starterCoinEmails.length} starter wallets seeded.`);
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
