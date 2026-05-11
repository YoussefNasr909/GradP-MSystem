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

export async function createAnnouncementService(actor, { title, content, teamId, pinned }) {
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
  const supervisedIds = teamId ? [teamId] : await getSupervisedTeamIds(actor);

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

export async function deleteAnnouncementService(actor, id) {
  const ann = await prisma.announcement.findUnique({ where: { id } });
  if (!ann) throw new AppError("Announcement not found.", 404, "ANNOUNCEMENT_NOT_FOUND");
  if (actor.role !== ROLES.ADMIN && ann.authorUserId !== actor.id) {
    throw new AppError("You can only delete your own announcements.", 403, "ANNOUNCEMENT_DELETE_FORBIDDEN");
  }
  await prisma.announcement.delete({ where: { id } });
  return { ok: true };
}
