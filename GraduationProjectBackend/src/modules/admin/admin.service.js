import { prisma } from "../../loaders/dbLoader.js";
import { ROLES } from "../../common/constants/roles.js";
import { PHASE_WEIGHTS, calculateWeightedFinal } from "../submissions/evaluation-policy.js";

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

// ─── Grades Overview ─────────────────────────────────────────────────────────
//
// Returns one row per team with all their graded/pending submissions,
// aggregated stats, and a weighted final score per SDLC phase.

function buildFullName(u) {
  return `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim();
}

export async function getGradesOverview({ search, stage, actor, scope } = {}) {
  // Doctors always see only their supervised teams. Admin sees everything.
  let teamWhere = {};
  if (actor && actor.role === "DOCTOR") {
    teamWhere = { doctorId: actor.id };
  }

  const teams = await prisma.team.findMany({
    where: teamWhere,
    select: {
      id: true,
      name: true,
      stage: true,
      leader:  { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      doctor:  { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      ta:      { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      members: { select: { user: { select: { id: true } } } },
      submissions: {
        select: {
          id: true,
          deliverableType: true,
          sdlcPhase: true,
          status: true,
          grade: true,
          taRecommendedGrade: true,
          version: true,
          submittedAt: true,
          reviewedAt: true,
          taReviewedAt: true,
        },
        orderBy: [{ sdlcPhase: "asc" }, { submittedAt: "desc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = teams.map((team) => {
    const graded   = team.submissions.filter((s) => s.status === "APPROVED" && s.grade !== null);
    const pending  = team.submissions.filter((s) => s.status === "PENDING");
    const under    = team.submissions.filter((s) => s.status === "UNDER_REVIEW");
    const revision = team.submissions.filter((s) => s.status === "REVISION_REQUIRED");

    const averageGrade = graded.length
      ? Math.round(graded.reduce((sum, s) => sum + (s.grade ?? 0), 0) / graded.length)
      : null;

    // Phase scores = mean grade per phase for APPROVED submissions
    const phaseScores = {};
    for (const s of graded) {
      if (!phaseScores[s.sdlcPhase]) {
        phaseScores[s.sdlcPhase] = { total: 0, count: 0 };
      }
      phaseScores[s.sdlcPhase].total += s.grade ?? 0;
      phaseScores[s.sdlcPhase].count += 1;
    }
    const phaseAverages = {};
    Object.entries(phaseScores).forEach(([phase, { total, count }]) => {
      phaseAverages[phase] = Math.round(total / count);
    });

    // Weighted final = sum(weight × phase_avg) / sum(weights with grades)
    const { weightedFinal, missingWeightedPhases, isFinalComplete } = calculateWeightedFinal(phaseAverages);

    return {
      teamId: team.id,
      teamName: team.name,
      stage: team.stage,
      memberCount: team.members.length + 1,
      leader:  team.leader  ? { ...team.leader,  fullName: buildFullName(team.leader)  } : null,
      doctor:  team.doctor  ? { ...team.doctor,  fullName: buildFullName(team.doctor)  } : null,
      ta:      team.ta      ? { ...team.ta,      fullName: buildFullName(team.ta)      } : null,
      stats: {
        approved:       graded.length,
        pendingReview:  pending.length,
        underReview:    under.length,
        needsRevision:  revision.length,
        total:          team.submissions.length,
      },
      averageGrade,
      weightedFinal,
      missingWeightedPhases,
      isFinalComplete,
      phaseAverages,
      submissions: team.submissions,
    };
  });

  let filtered = rows;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.teamName.toLowerCase().includes(q) ||
        r.leader?.fullName?.toLowerCase().includes(q) ||
        r.doctor?.fullName?.toLowerCase().includes(q),
    );
  }
  if (stage && stage !== "all") {
    filtered = filtered.filter((r) => r.stage === stage);
  }

  // Global stats across all teams (before search filter)
  const allGraded = rows.flatMap((r) =>
    r.submissions.filter((s) => s.status === "APPROVED" && s.grade !== null),
  );
  const globalAverage = allGraded.length
    ? Math.round(allGraded.reduce((sum, s) => sum + (s.grade ?? 0), 0) / allGraded.length)
    : 0;

  const summary = {
    totalTeams: rows.length,
    teamsWithGrades: rows.filter((r) => r.averageGrade !== null).length,
    globalAverage,
    totalApproved:       allGraded.length,
    totalPendingReview:  rows.reduce((s, r) => s + r.stats.pendingReview,  0),
    totalUnderReview:    rows.reduce((s, r) => s + r.stats.underReview,    0),
    totalNeedsRevision:  rows.reduce((s, r) => s + r.stats.needsRevision,  0),
  };

  return { rows: filtered, summary, phaseWeights: PHASE_WEIGHTS };
}

// ─── Team Activity Timeline ─────────────────────────────────────────────────
//
// Aggregates submissions, proposal events, meetings, risks, tasks, and
// supervisor notes into a single chronological feed for one team.

export async function getTeamActivity(teamId, { limit = 50 } = {}) {
  const [submissions, proposal, meetings, risks, tasks, notes, deadlines, announcements] = await Promise.all([
    prisma.submission.findMany({
      where: { teamId },
      select: {
        id: true, deliverableType: true, status: true, grade: true,
        submittedAt: true, reviewedAt: true, taReviewedAt: true,
        version: true,
        submittedBy: { select: { firstName: true, lastName: true, avatarUrl: true, role: true } },
        reviewedBy:  { select: { firstName: true, lastName: true, avatarUrl: true, role: true } },
        taReviewedBy:{ select: { firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 30,
    }),
    prisma.proposal.findUnique({
      where: { teamId },
      select: {
        id: true, title: true, status: true, version: true, revisionCount: true,
        submittedAt: true, reviewedAt: true, createdAt: true,
        authoredBy: { select: { firstName: true, lastName: true, avatarUrl: true, role: true } },
        reviewedBy: { select: { firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
    }),
    prisma.meeting.findMany({
      where: { teamId },
      select: {
        id: true, title: true, status: true, mode: true, startAt: true, createdAt: true,
        organizer: { select: { firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.risk.findMany({
      where: { teamId },
      select: {
        id: true, title: true, severity: true, status: true, approvalStatus: true,
        createdAt: true, updatedAt: true,
        createdBy: { select: { firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.task.findMany({
      where: { teamId, status: { in: ["REVIEW", "APPROVED", "DONE"] } },
      select: {
        id: true, title: true, status: true, priority: true,
        reviewedAt: true, createdAt: true,
        assignee:   { select: { firstName: true, lastName: true, avatarUrl: true, role: true } },
        reviewedBy: { select: { firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.teamSupervisorNote.findMany({
      where: { teamId },
      select: {
        id: true, content: true, createdAt: true,
        author: { select: { firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.teamDeliverableDeadline.findMany({
      where: { teamId },
      select: {
        id: true, deliverableType: true, dueDate: true, createdAt: true,
        setBy: { select: { firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.announcement.findMany({
      where: { targetTeams: { some: { teamId } } },
      select: {
        id: true, title: true, content: true, createdAt: true, authorRole: true,
        author: { select: { firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const events = [];

  function name(u) {
    return u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : null;
  }

  // Submissions — uploads
  for (const s of submissions) {
    events.push({
      id: `submission-up-${s.id}`,
      type: "submission",
      category: "submission",
      action: "uploaded",
      timestamp: s.submittedAt,
      title: `${s.deliverableType} submitted (v${s.version})`,
      detail: `Status: ${s.status}`,
      actor: s.submittedBy ? { name: name(s.submittedBy), avatarUrl: s.submittedBy.avatarUrl, role: s.submittedBy.role } : null,
    });
    if (s.taReviewedAt) {
      events.push({
        id: `submission-ta-${s.id}`,
        type: "submission",
        category: "submission",
        action: "ta-reviewed",
        timestamp: s.taReviewedAt,
        title: `${s.deliverableType} TA-reviewed`,
        detail: "Recommendation sent to doctor",
        actor: s.taReviewedBy ? { name: name(s.taReviewedBy), avatarUrl: s.taReviewedBy.avatarUrl, role: s.taReviewedBy.role } : null,
      });
    }
    if (s.reviewedAt) {
      events.push({
        id: `submission-fin-${s.id}`,
        type: "submission",
        category: "submission",
        action: "graded",
        timestamp: s.reviewedAt,
        title: `${s.deliverableType} graded`,
        detail: s.grade !== null ? `Final: ${s.grade}/100` : `Status: ${s.status}`,
        actor: s.reviewedBy ? { name: name(s.reviewedBy), avatarUrl: s.reviewedBy.avatarUrl, role: s.reviewedBy.role } : null,
      });
    }
  }

  // Proposal events
  if (proposal) {
    events.push({
      id: `proposal-create-${proposal.id}`,
      type: "proposal",
      category: "proposal",
      action: "created",
      timestamp: proposal.createdAt,
      title: `Proposal drafted: "${proposal.title}"`,
      detail: `v${proposal.version}`,
      actor: proposal.authoredBy ? { name: name(proposal.authoredBy), avatarUrl: proposal.authoredBy.avatarUrl, role: proposal.authoredBy.role } : null,
    });
    if (proposal.submittedAt) {
      events.push({
        id: `proposal-submit-${proposal.id}`,
        type: "proposal",
        category: "proposal",
        action: "submitted",
        timestamp: proposal.submittedAt,
        title: "Proposal submitted for review",
        detail: proposal.revisionCount > 0 ? `${proposal.revisionCount} revision(s)` : null,
        actor: proposal.authoredBy ? { name: name(proposal.authoredBy), avatarUrl: proposal.authoredBy.avatarUrl, role: proposal.authoredBy.role } : null,
      });
    }
    if (proposal.reviewedAt) {
      events.push({
        id: `proposal-review-${proposal.id}`,
        type: "proposal",
        category: "proposal",
        action: `proposal-${proposal.status.toLowerCase()}`,
        timestamp: proposal.reviewedAt,
        title: `Proposal ${proposal.status.replace("_", " ").toLowerCase()}`,
        detail: null,
        actor: proposal.reviewedBy ? { name: name(proposal.reviewedBy), avatarUrl: proposal.reviewedBy.avatarUrl, role: proposal.reviewedBy.role } : null,
      });
    }
  }

  // Meetings
  for (const m of meetings) {
    events.push({
      id: `meeting-${m.id}`,
      type: "meeting",
      category: "meeting",
      action: "scheduled",
      timestamp: m.createdAt,
      title: `Meeting: ${m.title}`,
      detail: `${m.mode} · ${m.status} · ${new Date(m.startAt).toLocaleString()}`,
      actor: m.organizer ? { name: name(m.organizer), avatarUrl: m.organizer.avatarUrl, role: m.organizer.role } : null,
    });
  }

  // Risks
  for (const r of risks) {
    events.push({
      id: `risk-${r.id}`,
      type: "risk",
      category: "risk",
      action: "raised",
      timestamp: r.createdAt,
      title: `Risk: ${r.title}`,
      detail: `${r.severity ?? "—"} · ${r.status} · ${r.approvalStatus}`,
      actor: r.createdBy ? { name: name(r.createdBy), avatarUrl: r.createdBy.avatarUrl, role: r.createdBy.role } : null,
    });
  }

  // Tasks (reviewed/done only — keeps timeline focused)
  for (const t of tasks) {
    events.push({
      id: `task-${t.id}`,
      type: "task",
      category: "task",
      action: t.status.toLowerCase(),
      timestamp: t.reviewedAt ?? t.createdAt,
      title: `Task: ${t.title}`,
      detail: `${t.priority} · ${t.status}`,
      actor: t.reviewedBy ? { name: name(t.reviewedBy), avatarUrl: t.reviewedBy.avatarUrl, role: t.reviewedBy.role } : (t.assignee ? { name: name(t.assignee), avatarUrl: t.assignee.avatarUrl, role: t.assignee.role } : null),
    });
  }

  // Supervisor notes (only visible to supervisor/admin — but timeline is gated upstream)
  for (const n of notes) {
    events.push({
      id: `note-${n.id}`,
      type: "note",
      category: "note",
      action: "note-added",
      timestamp: n.createdAt,
      title: "Supervisor note added",
      detail: n.content.length > 140 ? n.content.slice(0, 140) + "…" : n.content,
      actor: n.author ? { name: name(n.author), avatarUrl: n.author.avatarUrl, role: n.author.role } : null,
    });
  }

  // Deadlines
  for (const d of deadlines) {
    events.push({
      id: `deadline-${d.id}`,
      type: "deadline",
      category: "deadline",
      action: "deadline-set",
      timestamp: d.createdAt,
      title: `Deadline set: ${d.deliverableType}`,
      detail: `Due ${new Date(d.dueDate).toLocaleDateString()}`,
      actor: d.setBy ? { name: name(d.setBy), avatarUrl: d.setBy.avatarUrl, role: d.setBy.role } : null,
    });
  }

  // Announcements
  for (const a of announcements) {
    events.push({
      id: `announcement-${a.id}`,
      type: "announcement",
      category: "announcement",
      action: "announcement-posted",
      timestamp: a.createdAt,
      title: `Announcement: ${a.title}`,
      detail: a.content.length > 140 ? a.content.slice(0, 140) + "…" : a.content,
      actor: a.author ? { name: name(a.author), avatarUrl: a.author.avatarUrl, role: a.author.role } : null,
    });
  }

  return events
    .filter((e) => e.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

// ─── Analytics ──────────────────────────────────────────────────────────────
//
// Single endpoint serving both /analytics and /reports pages.
// Aggregates from existing tables — no new models needed.

const STAGE_ORDER = ["REQUIREMENTS", "DESIGN", "IMPLEMENTATION", "TESTING", "DEPLOYMENT", "MAINTENANCE"];
const STUDENT_SIDE_ROLES = new Set([ROLES.STUDENT, ROLES.LEADER]);

function countScopedUsersByRole(teams) {
  const scopedUsers = new Map();

  const addUser = (user) => {
    if (!user?.id || !STUDENT_SIDE_ROLES.has(user.role)) return;
    scopedUsers.set(user.id, user.role);
  };

  for (const team of teams) {
    addUser(team.leader);
    for (const member of team.members ?? []) {
      addUser(member.user);
    }
  }

  const usersByRole = {};
  for (const role of scopedUsers.values()) {
    usersByRole[role] = (usersByRole[role] ?? 0) + 1;
  }

  return {
    totalUsers: scopedUsers.size,
    usersByRole,
  };
}

export async function getAnalytics({ actor } = {}) {
  const isDoctor = actor?.role === "DOCTOR";
  const teamWhere = isDoctor ? { doctorId: actor.id } : {};
  const teamScopedWhere = isDoctor ? { team: { doctorId: actor.id } } : {};

  const [
    userCounts,
    teams,
    tasks,
    submissions,
    proposals,
    meetings,
    risks,
  ] = await Promise.all([
    isDoctor ? Promise.resolve(null) : prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.team.findMany({
      where: teamWhere,
      select: {
        id: true,
        name: true,
        stage: true,
        createdAt: true,
        leader: { select: { id: true, role: true } },
        doctor: { select: { id: true, role: true } },
        ta: { select: { id: true, role: true } },
        members: { select: { user: { select: { id: true, role: true } } } },
      },
    }),
    prisma.task.findMany({
      where: teamScopedWhere,
      select: {
        id: true, status: true, priority: true, dueDate: true,
        createdAt: true, updatedAt: true, integrationMode: true,
      },
    }),
    prisma.submission.findMany({
      where: teamScopedWhere,
      select: {
        id: true, status: true, sdlcPhase: true, deliverableType: true,
        grade: true, late: true, submittedAt: true,
      },
    }),
    prisma.proposal.findMany({
      where: teamScopedWhere,
      select: { id: true, status: true, createdAt: true, submittedAt: true, reviewedAt: true },
    }),
    prisma.meeting.findMany({ where: teamScopedWhere, select: { id: true, status: true, createdAt: true } }),
    prisma.risk.findMany({ where: teamScopedWhere, select: { id: true, status: true, severity: true, createdAt: true } }),
  ]);

  // ── Overview ───────────────────────────────────────────────────────────────
  const { totalUsers, usersByRole } = isDoctor
    ? countScopedUsersByRole(teams)
    : {
        totalUsers: userCounts.reduce((s, r) => s + r._count._all, 0),
        usersByRole: Object.fromEntries(userCounts.map((r) => [r.role, r._count._all])),
      };

  const teamsByStage = STAGE_ORDER.map((stage) => ({
    stage,
    count: teams.filter((t) => t.stage === stage).length,
  }));

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const tasksByStatus = {
    BACKLOG:     tasks.filter((t) => t.status === "BACKLOG").length,
    TODO:        tasks.filter((t) => t.status === "TODO").length,
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    REVIEW:      tasks.filter((t) => t.status === "REVIEW").length,
    APPROVED:    tasks.filter((t) => t.status === "APPROVED").length,
    DONE:        tasks.filter((t) => t.status === "DONE").length,
  };
  const tasksByPriority = {
    LOW:      tasks.filter((t) => t.priority === "LOW").length,
    MEDIUM:   tasks.filter((t) => t.priority === "MEDIUM").length,
    HIGH:     tasks.filter((t) => t.priority === "HIGH").length,
    CRITICAL: tasks.filter((t) => t.priority === "CRITICAL").length,
  };
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "DONE" && t.status !== "APPROVED",
  ).length;
  const completionRate = tasks.length
    ? Math.round(((tasksByStatus.DONE + tasksByStatus.APPROVED) / tasks.length) * 100)
    : 0;
  const githubLinkedTasks = tasks.filter((t) => t.integrationMode === "GITHUB").length;

  // ── Submissions ────────────────────────────────────────────────────────────
  const submissionsByStatus = {
    PENDING:           submissions.filter((s) => s.status === "PENDING").length,
    UNDER_REVIEW:      submissions.filter((s) => s.status === "UNDER_REVIEW").length,
    REVISION_REQUIRED: submissions.filter((s) => s.status === "REVISION_REQUIRED").length,
    APPROVED:          submissions.filter((s) => s.status === "APPROVED").length,
  };
  const graded = submissions.filter((s) => s.status === "APPROVED" && s.grade !== null);
  const averageGrade = graded.length
    ? Math.round(graded.reduce((sum, s) => sum + (s.grade ?? 0), 0) / graded.length)
    : 0;
  const onTimeRate = submissions.length
    ? Math.round((submissions.filter((s) => !s.late).length / submissions.length) * 100)
    : 100;
  const lateSubmissions = submissions.filter((s) => s.late).length;

  const submissionsByPhase = STAGE_ORDER.map((stage) => {
    const inPhase = submissions.filter((s) => s.sdlcPhase === stage);
    const approvedInPhase = inPhase.filter((s) => s.status === "APPROVED" && s.grade !== null);
    const phaseAvg = approvedInPhase.length
      ? Math.round(approvedInPhase.reduce((s, x) => s + (x.grade ?? 0), 0) / approvedInPhase.length)
      : null;
    return {
      stage,
      total: inPhase.length,
      approved: approvedInPhase.length,
      averageGrade: phaseAvg,
    };
  });

  // ── Proposals ──────────────────────────────────────────────────────────────
  const proposalsByStatus = {
    DRAFT:              proposals.filter((p) => p.status === "DRAFT").length,
    SUBMITTED:          proposals.filter((p) => p.status === "SUBMITTED").length,
    UNDER_REVIEW:       proposals.filter((p) => p.status === "UNDER_REVIEW").length,
    REVISION_REQUESTED: proposals.filter((p) => p.status === "REVISION_REQUESTED").length,
    APPROVED:           proposals.filter((p) => p.status === "APPROVED").length,
    REJECTED:           proposals.filter((p) => p.status === "REJECTED").length,
  };

  // ── Meetings ───────────────────────────────────────────────────────────────
  const meetingsByStatus = {
    PENDING_APPROVAL: meetings.filter((m) => m.status === "PENDING_APPROVAL").length,
    CONFIRMED:        meetings.filter((m) => m.status === "CONFIRMED").length,
    DECLINED:         meetings.filter((m) => m.status === "DECLINED").length,
    CANCELLED:        meetings.filter((m) => m.status === "CANCELLED").length,
    COMPLETED:        meetings.filter((m) => m.status === "COMPLETED").length,
  };

  // ── Risks ──────────────────────────────────────────────────────────────────
  const risksByStatus = {
    OPEN:       risks.filter((r) => r.status === "OPEN").length,
    MONITORING: risks.filter((r) => r.status === "MONITORING").length,
    RESOLVED:   risks.filter((r) => r.status === "RESOLVED").length,
  };
  const criticalRisksActive = risks.filter((r) => r.status !== "RESOLVED" && r.severity === "CRITICAL").length;

  // ── Time-series (last 12 weeks) ────────────────────────────────────────────
  function bucketByWeek(items, dateField) {
    const weeks = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i * 7 - 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const count = items.filter((it) => {
        const d = it[dateField] ? new Date(it[dateField]) : null;
        return d && d >= start && d < end;
      }).length;
      weeks.push({
        label: `W${12 - i}`,
        start: start.toISOString(),
        count,
      });
    }
    return weeks;
  }

  const trend = {
    submissions: bucketByWeek(submissions, "submittedAt"),
    tasks:       bucketByWeek(tasks, "createdAt"),
    meetings:    bucketByWeek(meetings, "createdAt"),
  };

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      totalUsers,
      usersByRole,
      totalTeams: teams.length,
      teamsByStage,
      averageGrade,
      completionRate,
      onTimeRate,
    },
    tasks: {
      total: tasks.length,
      byStatus: tasksByStatus,
      byPriority: tasksByPriority,
      overdue: overdueTasks,
      completionRate,
      githubLinked: githubLinkedTasks,
    },
    submissions: {
      total: submissions.length,
      byStatus: submissionsByStatus,
      byPhase: submissionsByPhase,
      averageGrade,
      onTimeRate,
      lateSubmissions,
      graded: graded.length,
    },
    proposals: {
      total: proposals.length,
      byStatus: proposalsByStatus,
    },
    meetings: {
      total: meetings.length,
      byStatus: meetingsByStatus,
    },
    risks: {
      total: risks.length,
      byStatus: risksByStatus,
      criticalOpen: criticalRisksActive,
      criticalActive: criticalRisksActive,
    },
    trend,
  };
}
