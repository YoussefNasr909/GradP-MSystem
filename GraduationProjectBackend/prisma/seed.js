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
  const day = 24 * 60 * 60 * 1000;
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

  console.log("Seed completed successfully!");
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
