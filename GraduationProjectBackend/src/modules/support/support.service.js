import { AppError } from "../../common/errors/AppError.js";
import { ACCOUNT_STATUSES } from "../../common/constants/accountStatuses.js";
import { ROLES } from "../../common/constants/roles.js";
import { notify } from "../../common/utils/notify.js";
import { prisma } from "../../loaders/dbLoader.js";
import { emitToUser } from "../../realtime/socket.js";

const STAFF_ROLES = new Set([ROLES.SUPPORT]);
const CLOSED_STATUSES = new Set(["RESOLVED", "CLOSED"]);
const SLA_HOURS_BY_PRIORITY = {
  URGENT: 4,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 72,
};
const SLA_ACTIVE_STATUSES = new Set(["OPEN", "IN_PROGRESS"]);
const DUE_SOON_HOURS = 4;
const MAX_TAGS = 8;

const supportUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  academicId: true,
  avatarUrl: true,
  accountStatus: true,
};

const ticketInclude = {
  requester: { select: supportUserSelect },
  assignedSupport: { select: supportUserSelect },
  messages: {
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: supportUserSelect },
      attachments: {
        orderBy: { createdAt: "asc" },
        include: { uploadedBy: { select: supportUserSelect } },
      },
    },
  },
  attachments: {
    orderBy: { createdAt: "asc" },
    include: { uploadedBy: { select: supportUserSelect } },
  },
  activities: {
    orderBy: { createdAt: "asc" },
    include: { actor: { select: supportUserSelect } },
  },
};

function isSupportStaff(actor) {
  return STAFF_ROLES.has(actor?.role);
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeTag(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 32);
}

function normalizeTags(value) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(",");
  return Array.from(new Set(source.map(normalizeTag).filter(Boolean))).slice(0, MAX_TAGS);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getSlaHours(priority) {
  return SLA_HOURS_BY_PRIORITY[priority] ?? SLA_HOURS_BY_PRIORITY.MEDIUM;
}

function getResponseDueAt(priority, from = new Date()) {
  return addHours(from, getSlaHours(priority));
}

function getSlaState(ticket, now = new Date()) {
  if (!SLA_ACTIVE_STATUSES.has(ticket.status)) {
    return { state: "PAUSED", dueAt: null, minutesRemaining: null, targetHours: getSlaHours(ticket.priority) };
  }

  if (ticket.snoozedUntil && new Date(ticket.snoozedUntil) > now) {
    return {
      state: "SNOOZED",
      dueAt: ticket.snoozedUntil,
      minutesRemaining: Math.ceil((new Date(ticket.snoozedUntil).getTime() - now.getTime()) / 60000),
      targetHours: getSlaHours(ticket.priority),
    };
  }

  const dueAt = ticket.nextResponseDueAt ?? ticket.firstResponseDueAt ?? null;
  if (!dueAt) {
    return { state: "PAUSED", dueAt: null, minutesRemaining: null, targetHours: getSlaHours(ticket.priority) };
  }

  const dueDate = new Date(dueAt);
  const minutesRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / 60000);
  const dueSoonMinutes = DUE_SOON_HOURS * 60;
  const state = minutesRemaining < 0 ? "OVERDUE" : minutesRemaining <= dueSoonMinutes ? "DUE_SOON" : "OK";

  return { state, dueAt, minutesRemaining, targetHours: getSlaHours(ticket.priority) };
}

function nextSlaFieldsFor({ status, priority, firstSupportResponseAt }, now = new Date()) {
  if (!SLA_ACTIVE_STATUSES.has(status)) {
    return { nextResponseDueAt: null };
  }
  return {
    nextResponseDueAt: getResponseDueAt(priority, now),
    ...(firstSupportResponseAt ? {} : { firstResponseDueAt: getResponseDueAt(priority, now) }),
  };
}

function fullName(user) {
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || user?.email || "User";
}

async function getActorProfile(actor) {
  if (!actor?.id) return null;
  return prisma.user.findUnique({ where: { id: actor.id }, select: supportUserSelect });
}

function toUserSummary(user) {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: fullName(user),
    email: user.email,
    role: user.role,
    academicId: user.academicId ?? null,
    avatarUrl: user.avatarUrl ?? null,
    accountStatus: user.accountStatus ?? ACCOUNT_STATUSES.ACTIVE,
  };
}

function toAttachmentResponse(attachment) {
  return {
    id: attachment.id,
    ticketId: attachment.ticketId,
    messageId: attachment.messageId ?? null,
    fileUrl: attachment.fileUrl,
    fileName: attachment.fileName,
    fileSize: attachment.fileSize,
    fileType: attachment.fileType,
    uploadedBy: toUserSummary(attachment.uploadedBy),
    createdAt: attachment.createdAt,
  };
}

function toMessageResponse(message) {
  return {
    id: message.id,
    ticketId: message.ticketId,
    author: toUserSummary(message.author),
    visibility: message.visibility,
    body: message.body,
    attachments: (message.attachments ?? []).map(toAttachmentResponse),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

function toActivityResponse(activity) {
  return {
    id: activity.id,
    ticketId: activity.ticketId,
    actor: toUserSummary(activity.actor),
    type: activity.type,
    fromValue: activity.fromValue ?? null,
    toValue: activity.toValue ?? null,
    metadata: activity.metadata ?? null,
    createdAt: activity.createdAt,
  };
}

function toSavedReplyResponse(savedReply) {
  return {
    id: savedReply.id,
    title: savedReply.title,
    body: savedReply.body,
    category: savedReply.category ?? null,
    usageCount: savedReply.usageCount,
    isActive: savedReply.isActive,
    createdBy: toUserSummary(savedReply.createdBy),
    createdAt: savedReply.createdAt,
    updatedAt: savedReply.updatedAt,
  };
}

function canViewTicket(actor, ticket) {
  return isSupportStaff(actor) || ticket.requesterUserId === actor?.id;
}

function assertCanViewTicket(actor, ticket) {
  if (!ticket) throw new AppError("Support ticket not found.", 404, "SUPPORT_TICKET_NOT_FOUND");
  if (!canViewTicket(actor, ticket)) {
    throw new AppError("You are not allowed to access this support ticket.", 403, "SUPPORT_TICKET_FORBIDDEN");
  }
}

function assertCanManageTickets(actor) {
  if (!isSupportStaff(actor)) {
    throw new AppError("Only support accounts can manage support tickets.", 403, "SUPPORT_STAFF_ONLY");
  }
}

function assertCanCreateRequesterTicket(actor) {
  if (actor?.role === ROLES.SUPPORT) {
    throw new AppError("Support accounts manage tickets and cannot submit requester tickets.", 403, "SUPPORT_REQUESTER_FORBIDDEN");
  }
}

function makeTicketNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TKT-${stamp}-${suffix}`;
}

function mapUploadedFile(file, ticketId, messageId, uploadedById) {
  return {
    ticketId,
    messageId,
    uploadedById,
    fileUrl: `/uploads/support/${file.filename}`,
    fileName: file.originalname,
    fileSize: file.size,
    fileType: file.mimetype,
  };
}

function toTicketSummary(ticket, actor) {
  const visibleMessages = (ticket.messages ?? []).filter((message) => isSupportStaff(actor) || message.visibility === "PUBLIC");
  const lastMessage = visibleMessages[visibleMessages.length - 1] ?? null;
  const publicMessageCount = (ticket.messages ?? []).filter((message) => message.visibility === "PUBLIC").length;
  const internalNoteCount = (ticket.messages ?? []).filter((message) => message.visibility === "INTERNAL").length;

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    source: ticket.source,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    tags: ticket.tags ?? [],
    sla: getSlaState(ticket),
    requester: toUserSummary(ticket.requester),
    assignedSupport: toUserSummary(ticket.assignedSupport),
    lastMessage: lastMessage ? toMessageResponse(lastMessage) : null,
    counts: {
      publicMessages: publicMessageCount,
      internalNotes: isSupportStaff(actor) ? internalNoteCount : 0,
      attachments: (ticket.attachments ?? []).length,
    },
    firstResponseDueAt: ticket.firstResponseDueAt ?? null,
    nextResponseDueAt: ticket.nextResponseDueAt ?? null,
    firstSupportResponseAt: ticket.firstSupportResponseAt ?? null,
    snoozedUntil: ticket.snoozedUntil ?? null,
    lastActivityAt: ticket.lastActivityAt,
    resolvedAt: ticket.resolvedAt ?? null,
    closedAt: ticket.closedAt ?? null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

function toTicketDetail(ticket, actor) {
  const supportStaff = isSupportStaff(actor);
  const messages = (ticket.messages ?? []).filter((message) => supportStaff || message.visibility === "PUBLIC");
  const visibleMessageIds = new Set(messages.map((message) => message.id));
  const activities = (ticket.activities ?? []).filter((activity) => supportStaff || activity.type !== "INTERNAL_NOTE_ADDED");
  const attachments = (ticket.attachments ?? []).filter(
    (attachment) => supportStaff || !attachment.messageId || visibleMessageIds.has(attachment.messageId),
  );

  return {
    ...toTicketSummary({ ...ticket, messages, attachments }, actor),
    messages: messages.map(toMessageResponse),
    attachments: attachments.map(toAttachmentResponse),
    activities: activities.map(toActivityResponse),
  };
}

async function findTicketOrThrow(actor, id) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, include: ticketInclude });
  assertCanViewTicket(actor, ticket);
  return ticket;
}

function buildListWhere(actor, { search, status, statusGroup, priority, category, assignedTo, tags, sla, source, createdFrom, createdTo }) {
  const where = {};

  if (!isSupportStaff(actor)) {
    where.requesterUserId = actor.id;
  }

  if (status) where.status = status;
  else if (statusGroup === "active") where.status = { notIn: Array.from(CLOSED_STATUSES) };
  else if (statusGroup === "archive") where.status = { in: Array.from(CLOSED_STATUSES) };
  if (priority) where.priority = priority;
  if (category) where.category = category;
  if (source) where.source = source;

  const normalizedTags = normalizeTags(tags);
  if (normalizedTags.length) where.tags = { hasSome: normalizedTags };

  if (createdFrom || createdTo) {
    where.createdAt = {};
    if (createdFrom) where.createdAt.gte = createdFrom;
    if (createdTo) where.createdAt.lte = createdTo;
  }

  if (sla) {
    const now = new Date();
    const dueSoonAt = addHours(now, DUE_SOON_HOURS);
    if (sla === "overdue") {
      if (!where.status) where.status = { in: Array.from(SLA_ACTIVE_STATUSES) };
      where.nextResponseDueAt = { lt: now };
    } else if (sla === "dueSoon") {
      if (!where.status) where.status = { in: Array.from(SLA_ACTIVE_STATUSES) };
      where.nextResponseDueAt = { gte: now, lte: dueSoonAt };
    } else if (sla === "ok") {
      where.OR = [
        { status: { notIn: Array.from(SLA_ACTIVE_STATUSES) } },
        { nextResponseDueAt: null },
        { nextResponseDueAt: { gt: dueSoonAt } },
      ];
    }
  }

  if (isSupportStaff(actor) && assignedTo) {
    if (assignedTo === "me") where.assignedSupportUserId = actor.id;
    else if (assignedTo === "unassigned") where.assignedSupportUserId = null;
    else where.assignedSupportUserId = assignedTo;
  }

  const normalizedSearch = normalizeText(search);
  if (normalizedSearch) {
    const searchWhere = [
      { ticketNumber: { contains: normalizedSearch, mode: "insensitive" } },
      { subject: { contains: normalizedSearch, mode: "insensitive" } },
      { requester: { firstName: { contains: normalizedSearch, mode: "insensitive" } } },
      { requester: { lastName: { contains: normalizedSearch, mode: "insensitive" } } },
      { requester: { email: { contains: normalizedSearch, mode: "insensitive" } } },
    ];
    if (where.OR) {
      where.AND = [...(where.AND ?? []), { OR: where.OR }, { OR: searchWhere }];
      delete where.OR;
    } else {
      where.OR = searchWhere;
    }
  }

  return where;
}

async function notifyUsers(userIds, payload, actorId = null) {
  const uniqueIds = Array.from(new Set(userIds.filter((id) => id && id !== actorId)));
  await Promise.all(uniqueIds.map((userId) => notify({ userId, ...payload })));
}

async function getSupportRecipientIds(excludeUserId = null) {
  const users = await prisma.user.findMany({
    where: {
      role: ROLES.SUPPORT,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      isEmailVerified: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });

  return users.map((user) => user.id);
}

async function assertValidSupportAssignee(nextAssignee) {
  if (!nextAssignee) return null;
  const supportUser = await prisma.user.findUnique({
    where: { id: nextAssignee },
    select: { id: true, role: true, accountStatus: true, isEmailVerified: true },
  });
  if (!supportUser || supportUser.role !== ROLES.SUPPORT || supportUser.accountStatus !== ACCOUNT_STATUSES.ACTIVE || !supportUser.isEmailVerified) {
    throw new AppError("Choose an active verified support account.", 422, "SUPPORT_ASSIGNEE_INVALID");
  }
  return supportUser;
}

async function emitTicketUpdated(ticketId, actor) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }, include: ticketInclude });
  if (!ticket) return;

  const requesterPayload = toTicketDetail(ticket, { id: ticket.requesterUserId, role: ROLES.STUDENT });
  emitToUser(ticket.requesterUserId, "support:ticket.updated", requesterPayload);

  const staffIds = await getSupportRecipientIds();
  const staffPayload = toTicketDetail(ticket, actor?.role ? actor : { id: "system", role: ROLES.SUPPORT });
  for (const staffId of staffIds) emitToUser(staffId, "support:ticket.updated", staffPayload);
}

export async function listSupportAgentsService(actor) {
  assertCanManageTickets(actor);
  const users = await prisma.user.findMany({
    where: { role: ROLES.SUPPORT, accountStatus: ACCOUNT_STATUSES.ACTIVE, isEmailVerified: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: supportUserSelect,
  });
  return users.map(toUserSummary);
}

export async function listSupportSavedRepliesService(actor, query = {}) {
  assertCanManageTickets(actor);
  const where = {
    ...(query.includeInactive ? {} : { isActive: true }),
    ...(query.category ? { category: query.category } : {}),
  };
  const items = await prisma.supportSavedReply.findMany({
    where,
    orderBy: [{ usageCount: "desc" }, { title: "asc" }],
    include: { createdBy: { select: supportUserSelect } },
  });
  return items.map(toSavedReplyResponse);
}

export async function createSupportSavedReplyService(actor, payload) {
  assertCanManageTickets(actor);
  const savedReply = await prisma.supportSavedReply.create({
    data: {
      title: normalizeText(payload.title),
      body: normalizeText(payload.body),
      category: payload.category ?? null,
      createdByUserId: actor.id,
    },
    include: { createdBy: { select: supportUserSelect } },
  });
  return toSavedReplyResponse(savedReply);
}

export async function updateSupportSavedReplyService(actor, id, payload) {
  assertCanManageTickets(actor);
  const existing = await prisma.supportSavedReply.findUnique({ where: { id } });
  if (!existing) throw new AppError("Saved reply not found.", 404, "SUPPORT_SAVED_REPLY_NOT_FOUND");

  const data = {};
  if (payload.title !== undefined) data.title = normalizeText(payload.title);
  if (payload.body !== undefined) data.body = normalizeText(payload.body);
  if (Object.prototype.hasOwnProperty.call(payload, "category")) data.category = payload.category ?? null;
  if (payload.isActive !== undefined) data.isActive = payload.isActive;

  const savedReply = await prisma.supportSavedReply.update({
    where: { id },
    data,
    include: { createdBy: { select: supportUserSelect } },
  });
  return toSavedReplyResponse(savedReply);
}

export async function deleteSupportSavedReplyService(actor, id) {
  assertCanManageTickets(actor);
  const existing = await prisma.supportSavedReply.findUnique({ where: { id } });
  if (!existing) throw new AppError("Saved reply not found.", 404, "SUPPORT_SAVED_REPLY_NOT_FOUND");
  await prisma.supportSavedReply.update({ where: { id }, data: { isActive: false } });
  return { id, deleted: true };
}

export async function listSupportTicketsService(actor, query) {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;
  const where = buildListWhere(actor, query);

  const [total, items] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
      include: ticketInclude,
    }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    items: items.map((ticket) => toTicketSummary(ticket, actor)),
  };
}

export async function getSupportSummaryService(actor) {
  const baseWhere = isSupportStaff(actor) ? {} : { requesterUserId: actor.id };
  const now = new Date();
  const dueSoonAt = addHours(now, DUE_SOON_HOURS);
  const today = startOfToday();
  const [
    total,
    open,
    inProgress,
    waitingOnUser,
    resolved,
    closed,
    urgent,
    unassigned,
    assignedToMe,
    overdue,
    dueSoon,
    resolvedToday,
    closedToday,
    firstResponseTickets,
  ] = await Promise.all([
    prisma.supportTicket.count({ where: baseWhere }),
    prisma.supportTicket.count({ where: { ...baseWhere, status: "OPEN" } }),
    prisma.supportTicket.count({ where: { ...baseWhere, status: "IN_PROGRESS" } }),
    prisma.supportTicket.count({ where: { ...baseWhere, status: "WAITING_ON_USER" } }),
    prisma.supportTicket.count({ where: { ...baseWhere, status: "RESOLVED" } }),
    prisma.supportTicket.count({ where: { ...baseWhere, status: "CLOSED" } }),
    prisma.supportTicket.count({ where: { ...baseWhere, priority: "URGENT", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    isSupportStaff(actor) ? prisma.supportTicket.count({ where: { assignedSupportUserId: null, status: { notIn: ["RESOLVED", "CLOSED"] } } }) : 0,
    isSupportStaff(actor) ? prisma.supportTicket.count({ where: { assignedSupportUserId: actor.id, status: { notIn: ["RESOLVED", "CLOSED"] } } }) : 0,
    prisma.supportTicket.count({ where: { ...baseWhere, status: { in: Array.from(SLA_ACTIVE_STATUSES) }, nextResponseDueAt: { lt: now } } }),
    prisma.supportTicket.count({ where: { ...baseWhere, status: { in: Array.from(SLA_ACTIVE_STATUSES) }, nextResponseDueAt: { gte: now, lte: dueSoonAt } } }),
    prisma.supportTicket.count({ where: { ...baseWhere, resolvedAt: { gte: today } } }),
    prisma.supportTicket.count({ where: { ...baseWhere, closedAt: { gte: today } } }),
    prisma.supportTicket.findMany({
      where: { ...baseWhere, firstSupportResponseAt: { not: null } },
      select: { createdAt: true, firstSupportResponseAt: true },
      take: 500,
      orderBy: { firstSupportResponseAt: "desc" },
    }),
  ]);

  const averageFirstResponseMinutes = firstResponseTickets.length
    ? Math.round(
        firstResponseTickets.reduce(
          (totalMinutes, ticket) => totalMinutes + (ticket.firstSupportResponseAt.getTime() - ticket.createdAt.getTime()) / 60000,
          0,
        ) / firstResponseTickets.length,
      )
    : null;

  return {
    total,
    open,
    inProgress,
    waitingOnUser,
    resolved,
    closed,
    urgent,
    unassigned,
    assignedToMe,
    overdue,
    dueSoon,
    resolvedToday,
    closedToday,
    averageFirstResponseMinutes,
  };
}

export async function createSupportTicketService(actor, payload, files = [], options = {}) {
  assertCanCreateRequesterTicket(actor);

  const ticketNumber = makeTicketNumber();
  const now = new Date();
  const description = normalizeText(payload.description);
  const source = options.source ?? "FORM";

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({
      data: {
        ticketNumber,
        requesterUserId: actor.id,
        source,
        subject: normalizeText(payload.subject),
        category: payload.category,
        priority: payload.priority,
        status: "OPEN",
        tags: normalizeTags(payload.tags),
        firstResponseDueAt: getResponseDueAt(payload.priority, now),
        nextResponseDueAt: getResponseDueAt(payload.priority, now),
        lastActivityAt: now,
      },
    });

    const message = await tx.supportTicketMessage.create({
      data: {
        ticketId: created.id,
        authorId: actor.id,
        visibility: "PUBLIC",
        body: description,
      },
    });

    if (files.length) {
      await tx.supportTicketAttachment.createMany({
        data: files.map((file) => mapUploadedFile(file, created.id, message.id, actor.id)),
      });
    }

    await tx.supportTicketActivity.create({
      data: { ticketId: created.id, actorId: actor.id, type: "CREATED", toValue: created.status },
    });

    return tx.supportTicket.findUnique({ where: { id: created.id }, include: ticketInclude });
  });

  const staffIds = await getSupportRecipientIds(actor.id);
  await notifyUsers(
    staffIds,
    {
      type: "SUPPORT_TICKET_CREATED",
      title: `New support ticket ${ticket.ticketNumber}`,
      message: `${fullName(ticket.requester)} opened "${ticket.subject}".`,
      actionUrl: `/dashboard/support?ticket=${ticket.id}`,
    },
    actor.id,
  );
  await emitTicketUpdated(ticket.id, actor);
  return toTicketDetail(ticket, actor);
}

export async function quickChatSupportTicketService(actor, payload) {
  assertCanCreateRequesterTicket(actor);
  const body = normalizeText(payload.content);

  const existing = await prisma.supportTicket.findFirst({
    where: {
      requesterUserId: actor.id,
      source: "CHAT",
    },
    orderBy: { lastActivityAt: "desc" },
    include: ticketInclude,
  });

  if (existing) {
    if (CLOSED_STATUSES.has(existing.status)) {
      return reopenSupportTicketService(actor, existing.id, {
        body: body || "I need help from support.",
      });
    }

    if (body) {
      return addSupportTicketMessageService(actor, existing.id, {
        body,
        visibility: "PUBLIC",
      });
    }

    return toTicketDetail(existing, actor);
  }

  return createSupportTicketService(
    actor,
    {
      subject: payload.subject,
      description: body || "I need help from support.",
      category: payload.category,
      priority: payload.priority,
    },
    [],
    { source: "CHAT" },
  );
}

export async function getSupportTicketService(actor, id) {
  const ticket = await findTicketOrThrow(actor, id);
  return toTicketDetail(ticket, actor);
}

export async function addSupportTicketMessageService(actor, id, payload, files = []) {
  const ticket = await findTicketOrThrow(actor, id);
  const visibility = payload.visibility ?? "PUBLIC";
  const body = normalizeText(payload.body);

  if (visibility === "INTERNAL") assertCanManageTickets(actor);
  if (payload.savedReplyId) assertCanManageTickets(actor);
  if (!body && !files.length) {
    throw new AppError("Add a message or attach a file before sending.", 422, "SUPPORT_MESSAGE_EMPTY");
  }
  if (!isSupportStaff(actor) && CLOSED_STATUSES.has(ticket.status)) {
    throw new AppError("Reopen this ticket before adding another reply.", 409, "SUPPORT_TICKET_CLOSED");
  }

  const nextStatus =
    visibility === "INTERNAL"
      ? ticket.status
      : isSupportStaff(actor)
        ? CLOSED_STATUSES.has(ticket.status)
          ? ticket.status
          : "WAITING_ON_USER"
        : ticket.status === "WAITING_ON_USER"
          ? "IN_PROGRESS"
          : ticket.status;
  const now = new Date();
  const nextSlaData =
    visibility === "INTERNAL"
      ? {}
      : isSupportStaff(actor)
        ? {
            ...(ticket.firstSupportResponseAt ? {} : { firstSupportResponseAt: now }),
            nextResponseDueAt: null,
          }
        : nextSlaFieldsFor({ status: nextStatus, priority: ticket.priority, firstSupportResponseAt: ticket.firstSupportResponseAt }, now);

  const updated = await prisma.$transaction(async (tx) => {
    const message = await tx.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: actor.id,
        visibility,
        body: body || (files.length ? "Attached file." : ""),
      },
    });

    if (files.length) {
      await tx.supportTicketAttachment.createMany({
        data: files.map((file) => mapUploadedFile(file, ticket.id, message.id, actor.id)),
      });
    }

    if (payload.savedReplyId) {
      await tx.supportSavedReply.updateMany({
        where: { id: payload.savedReplyId, isActive: true },
        data: { usageCount: { increment: 1 } },
      });
    }

    await tx.supportTicketActivity.create({
      data: {
        ticketId: ticket.id,
        actorId: actor.id,
        type: visibility === "INTERNAL" ? "INTERNAL_NOTE_ADDED" : "MESSAGE_ADDED",
      },
    });

    if (nextStatus !== ticket.status) {
      await tx.supportTicketActivity.create({
        data: { ticketId: ticket.id, actorId: actor.id, type: "STATUS_CHANGED", fromValue: ticket.status, toValue: nextStatus },
      });
    }

    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
        ...nextSlaData,
        lastActivityAt: now,
        ...(nextStatus === "RESOLVED" ? { resolvedAt: now } : {}),
        ...(nextStatus === "CLOSED" ? { closedAt: now } : {}),
      },
    });

    return tx.supportTicket.findUnique({ where: { id: ticket.id }, include: ticketInclude });
  });

  if (visibility === "PUBLIC") {
    if (isSupportStaff(actor)) {
      const actorProfile = await getActorProfile(actor);
      await notify({
        userId: ticket.requesterUserId,
        type: "SUPPORT_TICKET_REPLY",
        title: `Support replied to ${ticket.ticketNumber}`,
        message: `${fullName(actorProfile)} replied to "${ticket.subject}".`,
        actionUrl: `/dashboard/support?ticket=${ticket.id}`,
      });
    } else {
      const recipientIds = ticket.assignedSupportUserId ? [ticket.assignedSupportUserId] : await getSupportRecipientIds(actor.id);
      await notifyUsers(
        recipientIds,
        {
          type: "SUPPORT_TICKET_REPLY",
          title: `New reply on ${ticket.ticketNumber}`,
          message: `${fullName(ticket.requester)} replied to "${ticket.subject}".`,
          actionUrl: `/dashboard/support?ticket=${ticket.id}`,
        },
        actor.id,
      );
    }
  }

  await emitTicketUpdated(ticket.id, actor);
  return toTicketDetail(updated, actor);
}

export async function updateSupportTicketService(actor, id, payload) {
  assertCanManageTickets(actor);
  const ticket = await findTicketOrThrow(actor, id);
  const data = {};
  const activities = [];
  const now = new Date();

  if (payload.status !== undefined && payload.status !== ticket.status) {
    data.status = payload.status;
    data.resolvedAt = payload.status === "RESOLVED" ? now : payload.status === "CLOSED" ? (ticket.resolvedAt ?? now) : null;
    data.closedAt = payload.status === "CLOSED" ? now : null;
    activities.push({ type: "STATUS_CHANGED", fromValue: ticket.status, toValue: payload.status });
  }

  if (payload.priority !== undefined && payload.priority !== ticket.priority) {
    data.priority = payload.priority;
    activities.push({ type: "PRIORITY_CHANGED", fromValue: ticket.priority, toValue: payload.priority });
  }

  if (payload.category !== undefined && payload.category !== ticket.category) {
    data.category = payload.category;
    activities.push({ type: "CATEGORY_CHANGED", fromValue: ticket.category, toValue: payload.category });
  }

  if (Object.prototype.hasOwnProperty.call(payload, "assignedSupportUserId")) {
    const nextAssignee = payload.assignedSupportUserId || null;
    await assertValidSupportAssignee(nextAssignee);
    if (nextAssignee !== ticket.assignedSupportUserId) {
      data.assignedSupportUserId = nextAssignee;
      activities.push({ type: "ASSIGNED", fromValue: ticket.assignedSupportUserId ?? null, toValue: nextAssignee });
    }
  }

  if (payload.tags !== undefined) {
    const nextTags = normalizeTags(payload.tags);
    if (JSON.stringify(nextTags) !== JSON.stringify(ticket.tags ?? [])) {
      data.tags = nextTags;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "snoozedUntil")) {
    const nextSnooze = payload.snoozedUntil ? new Date(payload.snoozedUntil) : null;
    const currentSnooze = ticket.snoozedUntil ? ticket.snoozedUntil.getTime() : null;
    const nextSnoozeTime = nextSnooze ? nextSnooze.getTime() : null;
    if (currentSnooze !== nextSnoozeTime) {
      data.snoozedUntil = nextSnooze;
    }
  }

  if (data.status !== undefined || data.priority !== undefined) {
    const nextStatus = data.status ?? ticket.status;
    const nextPriority = data.priority ?? ticket.priority;
    Object.assign(
      data,
      SLA_ACTIVE_STATUSES.has(nextStatus)
        ? nextSlaFieldsFor({ status: nextStatus, priority: nextPriority, firstSupportResponseAt: ticket.firstSupportResponseAt }, now)
        : { nextResponseDueAt: null },
    );
  }

  if (Object.keys(data).length === 0) return toTicketDetail(ticket, actor);
  data.lastActivityAt = now;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.supportTicket.update({ where: { id: ticket.id }, data });
    if (activities.length) {
      await tx.supportTicketActivity.createMany({
        data: activities.map((activity) => ({ ticketId: ticket.id, actorId: actor.id, ...activity })),
      });
    }
    return tx.supportTicket.findUnique({ where: { id: ticket.id }, include: ticketInclude });
  });

  if (payload.status !== undefined && payload.status !== ticket.status) {
    await notify({
      userId: ticket.requesterUserId,
      type: "SUPPORT_TICKET_STATUS_CHANGED",
      title: `${ticket.ticketNumber} is now ${payload.status.replaceAll("_", " ").toLowerCase()}`,
      message: `Support updated "${ticket.subject}".`,
      actionUrl: `/dashboard/support?ticket=${ticket.id}`,
    });
  }

  if (Object.prototype.hasOwnProperty.call(data, "assignedSupportUserId") && data.assignedSupportUserId) {
    await notify({
      userId: data.assignedSupportUserId,
      type: "SUPPORT_TICKET_ASSIGNED",
      title: `${ticket.ticketNumber} assigned to you`,
      message: `You are now responsible for "${ticket.subject}".`,
      actionUrl: `/dashboard/support?ticket=${ticket.id}`,
    });
  }

  await emitTicketUpdated(ticket.id, actor);
  return toTicketDetail(updated, actor);
}

export async function bulkUpdateSupportTicketsService(actor, payload) {
  assertCanManageTickets(actor);
  const ticketIds = Array.from(new Set(payload.ticketIds));
  if (Object.prototype.hasOwnProperty.call(payload, "assignedSupportUserId")) {
    await assertValidSupportAssignee(payload.assignedSupportUserId || null);
  }

  const patch = {
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
    ...(payload.category !== undefined ? { category: payload.category } : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, "assignedSupportUserId")
      ? { assignedSupportUserId: payload.assignedSupportUserId || null }
      : {}),
    ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, "snoozedUntil") ? { snoozedUntil: payload.snoozedUntil } : {}),
  };

  const tickets = [];
  for (const ticketId of ticketIds) {
    tickets.push(await updateSupportTicketService(actor, ticketId, patch));
  }

  return {
    updatedCount: tickets.length,
    tickets,
  };
}

export async function reopenSupportTicketService(actor, id, payload = {}) {
  const ticket = await findTicketOrThrow(actor, id);
  const canReopen = isSupportStaff(actor) || ticket.requesterUserId === actor.id;
  if (!canReopen) throw new AppError("You are not allowed to reopen this ticket.", 403, "SUPPORT_TICKET_FORBIDDEN");
  if (!CLOSED_STATUSES.has(ticket.status)) return toTicketDetail(ticket, actor);

  const body = normalizeText(payload.body);
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: "OPEN",
        resolvedAt: null,
        closedAt: null,
        snoozedUntil: null,
        ...nextSlaFieldsFor({ status: "OPEN", priority: ticket.priority, firstSupportResponseAt: ticket.firstSupportResponseAt }, now),
        lastActivityAt: now,
      },
    });
    await tx.supportTicketActivity.create({
      data: { ticketId: ticket.id, actorId: actor.id, type: "REOPENED", fromValue: ticket.status, toValue: "OPEN" },
    });
    if (body) {
      await tx.supportTicketMessage.create({
        data: { ticketId: ticket.id, authorId: actor.id, visibility: "PUBLIC", body },
      });
    }
    return tx.supportTicket.findUnique({ where: { id: ticket.id }, include: ticketInclude });
  });

  const recipientIds = isSupportStaff(actor)
    ? [ticket.requesterUserId]
    : ticket.assignedSupportUserId
      ? [ticket.assignedSupportUserId]
      : await getSupportRecipientIds(actor.id);
  const actorProfile = await getActorProfile(actor);
  await notifyUsers(
    recipientIds,
    {
      type: "SUPPORT_TICKET_STATUS_CHANGED",
      title: `${ticket.ticketNumber} reopened`,
      message: `${fullName(actorProfile)} reopened "${ticket.subject}".`,
      actionUrl: `/dashboard/support?ticket=${ticket.id}`,
    },
    actor.id,
  );

  await emitTicketUpdated(ticket.id, actor);
  return toTicketDetail(updated, actor);
}
