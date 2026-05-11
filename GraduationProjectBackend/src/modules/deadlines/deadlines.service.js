import { prisma } from "../../loaders/dbLoader.js";
import { AppError } from "../../common/errors/AppError.js";
import { ROLES } from "../../common/constants/roles.js";
import { notify } from "../../common/utils/notify.js";
import { findTeamByLeaderId, findTeamMemberByUserId } from "../teams/teams.repository.js";

const deadlineSelect = {
  id: true,
  teamId: true,
  deliverableType: true,
  dueDate: true,
  setByUserId: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  setBy: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
  team:  { select: { id: true, name: true, leaderId: true, doctorId: true, taId: true } },
};

function fullName(u) {
  return `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim();
}
function shape(d) {
  if (!d) return null;
  return { ...d, setBy: d.setBy ? { ...d.setBy, fullName: fullName(d.setBy) } : null };
}

async function resolveVisibleTeamIds(actor) {
  if (actor.role === ROLES.ADMIN) return null;
  if (actor.role === ROLES.DOCTOR) {
    const ts = await prisma.team.findMany({ where: { doctorId: actor.id }, select: { id: true } });
    return ts.map((t) => t.id);
  }
  if (actor.role === ROLES.TA) {
    const ts = await prisma.team.findMany({ where: { taId: actor.id }, select: { id: true } });
    return ts.map((t) => t.id);
  }
  if (actor.role === ROLES.LEADER) {
    const t = await findTeamByLeaderId(actor.id);
    return t ? [t.id] : [];
  }
  if (actor.role === ROLES.STUDENT) {
    const m = await findTeamMemberByUserId(actor.id);
    return m?.team?.id ? [m.team.id] : [];
  }
  return [];
}

async function assertCanWrite(actor, teamId) {
  if (actor.role === ROLES.ADMIN) return;
  if (actor.role !== ROLES.DOCTOR && actor.role !== ROLES.TA) {
    throw new AppError("Only supervisors can set deadlines.", 403, "DEADLINE_FORBIDDEN");
  }
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { doctorId: true, taId: true } });
  if (!team) throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
  if (team.doctorId !== actor.id && team.taId !== actor.id) {
    throw new AppError("You're not a supervisor for this team.", 403, "DEADLINE_FORBIDDEN");
  }
}

export async function listDeadlinesService(actor, { teamId, upcoming } = {}) {
  let visibleIds = await resolveVisibleTeamIds(actor);
  if (visibleIds !== null && visibleIds.length === 0) return [];

  if (teamId) {
    if (visibleIds !== null && !visibleIds.includes(teamId)) {
      throw new AppError("You cannot view this team's deadlines.", 403, "DEADLINE_FORBIDDEN");
    }
    visibleIds = [teamId];
  }

  const where = {
    ...(visibleIds ? { teamId: { in: visibleIds } } : {}),
    ...(upcoming ? { dueDate: { gte: new Date() } } : {}),
  };

  const rows = await prisma.teamDeliverableDeadline.findMany({
    where,
    select: deadlineSelect,
    orderBy: { dueDate: "asc" },
  });
  return rows.map(shape);
}

export async function upsertDeadlineService(actor, { teamId, deliverableType, dueDate, note }) {
  await assertCanWrite(actor, teamId);

  const parsedDate = new Date(dueDate);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError("Invalid due date.", 422, "DEADLINE_INVALID_DATE");
  }

  const existed = await prisma.teamDeliverableDeadline.findUnique({
    where: { teamId_deliverableType: { teamId, deliverableType } },
    select: { id: true },
  });

  const data = {
    teamId,
    deliverableType,
    dueDate: parsedDate,
    setByUserId: actor.id,
    note: note ?? null,
  };

  const result = existed
    ? await prisma.teamDeliverableDeadline.update({
        where: { id: existed.id },
        data,
        select: deadlineSelect,
      })
    : await prisma.teamDeliverableDeadline.create({ data, select: deadlineSelect });

  // Notify the team leader (and members) about the new/updated deadline
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { leaderId: true, members: { select: { userId: true } } },
  });
  if (team) {
    const userIds = [team.leaderId, ...team.members.map((m) => m.userId)];
    const dateLabel = parsedDate.toLocaleDateString();
    const verb = existed ? "updated" : "set";
    await Promise.all(
      userIds.map((userId) =>
        notify({
          userId,
          type: "SUBMISSION_FEEDBACK",
          title: `Deadline ${verb}: ${deliverableType}`,
          message: `${fullName(actor)} ${verb} the deadline for ${deliverableType} to ${dateLabel}.`,
          actionUrl: "/dashboard/submissions",
        }),
      ),
    );
  }

  return shape(result);
}

export async function deleteDeadlineService(actor, id) {
  const d = await prisma.teamDeliverableDeadline.findUnique({ where: { id }, select: { teamId: true } });
  if (!d) throw new AppError("Deadline not found.", 404, "DEADLINE_NOT_FOUND");
  await assertCanWrite(actor, d.teamId);
  await prisma.teamDeliverableDeadline.delete({ where: { id } });
  return { ok: true };
}
