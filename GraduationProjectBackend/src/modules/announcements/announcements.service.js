import { prisma } from "../../loaders/dbLoader.js";
import { AppError } from "../../common/errors/AppError.js";
import { ROLES } from "../../common/constants/roles.js";
import { notify } from "../../common/utils/notify.js";
import { findTeamByLeaderId, findTeamMemberByUserId } from "../teams/teams.repository.js";

const select = {
  id: true,
  authorUserId: true,
  authorRole: true,
  teamId: true,
  title: true,
  content: true,
  pinned: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
  team:   { select: { id: true, name: true } },
};

function fullName(u) {
  return `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim();
}
function shape(a) {
  if (!a) return null;
  return { ...a, author: a.author ? { ...a.author, fullName: fullName(a.author) } : null };
}

async function getSupervisedTeamIds(actor) {
  if (actor.role === ROLES.DOCTOR) {
    const ts = await prisma.team.findMany({ where: { doctorId: actor.id }, select: { id: true } });
    return ts.map((t) => t.id);
  }
  if (actor.role === ROLES.TA) {
    const ts = await prisma.team.findMany({ where: { taId: actor.id }, select: { id: true } });
    return ts.map((t) => t.id);
  }
  return [];
}

async function getActorTeamId(actor) {
  if (actor.role === ROLES.LEADER) {
    const t = await findTeamByLeaderId(actor.id);
    return t?.id ?? null;
  }
  if (actor.role === ROLES.STUDENT) {
    const m = await findTeamMemberByUserId(actor.id);
    return m?.team?.id ?? null;
  }
  return null;
}

export async function listAnnouncementsService(actor) {
  if (actor.role === ROLES.ADMIN) {
    const rows = await prisma.announcement.findMany({
      select,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(shape);
  }

  // Supervisors see all announcements they authored
  if (actor.role === ROLES.DOCTOR || actor.role === ROLES.TA) {
    const rows = await prisma.announcement.findMany({
      where: { authorUserId: actor.id },
      select,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(shape);
  }

  // Students see announcements targeting their team (or broadcasts from their supervisors)
  const teamId = await getActorTeamId(actor);
  if (!teamId) return [];

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { doctorId: true, taId: true },
  });
  const supervisorIds = [team?.doctorId, team?.taId].filter(Boolean);

  const rows = await prisma.announcement.findMany({
    where: {
      OR: [
        { teamId },
        { teamId: null, authorUserId: { in: supervisorIds } },
      ],
    },
    select,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(shape);
}

/**
 * Resolve an "audience" filter to a concrete list of supervised team IDs.
 * audience: "all" | "byStage" | "overdue" | "needsProposalApproval"
 */
async function resolveAudienceTeamIds(actor, audience, audienceParam) {
  const supervisedIds = await getSupervisedTeamIds(actor);
  if (supervisedIds.length === 0) return [];

  if (!audience || audience === "all") return supervisedIds;

  if (audience === "byStage") {
    if (!audienceParam) return supervisedIds;
    const matched = await prisma.team.findMany({
      where: { id: { in: supervisedIds }, stage: audienceParam },
      select: { id: true },
    });
    return matched.map((t) => t.id);
  }

  if (audience === "overdue") {
    // Teams with at least one TeamDeliverableDeadline in the past
    const overdueDeadlines = await prisma.teamDeliverableDeadline.findMany({
      where: { teamId: { in: supervisedIds }, dueDate: { lt: new Date() } },
      select: { teamId: true },
    });
    return Array.from(new Set(overdueDeadlines.map((d) => d.teamId)));
  }

  if (audience === "needsProposalApproval") {
    // Teams whose proposal isn't APPROVED yet
    const props = await prisma.proposal.findMany({
      where: { teamId: { in: supervisedIds }, status: { not: "APPROVED" } },
      select: { teamId: true },
    });
    // Also include teams with NO proposal at all
    const haveProposalIds = new Set(props.map((p) => p.teamId));
    const teamsWithoutProposal = supervisedIds.filter((id) => !haveProposalIds.has(id));
    const allProps = await prisma.proposal.findMany({
      where: { teamId: { in: supervisedIds } },
      select: { teamId: true },
    });
    const everSeen = new Set(allProps.map((p) => p.teamId));
    const noProposal = supervisedIds.filter((id) => !everSeen.has(id));
    return Array.from(new Set([...props.map((p) => p.teamId), ...noProposal]));
  }

  return supervisedIds;
}

export async function createAnnouncementService(actor, { title, content, teamId, pinned, audience, audienceParam }) {
  if (actor.role !== ROLES.DOCTOR && actor.role !== ROLES.TA && actor.role !== ROLES.ADMIN) {
    throw new AppError("Only supervisors can post announcements.", 403, "ANNOUNCEMENT_FORBIDDEN");
  }

  // If targeting a specific team, the supervisor must actually supervise it
  if (teamId && actor.role !== ROLES.ADMIN) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { doctorId: true, taId: true },
    });
    if (!team) throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
    if (team.doctorId !== actor.id && team.taId !== actor.id) {
      throw new AppError("You're not a supervisor for this team.", 403, "ANNOUNCEMENT_FORBIDDEN");
    }
  }

  const created = await prisma.announcement.create({
    data: {
      authorUserId: actor.id,
      authorRole: actor.role,
      teamId: teamId ?? null,
      title: title.trim(),
      content: content.trim(),
      pinned: Boolean(pinned),
    },
    select,
  });

  // Determine target teams for notifications
  let supervisedIds;
  if (teamId) {
    supervisedIds = [teamId];
  } else if (audience && audience !== "all") {
    supervisedIds = await resolveAudienceTeamIds(actor, audience, audienceParam);
  } else {
    supervisedIds = await getSupervisedTeamIds(actor);
  }

  if (supervisedIds.length > 0) {
    const teams = await prisma.team.findMany({
      where: { id: { in: supervisedIds } },
      select: { id: true, leaderId: true, members: { select: { userId: true } } },
    });
    const userIds = new Set();
    for (const t of teams) {
      userIds.add(t.leaderId);
      t.members.forEach((m) => userIds.add(m.userId));
    }
    await Promise.all(
      Array.from(userIds).map((userId) =>
        notify({
          userId,
          type: "SYSTEM",
          title: `Announcement: ${created.title}`,
          message: created.content.length > 200 ? created.content.slice(0, 200) + "…" : created.content,
          actionUrl: "/dashboard/announcements",
        }),
      ),
    );
  }

  return shape(created);
}

export async function updateAnnouncementService(actor, id, { title, content, pinned }) {
  const ann = await prisma.announcement.findUnique({ where: { id } });
  if (!ann) throw new AppError("Announcement not found.", 404, "ANNOUNCEMENT_NOT_FOUND");
  if (actor.role !== ROLES.ADMIN && ann.authorUserId !== actor.id) {
    throw new AppError("You can only edit your own announcements.", 403, "ANNOUNCEMENT_EDIT_FORBIDDEN");
  }
  const updated = await prisma.announcement.update({
    where: { id },
    data: {
      ...(title !== undefined  ? { title:   title.trim() }   : {}),
      ...(content !== undefined ? { content: content.trim() } : {}),
      ...(pinned !== undefined ? { pinned: Boolean(pinned) } : {}),
    },
    select,
  });
  return shape(updated);
}

/**
 * Returns the team objects (id + name + stage) that would be targeted by an
 * announcement with the given audience filter. Used to preview "who will see this"
 * in the create dialog.
 */
export async function previewAudienceService(actor, { audience, audienceParam }) {
  if (actor.role !== ROLES.DOCTOR && actor.role !== ROLES.TA && actor.role !== ROLES.ADMIN) {
    return [];
  }
  const ids = await resolveAudienceTeamIds(actor, audience, audienceParam);
  if (ids.length === 0) return [];
  return prisma.team.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, stage: true },
    orderBy: { name: "asc" },
  });
}

export async function deleteAnnouncementService(actor, id) {
  const ann = await prisma.announcement.findUnique({ where: { id } });
  if (!ann) throw new AppError("Announcement not found.", 404, "ANNOUNCEMENT_NOT_FOUND");
  if (actor.role !== ROLES.ADMIN && ann.authorUserId !== actor.id) {
    throw new AppError("You can only delete your own announcements.", 403, "ANNOUNCEMENT_DELETE_FORBIDDEN");
  }
  await prisma.announcement.delete({ where: { id } });
  return { ok: true };
}
