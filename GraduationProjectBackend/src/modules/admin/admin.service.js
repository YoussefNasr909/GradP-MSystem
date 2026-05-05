import prisma from "../../config/db.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function applyPagination(arr, page, limit) {
  const skip = (page - 1) * limit;
  return arr.slice(skip, skip + limit);
}

function sortDesc(arr) {
  return arr.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ─── System Logs ─────────────────────────────────────────────────────────────

export async function getSystemLogs({ page = 1, limit = 50, level, category, search } = {}) {
  const logs = [];

  const [users, teams, meetings, tasks, submissions, joinRequests, invitations] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.team.findMany({
      select: {
        id: true, name: true, stage: true, createdAt: true,
        leader: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.meeting.findMany({
      select: { id: true, title: true, status: true, mode: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.task.findMany({
      select: { id: true, title: true, status: true, priority: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.submission.findMany({
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.teamJoinRequest.findMany({
      select: { id: true, status: true, createdAt: true, team: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.teamInvitation.findMany({
      select: { id: true, status: true, createdAt: true, team: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // User registrations
  for (const u of users) {
    logs.push({
      id: `user-reg-${u.id}`,
      timestamp: u.createdAt,
      level: "info",
      category: "user",
      message: `New user registered: ${u.firstName} ${u.lastName}`,
      details: { userId: u.id, email: u.email, role: u.role },
      source: "UserService",
    });
  }

  // Team creations
  for (const t of teams) {
    logs.push({
      id: `team-create-${t.id}`,
      timestamp: t.createdAt,
      level: "success",
      category: "system",
      message: `Team created: ${t.name}`,
      details: { teamId: t.id, teamName: t.name, leader: `${t.leader.firstName} ${t.leader.lastName}`, stage: t.stage },
      source: "TeamService",
    });
  }

  // Meetings
  for (const m of meetings) {
    const isCancelled = m.status === "CANCELLED";
    const isCompleted = m.status === "COMPLETED";
    logs.push({
      id: `meeting-${m.id}`,
      timestamp: m.createdAt,
      level: isCancelled ? "warning" : isCompleted ? "success" : "info",
      category: "system",
      message: `Meeting ${isCancelled ? "cancelled" : isCompleted ? "completed" : "scheduled"}: ${m.title}`,
      details: { meetingId: m.id, status: m.status, mode: m.mode },
      source: "MeetingService",
    });
  }

  // Tasks
  for (const t of tasks) {
    const isBlocked = t.status === "BLOCKED";
    const isDone = t.status === "DONE";
    logs.push({
      id: `task-${t.id}`,
      timestamp: t.createdAt,
      level: isBlocked ? "error" : isDone ? "success" : "info",
      category: "system",
      message: `Task ${isDone ? "completed" : isBlocked ? "blocked" : "created"}: ${t.title}`,
      details: { taskId: t.id, status: t.status, priority: t.priority },
      source: "TaskService",
    });
  }

  // Submissions
  for (const s of submissions) {
    logs.push({
      id: `submission-${s.id}`,
      timestamp: s.createdAt,
      level: "info",
      category: "system",
      message: `Submission received: ${s.title}`,
      details: { submissionId: s.id, status: s.status },
      source: "SubmissionService",
    });
  }

  // Join requests
  for (const jr of joinRequests) {
    logs.push({
      id: `joinreq-${jr.id}`,
      timestamp: jr.createdAt,
      level: jr.status === "REJECTED" ? "warning" : "info",
      category: "user",
      message: `Join request ${jr.status.toLowerCase()} for team: ${jr.team.name}`,
      details: { teamName: jr.team.name, status: jr.status },
      source: "TeamService",
    });
  }

  // Invitations
  for (const inv of invitations) {
    logs.push({
      id: `invitation-${inv.id}`,
      timestamp: inv.createdAt,
      level: inv.status === "DECLINED" ? "warning" : "info",
      category: "user",
      message: `Team invitation ${inv.status.toLowerCase()} for team: ${inv.team.name}`,
      details: { teamName: inv.team.name, status: inv.status },
      source: "TeamService",
    });
  }

  // Sort desc
  sortDesc(logs);

  // Filters
  let filtered = logs;
  if (level && level !== "all") filtered = filtered.filter((l) => l.level === level);
  if (category && category !== "all") filtered = filtered.filter((l) => l.category === category);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.message.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q)
    );
  }

  const total = filtered.length;
  const paginated = applyPagination(filtered, page, limit);

  // Summary counts
  const allLogs = logs;
  const counts = {
    total: allLogs.length,
    info: allLogs.filter((l) => l.level === "info").length,
    warning: allLogs.filter((l) => l.level === "warning").length,
    error: allLogs.filter((l) => l.level === "error").length,
    success: allLogs.filter((l) => l.level === "success").length,
  };

  return { logs: paginated, total, page, limit, counts };
}

// ─── User Activity ────────────────────────────────────────────────────────────

export async function getUserActivity({ page = 1, limit = 50, search, role } = {}) {
  const activities = [];

  const [members, organizedMeetings, acceptedInvitations, approvedRequests, createdTasks] = await Promise.all([
    prisma.teamMember.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true, email: true, avatarUrl: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: "desc" },
      take: 40,
    }),
    prisma.meeting.findMany({
      include: {
        organizer: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.teamInvitation.findMany({
      where: { status: "ACCEPTED" },
      include: {
        invitedUser: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
        team: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.teamJoinRequest.findMany({
      where: { status: "APPROVED" },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
        team: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.task.findMany({
      where: { createdBy: { isNot: null } },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
        team: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  // Team joins
  for (const m of members) {
    activities.push({
      id: `join-${m.id}`,
      timestamp: m.joinedAt,
      user: {
        id: m.user.id,
        name: `${m.user.firstName} ${m.user.lastName}`,
        role: m.user.role.toLowerCase(),
        avatarUrl: m.user.avatarUrl,
        email: m.user.email,
      },
      action: "joined",
      target: `Team: ${m.team.name}`,
      details: `Became a team member`,
      teamName: m.team.name,
    });
  }

  // Meetings organized
  for (const mtg of organizedMeetings) {
    activities.push({
      id: `meeting-org-${mtg.id}`,
      timestamp: mtg.createdAt,
      user: {
        id: mtg.organizer.id,
        name: `${mtg.organizer.firstName} ${mtg.organizer.lastName}`,
        role: mtg.organizer.role.toLowerCase(),
        avatarUrl: mtg.organizer.avatarUrl,
      },
      action: "scheduled",
      target: `Meeting: ${mtg.title}`,
      details: `Status: ${mtg.status}`,
    });
  }

  // Accepted invitations
  for (const inv of acceptedInvitations) {
    activities.push({
      id: `inv-accept-${inv.id}`,
      timestamp: inv.updatedAt,
      user: {
        id: inv.invitedUser.id,
        name: `${inv.invitedUser.firstName} ${inv.invitedUser.lastName}`,
        role: inv.invitedUser.role.toLowerCase(),
        avatarUrl: inv.invitedUser.avatarUrl,
      },
      action: "accepted invitation to",
      target: `Team: ${inv.team.name}`,
      details: `Invitation accepted`,
      teamName: inv.team.name,
    });
  }

  // Approved join requests
  for (const jr of approvedRequests) {
    activities.push({
      id: `joinreq-approved-${jr.id}`,
      timestamp: jr.updatedAt,
      user: {
        id: jr.user.id,
        name: `${jr.user.firstName} ${jr.user.lastName}`,
        role: jr.user.role.toLowerCase(),
        avatarUrl: jr.user.avatarUrl,
      },
      action: "joined via request",
      target: `Team: ${jr.team.name}`,
      details: `Join request approved`,
      teamName: jr.team.name,
    });
  }

  // Tasks created
  for (const task of createdTasks) {
    if (!task.createdBy) continue;
    activities.push({
      id: `task-created-${task.id}`,
      timestamp: task.createdAt,
      user: {
        id: task.createdBy.id,
        name: `${task.createdBy.firstName} ${task.createdBy.lastName}`,
        role: task.createdBy.role.toLowerCase(),
        avatarUrl: task.createdBy.avatarUrl,
      },
      action: "created task",
      target: `"${task.title}" in ${task.team.name}`,
      details: `Priority: ${task.priority}, Status: ${task.status}`,
    });
  }

  // Sort desc
  sortDesc(activities);

  // Filters
  let filtered = activities;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.user.name.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q) ||
        a.target.toLowerCase().includes(q) ||
        (a.teamName || "").toLowerCase().includes(q)
    );
  }
  if (role && role !== "all") {
    filtered = filtered.filter((a) => a.user.role === role.toLowerCase());
  }

  const total = filtered.length;
  const paginated = applyPagination(filtered, page, limit);

  return { activities: paginated, total, page, limit };
}
