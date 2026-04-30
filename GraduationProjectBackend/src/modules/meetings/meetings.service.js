import { AppError } from "../../common/errors/AppError.js";
import { ROLES } from "../../common/constants/roles.js";
import { prisma } from "../../loaders/dbLoader.js";
import { notify } from "../../common/utils/notify.js";
import { emitToTeam, emitToUser } from "../../realtime/socket.js";
import { syncMeetingToProvider, deleteMeetingFromProvider } from "../calendar/calendar.providers.js";
import { teamUserSelect, findTeamById, findTeamByLeaderId, findTeamMemberByUserId } from "../teams/teams.repository.js";

const ACTIVE_MEETING_STATUSES = ["PENDING_APPROVAL", "CONFIRMED", "DECLINED"];

const meetingInclude = {
  team: {
    select: {
      id: true,
      name: true,
      leaderId: true,
      doctorId: true,
      taId: true,
      leader: { select: teamUserSelect },
      doctor: { select: teamUserSelect },
      ta: { select: teamUserSelect },
      members: {
        orderBy: { joinedAt: "asc" },
        select: { id: true, user: { select: teamUserSelect } },
      },
    },
  },
  organizer: { select: teamUserSelect },
  participants: {
    orderBy: [{ createdAt: "asc" }],
    include: { user: { select: teamUserSelect } },
  },
  approvals: {
    orderBy: [{ createdAt: "asc" }],
    include: { approver: { select: teamUserSelect } },
  },
};

const normalizeText = (value) => String(value ?? "").trim();
const buildFullName = (user) => `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
const isActiveMeetingStatus = (status) => ACTIVE_MEETING_STATUSES.includes(status);

function parseDate(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid ${fieldName}.`, 422, "INVALID_MEETING_DATE");
  }
  return date;
}

function assertValidRange(startAt, endAt, message = "Meeting end time must be after the start time.") {
  if (endAt <= startAt) {
    throw new AppError(message, 422, "INVALID_MEETING_RANGE");
  }
}

function assertMeetingRoleCanCreate(actor) {
  if (![ROLES.LEADER, ROLES.DOCTOR, ROLES.TA, ROLES.ADMIN].includes(actor.role)) {
    throw new AppError(
      "Only leaders, doctors, TAs, and admins can create meetings.",
      403,
      "MEETING_CREATE_FORBIDDEN"
    );
  }
}

async function resolveActorTeamContext(actor, requestedTeamId) {
  const teamId = normalizeText(requestedTeamId);

  if (actor.role === ROLES.ADMIN) {
    if (!teamId) throw new AppError("teamId is required.", 422, "TEAM_ID_REQUIRED");
    const team = await findTeamById(teamId);
    if (!team) throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
    return { team, actorTeamRole: "ADMIN" };
  }

  if (actor.role === ROLES.LEADER) {
    const team = await findTeamByLeaderId(actor.id);
    if (!team) throw new AppError("Create a team first.", 409, "TEAM_REQUIRED");
    if (teamId && team.id !== teamId) {
      throw new AppError("You can only manage meetings for your own team.", 403, "TEAM_FORBIDDEN");
    }
    return { team, actorTeamRole: "LEADER" };
  }

  if (actor.role === ROLES.STUDENT) {
    const membership = await findTeamMemberByUserId(actor.id);
    if (!membership?.team) throw new AppError("Join a team first.", 409, "TEAM_REQUIRED");
    if (teamId && membership.team.id !== teamId) {
      throw new AppError("You can only access your own team meetings.", 403, "TEAM_FORBIDDEN");
    }
    return { team: membership.team, actorTeamRole: "MEMBER" };
  }

  if (!teamId) throw new AppError("teamId is required.", 422, "TEAM_ID_REQUIRED");
  const team = await findTeamById(teamId);
  if (!team) throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");

  const supervises =
    (actor.role === ROLES.DOCTOR && team.doctor?.id === actor.id) ||
    (actor.role === ROLES.TA && team.ta?.id === actor.id);

  if (!supervises) throw new AppError("You are not assigned to this team.", 403, "TEAM_FORBIDDEN");
  return { team, actorTeamRole: actor.role };
}

function participantToAudience(participant) {
  return {
    id: participant.id,
    userId: participant.userId,
    email: participant.user?.email || participant.email || null,
    displayName: participant.user ? buildFullName(participant.user) : participant.displayName || participant.email || null,
    participantRole: participant.participantRole,
    responseStatus: participant.responseStatus,
    canApprove: Boolean(participant.canApprove),
    isExternalGuest: Boolean(participant.isExternalGuest),
    user: participant.user ? { ...participant.user, fullName: buildFullName(participant.user) } : null,
  };
}

function approvalSummary(approval) {
  return {
    id: approval.id,
    approverUserId: approval.approverUserId,
    approverRole: approval.approverRole,
    status: approval.status,
    proposedStartAt: approval.proposedStartAt,
    proposedEndAt: approval.proposedEndAt,
    note: approval.note,
    respondedAt: approval.respondedAt,
    approver: approval.approver ? { ...approval.approver, fullName: buildFullName(approval.approver) } : null,
  };
}

function buildMeetingPermissions(meeting, actor) {
  const isOrganizer = meeting.organizerId === actor.id;
  const participant = meeting.participants.find((item) => item.userId === actor.id);
  const approval = meeting.approvals.find((item) => item.approverUserId === actor.id);
  const canManage =
    actor.role === ROLES.ADMIN || isOrganizer || (actor.role === ROLES.LEADER && meeting.team.leaderId === actor.id);

  return {
    canManage,
    canApprove: Boolean(
      approval && ["PENDING", "PROPOSED_NEW_TIME"].includes(approval.status) && isActiveMeetingStatus(meeting.status)
    ),
    canRespond: Boolean(participant && !["CANCELLED", "COMPLETED"].includes(meeting.status)),
    isOrganizer,
  };
}

function mapMeeting(meeting, actor) {
  return {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    agenda: meeting.agenda,
    startAt: meeting.startAt,
    endAt: meeting.endAt,
    timezone: meeting.timezone,
    mode: meeting.mode,
    status: meeting.status,
    provider: meeting.provider,
    location: meeting.location,
    joinUrl: meeting.joinUrl,
    requiresApproval: meeting.requiresApproval,
    approvalRequestedAt: meeting.approvalRequestedAt,
    confirmedAt: meeting.confirmedAt,
    cancelledAt: meeting.cancelledAt,
    externalProvider: meeting.externalProvider,
    externalEventId: meeting.externalEventId,
    externalSyncStatus: meeting.externalSyncStatus,
    externalSyncError: meeting.externalSyncError,
    externalSyncedAt: meeting.externalSyncedAt,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
    team: {
      id: meeting.team.id,
      name: meeting.team.name,
      leader: meeting.team.leader ? { ...meeting.team.leader, fullName: buildFullName(meeting.team.leader) } : null,
      doctor: meeting.team.doctor ? { ...meeting.team.doctor, fullName: buildFullName(meeting.team.doctor) } : null,
      ta: meeting.team.ta ? { ...meeting.team.ta, fullName: buildFullName(meeting.team.ta) } : null,
    },
    organizer: { ...meeting.organizer, fullName: buildFullName(meeting.organizer) },
    participants: meeting.participants.map(participantToAudience),
    approvals: meeting.approvals.map(approvalSummary),
    permissions: buildMeetingPermissions(meeting, actor),
  };
}

function buildAttendeeList(meeting) {
  return meeting.participants
    .map((participant) => ({
      email: participant.user?.email || participant.email || null,
      displayName: participant.user ? buildFullName(participant.user) : participant.displayName || participant.email || null,
    }))
    .filter((attendee) => attendee.email);
}

async function getIntegrationForMeetingOrganizer(meeting, tx = prisma) {
  if (!meeting.externalProvider) return null;
  return tx.calendarIntegration.findUnique({
    where: { userId_provider: { userId: meeting.organizerId, provider: meeting.externalProvider } },
  });
}

async function pushMeetingEvent(meeting, event, actor, tx = prisma) {
  const userIds = new Set(meeting.participants.map((participant) => participant.userId).filter(Boolean));
  userIds.add(meeting.organizerId);
  meeting.approvals.forEach((approval) => userIds.add(approval.approverUserId));

  const payload = { meeting: mapMeeting(meeting, actor) };
  emitToTeam(meeting.teamId, event, payload);
  userIds.forEach((userId) => emitToUser(userId, event, payload));

  const titleByEvent = {
    "meeting.created": "Meeting created",
    "meeting.pending": "Meeting awaiting approval",
    "meeting.approved": "Meeting approved",
    "meeting.declined": "Meeting needs rescheduling",
    "meeting.updated": "Meeting updated",
    "meeting.cancelled": "Meeting cancelled",
    "meeting.completed": "Meeting completed",
    "meeting.deleted": "Meeting deleted",
    "meeting.response": "Meeting response updated",
  };

  await Promise.all(
    Array.from(userIds)
      .filter(Boolean)
      .map((userId) =>
        notify(
          {
            userId,
            type: "SYSTEM",
            title: titleByEvent[event] || "Meeting update",
            message: `${meeting.title} - ${meeting.status.replace(/_/g, " ")}`,
            actionUrl: event === "meeting.deleted" ? "/dashboard/meetings" : `/dashboard/meetings?meetingId=${meeting.id}`,
          },
          tx
        )
      )
  );
}

function buildParticipantRows(team, actor, payload) {
  const rows = [];
  const userIds = new Set();
  const emails = new Set();

  const addInternal = (user, participantRole, canApprove = false) => {
    if (!user?.id || userIds.has(user.id)) return;
    userIds.add(user.id);
    if (user.email) emails.add(String(user.email).toLowerCase());
    rows.push({
      userId: user.id,
      email: user.email,
      displayName: buildFullName(user),
      participantRole,
      responseStatus: user.id === actor.id ? "ACCEPTED" : "PENDING",
      canApprove,
      isExternalGuest: false,
    });
  };

  addInternal(team.leader, actor.role === ROLES.LEADER ? "ORGANIZER" : "LEADER", false);
  if (actor.role === ROLES.DOCTOR && team.doctor) addInternal(team.doctor, "ORGANIZER", false);
  if (actor.role === ROLES.TA && team.ta) addInternal(team.ta, "ORGANIZER", false);
  if (payload.includeDoctor !== false && team.doctor) addInternal(team.doctor, "DOCTOR", actor.role === ROLES.LEADER);
  if (payload.includeTa !== false && team.ta) addInternal(team.ta, "TA", actor.role === ROLES.LEADER);
  if (payload.includeTeamMembers !== false) team.members.forEach((member) => addInternal(member.user, "MEMBER", false));

  for (const userId of payload.participantUserIds || []) {
    const match = [team.leader, team.doctor, team.ta, ...team.members.map((member) => member.user)].find(
      (user) => user?.id === userId
    );
    if (!match) continue;

    let role = "MEMBER";
    if (team.doctor?.id === userId) role = "DOCTOR";
    else if (team.ta?.id === userId) role = "TA";
    else if (team.leader?.id === userId) role = actor.role === ROLES.LEADER ? "ORGANIZER" : "LEADER";

    addInternal(match, role, actor.role === ROLES.LEADER && [team.doctor?.id, team.ta?.id].includes(userId));
  }

  for (const guest of payload.externalGuests || []) {
    const email = normalizeText(guest.email).toLowerCase();
    if (!email || emails.has(email)) continue;
    emails.add(email);
    rows.push({
      email,
      displayName: normalizeText(guest.displayName) || email,
      participantRole: "EXTERNAL",
      responseStatus: "PENDING",
      canApprove: false,
      isExternalGuest: true,
    });
  }

  return rows;
}

function buildApprovalRows(actor, team, participantRows) {
  if (actor.role !== ROLES.LEADER) return [];
  return participantRows
    .filter((participant) => participant.canApprove && participant.userId)
    .map((participant) => ({
      approverUserId: participant.userId,
      approverRole: participant.participantRole,
      status: "PENDING",
    }));
}

const requiresApproval = (actor, approvalRows) => actor.role === ROLES.LEADER && approvalRows.length > 0;

async function assertNoScheduleConflict({ teamId, startAt, endAt, excludeMeetingId }) {
  const conflict = await prisma.meeting.findFirst({
    where: {
      teamId,
      status: { in: ACTIVE_MEETING_STATUSES },
      ...(excludeMeetingId ? { id: { not: excludeMeetingId } } : {}),
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true, title: true, startAt: true, endAt: true },
  });

  if (conflict) {
    throw new AppError(
      `This meeting overlaps with "${conflict.title}". Choose a different time or edit the existing meeting.`,
      409,
      "MEETING_TIME_CONFLICT"
    );
  }
}

async function syncConfirmedMeeting(meetingId, actor) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: meetingInclude });
  if (!meeting || meeting.status !== "CONFIRMED") return meeting;

  if (!meeting.externalProvider) {
    return prisma.meeting.update({
      where: { id: meetingId },
      data: { externalSyncStatus: "NOT_CONNECTED", externalSyncError: null, externalSyncedAt: null },
      include: meetingInclude,
    });
  }

  const integration = await getIntegrationForMeetingOrganizer(meeting);
  if (!integration || !integration.syncEnabled) {
    return prisma.meeting.update({
      where: { id: meetingId },
      data: {
        externalSyncStatus: "NOT_CONNECTED",
        externalSyncError: `The organizer must connect ${meeting.externalProvider === "GOOGLE" ? "Google" : "Outlook"} Calendar first.`,
      },
      include: meetingInclude,
    });
  }

  try {
    const synced = await syncMeetingToProvider(meeting, integration, buildAttendeeList(meeting));
    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        externalCalendarId: synced.externalCalendarId,
        externalEventId: synced.externalEventId,
        joinUrl: meeting.mode !== "IN_PERSON" ? synced.joinUrl || meeting.joinUrl : meeting.joinUrl,
        externalSyncStatus: synced.externalSyncError ? "ERROR" : "SYNCED",
        externalSyncError: synced.externalSyncError,
        externalSyncedAt: new Date(),
      },
      include: meetingInclude,
    });
    emitToTeam(updated.teamId, "calendar.event.updated", { meeting: mapMeeting(updated, actor) });
    return updated;
  } catch (error) {
    return prisma.meeting.update({
      where: { id: meetingId },
      data: { externalSyncStatus: "ERROR", externalSyncError: error.message || "Calendar sync failed." },
      include: meetingInclude,
    });
  }
}

async function assertActorCanAccessMeeting(actor, meeting) {
  if (!meeting) throw new AppError("Meeting not found.", 404, "MEETING_NOT_FOUND");

  const canAccess =
    actor.role === ROLES.ADMIN ||
    meeting.organizerId === actor.id ||
    (meeting.team.leaderId === actor.id && actor.role === ROLES.LEADER) ||
    meeting.participants.some((participant) => participant.userId === actor.id) ||
    meeting.approvals.some((approval) => approval.approverUserId === actor.id) ||
    (actor.role === ROLES.STUDENT && meeting.team.members.some((member) => member.user.id === actor.id));

  if (!canAccess) throw new AppError("You are not allowed to access this meeting.", 403, "MEETING_FORBIDDEN");
}

async function assertActorCanManageMeeting(actor, meeting) {
  await assertActorCanAccessMeeting(actor, meeting);
  if (
    actor.role === ROLES.ADMIN ||
    meeting.organizerId === actor.id ||
    (actor.role === ROLES.LEADER && meeting.team.leaderId === actor.id)
  ) {
    return;
  }
  throw new AppError("Only the organizer or a team leader can manage this meeting.", 403, "MEETING_MANAGE_FORBIDDEN");
}

async function maybeResubmitApprovals(meeting, actor) {
  if (!(meeting.requiresApproval && ["DECLINED", "PENDING_APPROVAL"].includes(meeting.status))) return meeting;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.meetingApproval.updateMany({
      where: { meetingId: meeting.id },
      data: { status: "PENDING", proposedStartAt: null, proposedEndAt: null, note: null, respondedAt: null },
    });
    await tx.meetingParticipant.updateMany({
      where: { meetingId: meeting.id, canApprove: true },
      data: { responseStatus: "PENDING" },
    });
    return tx.meeting.update({
      where: { id: meeting.id },
      data: { status: "PENDING_APPROVAL", approvalRequestedAt: new Date(), confirmedAt: null, cancelledAt: null },
      include: meetingInclude,
    });
  });

  await pushMeetingEvent(updated, "meeting.pending", actor);
  return updated;
}

async function tryDeleteExternalEvent(meeting) {
  if (!meeting.externalProvider || !meeting.externalEventId) return;
  const integration = await getIntegrationForMeetingOrganizer(meeting);
  if (!integration || !integration.syncEnabled) return;
  try {
    await deleteMeetingFromProvider(meeting, integration);
  } catch (error) {
    console.warn("[meetings] Failed to delete provider event:", error?.message ?? error);
  }
}

export async function listMeetingsService(actor, query = {}) {
  const teamId = normalizeText(query.teamId);
  const status = normalizeText(query.status);
  const start = query.start ? parseDate(query.start, "start") : null;
  const end = query.end ? parseDate(query.end, "end") : null;
  const where = { AND: [] };

  if (teamId) where.AND.push({ teamId });
  if (status) where.AND.push({ status });
  if (start) where.AND.push({ endAt: { gte: start } });
  if (end) where.AND.push({ startAt: { lte: end } });

  if (actor.role === ROLES.LEADER) {
    const team = await findTeamByLeaderId(actor.id);
    if (!team) return [];
    where.AND.push({ teamId: team.id });
  } else if (actor.role === ROLES.STUDENT) {
    const membership = await findTeamMemberByUserId(actor.id);
    if (!membership?.team) return [];
    where.AND.push({ teamId: membership.team.id });
  } else if (actor.role !== ROLES.ADMIN) {
    where.AND.push({
      OR: [{ organizerId: actor.id }, { participants: { some: { userId: actor.id } } }, { approvals: { some: { approverUserId: actor.id } } }],
    });
  }

  const meetings = await prisma.meeting.findMany({
    where: where.AND.length ? where : undefined,
    orderBy: [{ startAt: "asc" }],
    include: meetingInclude,
  });

  return meetings.map((meeting) => mapMeeting(meeting, actor));
}

export async function getMeetingService(actor, meetingId) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: meetingInclude });
  await assertActorCanAccessMeeting(actor, meeting);
  return mapMeeting(meeting, actor);
}

export async function createMeetingService(actor, payload) {
  assertMeetingRoleCanCreate(actor);
  const { team } = await resolveActorTeamContext(actor, payload.teamId);
  const startAt = parseDate(payload.startAt, "startAt");
  const endAt = parseDate(payload.endAt, "endAt");
  assertValidRange(startAt, endAt);
  await assertNoScheduleConflict({ teamId: team.id, startAt, endAt });

  const participantRows = buildParticipantRows(team, actor, payload);
  const approvalRows = buildApprovalRows(actor, team, participantRows);
  const needsApproval = requiresApproval(actor, approvalRows);
  const mode = payload.mode || "VIRTUAL";
  const externalProvider = mode === "IN_PERSON" ? null : payload.externalProvider || null;
  const provider = mode !== "IN_PERSON" ? payload.provider || (externalProvider === "GOOGLE" ? "GOOGLE_MEET" : externalProvider === "OUTLOOK" ? "MICROSOFT_TEAMS" : "MANUAL") : "MANUAL";

  const created = await prisma.meeting.create({
    data: {
      teamId: team.id,
      organizerId: actor.id,
      organizerRole: actor.role,
      title: normalizeText(payload.title),
      description: normalizeText(payload.description) || null,
      agenda: normalizeText(payload.agenda) || null,
      startAt,
      endAt,
      timezone: normalizeText(payload.timezone) || "Africa/Cairo",
      mode,
      status: needsApproval ? "PENDING_APPROVAL" : "CONFIRMED",
      provider,
      location: normalizeText(payload.location) || null,
      requiresApproval: needsApproval,
      approvalRequestedAt: needsApproval ? new Date() : null,
      confirmedAt: needsApproval ? null : new Date(),
      externalProvider,
      participants: { create: participantRows },
      approvals: approvalRows.length ? { create: approvalRows } : undefined,
    },
    include: meetingInclude,
  });

  const finalMeeting = !needsApproval ? await syncConfirmedMeeting(created.id, actor) : created;
  await pushMeetingEvent(finalMeeting, needsApproval ? "meeting.pending" : "meeting.created", actor);
  return mapMeeting(finalMeeting, actor);
}

export async function updateMeetingService(actor, meetingId, payload) {
  const existing = await prisma.meeting.findUnique({ where: { id: meetingId }, include: meetingInclude });
  await assertActorCanManageMeeting(actor, existing);

  if (["CANCELLED", "COMPLETED"].includes(existing.status)) {
    throw new AppError("Cancelled or completed meetings cannot be edited.", 409, "MEETING_LOCKED");
  }

  const data = {};
  if (payload.title !== undefined) data.title = normalizeText(payload.title);
  if (payload.description !== undefined) data.description = normalizeText(payload.description) || null;
  if (payload.agenda !== undefined) data.agenda = normalizeText(payload.agenda) || null;
  if (payload.startAt !== undefined) data.startAt = parseDate(payload.startAt, "startAt");
  if (payload.endAt !== undefined) data.endAt = parseDate(payload.endAt, "endAt");
  if (payload.timezone !== undefined) data.timezone = normalizeText(payload.timezone) || "Africa/Cairo";
  if (payload.mode !== undefined) data.mode = payload.mode;
  if (payload.location !== undefined) data.location = normalizeText(payload.location) || null;
  if (payload.provider !== undefined) data.provider = payload.provider;
  if (payload.externalProvider !== undefined) data.externalProvider = payload.externalProvider || null;

  const startAt = data.startAt || existing.startAt;
  const endAt = data.endAt || existing.endAt;
  assertValidRange(startAt, endAt);
  await assertNoScheduleConflict({ teamId: existing.teamId, startAt, endAt, excludeMeetingId: existing.id });

  const effectiveMode = data.mode || existing.mode;
  if (effectiveMode === "IN_PERSON") {
    data.provider = "MANUAL";
    data.externalProvider = null;
  }

  if ((payload.externalProvider !== undefined && !payload.externalProvider) || effectiveMode === "IN_PERSON") {
    await tryDeleteExternalEvent(existing);
    data.externalCalendarId = null;
    data.externalEventId = null;
    data.externalSyncStatus = "NOT_CONNECTED";
    data.externalSyncError = null;
    data.externalSyncedAt = null;
  }

  let updated = await prisma.meeting.update({ where: { id: meetingId }, data, include: meetingInclude });
  if (updated.requiresApproval && ["DECLINED", "PENDING_APPROVAL"].includes(updated.status)) {
    updated = await maybeResubmitApprovals(updated, actor);
  } else if (updated.status === "CONFIRMED") {
    updated = await syncConfirmedMeeting(updated.id, actor);
  }

  await pushMeetingEvent(updated, "meeting.updated", actor);
  return mapMeeting(updated, actor);
}

export async function approveMeetingService(actor, meetingId) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: meetingInclude });
  await assertActorCanAccessMeeting(actor, meeting);

  if (!isActiveMeetingStatus(meeting.status)) {
    throw new AppError("This meeting can no longer be approved.", 409, "MEETING_NOT_ACTIVE");
  }

  const approval = meeting.approvals.find((item) => item.approverUserId === actor.id);
  if (!approval) throw new AppError("You are not an approver for this meeting.", 403, "MEETING_APPROVAL_FORBIDDEN");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.meetingApproval.update({
      where: { id: approval.id },
      data: { status: "APPROVED", respondedAt: new Date(), proposedStartAt: null, proposedEndAt: null, note: null },
    });
    await tx.meetingParticipant.updateMany({
      where: { meetingId, userId: actor.id },
      data: { responseStatus: "ACCEPTED" },
    });
    const approvals = await tx.meetingApproval.findMany({ where: { meetingId } });
    const fullyApproved = approvals.every((item) => item.status === "APPROVED");
    return tx.meeting.update({
      where: { id: meetingId },
      data: fullyApproved ? { status: "CONFIRMED", confirmedAt: new Date(), cancelledAt: null } : undefined,
      include: meetingInclude,
    });
  });

  const finalMeeting = updated.status === "CONFIRMED" ? await syncConfirmedMeeting(updated.id, actor) : updated;
  await pushMeetingEvent(finalMeeting, finalMeeting.status === "CONFIRMED" ? "meeting.approved" : "meeting.pending", actor);
  return mapMeeting(finalMeeting, actor);
}

export async function declineMeetingService(actor, meetingId, payload) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: meetingInclude });
  await assertActorCanAccessMeeting(actor, meeting);

  if (!isActiveMeetingStatus(meeting.status)) {
    throw new AppError("This meeting can no longer be declined.", 409, "MEETING_NOT_ACTIVE");
  }

  const approval = meeting.approvals.find((item) => item.approverUserId === actor.id);
  if (!approval) throw new AppError("You are not an approver for this meeting.", 403, "MEETING_APPROVAL_FORBIDDEN");

  const proposedStartAt = parseDate(payload.proposedStartAt, "proposedStartAt");
  const proposedEndAt = parseDate(payload.proposedEndAt, "proposedEndAt");
  assertValidRange(proposedStartAt, proposedEndAt, "Proposed end time must be after the proposed start time.");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.meetingApproval.update({
      where: { id: approval.id },
      data: {
        status: "DECLINED",
        proposedStartAt,
        proposedEndAt,
        note: normalizeText(payload.note) || null,
        respondedAt: new Date(),
      },
    });
    await tx.meetingParticipant.updateMany({
      where: { meetingId, userId: actor.id },
      data: { responseStatus: "DECLINED" },
    });
    return tx.meeting.update({
      where: { id: meetingId },
      data: { status: "DECLINED", confirmedAt: null, cancelledAt: null },
      include: meetingInclude,
    });
  });

  await pushMeetingEvent(updated, "meeting.declined", actor);
  return mapMeeting(updated, actor);
}

export async function respondMeetingService(actor, meetingId, payload) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: meetingInclude });
  await assertActorCanAccessMeeting(actor, meeting);

  if (["CANCELLED", "COMPLETED"].includes(meeting.status)) {
    throw new AppError("Responses are closed for this meeting.", 409, "MEETING_RESPONSE_CLOSED");
  }

  const participant = meeting.participants.find((item) => item.userId === actor.id);
  if (!participant) throw new AppError("You are not a participant in this meeting.", 403, "MEETING_RESPONSE_FORBIDDEN");

  const updated = await prisma.meetingParticipant.update({
    where: { id: participant.id },
    data: { responseStatus: payload.responseStatus },
    include: { meeting: { include: meetingInclude } },
  });

  await pushMeetingEvent(updated.meeting, "meeting.response", actor);
  return mapMeeting(updated.meeting, actor);
}

export async function cancelMeetingService(actor, meetingId) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: meetingInclude });
  await assertActorCanManageMeeting(actor, meeting);

  if (meeting.status === "CANCELLED") return mapMeeting(meeting, actor);
  if (meeting.status === "COMPLETED") {
    throw new AppError("Completed meetings cannot be cancelled.", 409, "MEETING_ALREADY_COMPLETED");
  }

  await tryDeleteExternalEvent(meeting);
  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      externalSyncStatus: meeting.externalEventId ? "DISCONNECTED" : meeting.externalSyncStatus,
      externalSyncError: null,
    },
    include: meetingInclude,
  });

  await pushMeetingEvent(updated, "meeting.cancelled", actor);
  return mapMeeting(updated, actor);
}

export async function completeMeetingService(actor, meetingId) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: meetingInclude });
  await assertActorCanManageMeeting(actor, meeting);

  if (meeting.status === "COMPLETED") return mapMeeting(meeting, actor);
  if (meeting.status === "CANCELLED") {
    throw new AppError("Cancelled meetings cannot be completed.", 409, "MEETING_ALREADY_CANCELLED");
  }
  if (meeting.status !== "CONFIRMED") {
    throw new AppError("Only confirmed meetings can be marked completed.", 409, "MEETING_NOT_CONFIRMED");
  }

  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "COMPLETED" },
    include: meetingInclude,
  });

  await pushMeetingEvent(updated, "meeting.completed", actor);
  return mapMeeting(updated, actor);
}

export async function deleteMeetingService(actor, meetingId) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: meetingInclude });
  await assertActorCanManageMeeting(actor, meeting);
  await tryDeleteExternalEvent(meeting);
  await prisma.meeting.delete({ where: { id: meetingId } });
  await pushMeetingEvent(meeting, "meeting.deleted", actor);
  return { id: meetingId, deleted: true };
}

export async function syncMeetingService(actor, meetingId) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: meetingInclude });
  await assertActorCanManageMeeting(actor, meeting);

  if (meeting.status !== "CONFIRMED") {
    throw new AppError("Only confirmed meetings can be synced.", 409, "MEETING_NOT_CONFIRMED");
  }

  const updated = await syncConfirmedMeeting(meeting.id, actor);
  await pushMeetingEvent(updated, "meeting.updated", actor);
  return mapMeeting(updated, actor);
}
