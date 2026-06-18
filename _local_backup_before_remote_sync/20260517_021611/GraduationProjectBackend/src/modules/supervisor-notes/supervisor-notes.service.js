import { prisma } from "../../loaders/dbLoader.js";
import { AppError } from "../../common/errors/AppError.js";
import { ROLES } from "../../common/constants/roles.js";

const noteSelect = {
  id: true,
  teamId: true,
  authorUserId: true,
  authorRole: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
};

function fullName(u) {
  return `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim();
}

function shape(note) {
  if (!note) return null;
  return {
    ...note,
    author: note.author ? { ...note.author, fullName: fullName(note.author) } : null,
  };
}

/**
 * Only the team's Doctor, TA, or an Admin can see/manage notes for a team.
 * Throws 403 if not authorized.
 */
async function assertSupervisorForTeam(actor, teamId) {
  if (actor.role === ROLES.ADMIN) return;
  if (actor.role !== ROLES.DOCTOR && actor.role !== ROLES.TA) {
    throw new AppError("Only supervisors can manage notes.", 403, "NOTES_FORBIDDEN");
  }
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { doctorId: true, taId: true },
  });
  if (!team) throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
  if (team.doctorId !== actor.id && team.taId !== actor.id) {
    throw new AppError("You're not a supervisor for this team.", 403, "NOTES_FORBIDDEN");
  }
}

export async function listNotesService(actor, teamId) {
  await assertSupervisorForTeam(actor, teamId);
  const notes = await prisma.teamSupervisorNote.findMany({
    where: { teamId },
    select: noteSelect,
    orderBy: { createdAt: "desc" },
  });
  return notes.map(shape);
}

export async function createNoteService(actor, teamId, { content }) {
  await assertSupervisorForTeam(actor, teamId);
  if (!content || content.trim().length < 1) {
    throw new AppError("Note content cannot be empty.", 422, "NOTE_EMPTY");
  }
  const created = await prisma.teamSupervisorNote.create({
    data: {
      teamId,
      authorUserId: actor.id,
      authorRole: actor.role,
      content: content.trim(),
    },
    select: noteSelect,
  });
  return shape(created);
}

export async function updateNoteService(actor, id, { content }) {
  const note = await prisma.teamSupervisorNote.findUnique({ where: { id }, select: noteSelect });
  if (!note) throw new AppError("Note not found.", 404, "NOTE_NOT_FOUND");
  if (actor.role !== ROLES.ADMIN && note.authorUserId !== actor.id) {
    throw new AppError("You can only edit your own notes.", 403, "NOTE_EDIT_FORBIDDEN");
  }
  if (!content || content.trim().length < 1) {
    throw new AppError("Note content cannot be empty.", 422, "NOTE_EMPTY");
  }
  const updated = await prisma.teamSupervisorNote.update({
    where: { id },
    data: { content: content.trim() },
    select: noteSelect,
  });
  return shape(updated);
}

export async function deleteNoteService(actor, id) {
  const note = await prisma.teamSupervisorNote.findUnique({ where: { id } });
  if (!note) throw new AppError("Note not found.", 404, "NOTE_NOT_FOUND");
  if (actor.role !== ROLES.ADMIN && note.authorUserId !== actor.id) {
    throw new AppError("You can only delete your own notes.", 403, "NOTE_DELETE_FORBIDDEN");
  }
  await prisma.teamSupervisorNote.delete({ where: { id } });
  return { ok: true };
}
