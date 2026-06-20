import { Router } from "express";
import { z } from "zod";
import { auth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { prisma } from "../../loaders/dbLoader.js";
import { AppError } from "../../common/errors/AppError.js";
import { ROLES } from "../../common/constants/roles.js";
import { notify } from "../../common/utils/notify.js";

const router = Router();
router.use(auth);

const userSel = {
  id: true, firstName: true, lastName: true, role: true, avatarUrl: true,
};

function fullName(u) {
  return `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim();
}
function shape(c) {
  if (!c) return null;
  return { ...c, author: c.author ? { ...c.author, fullName: fullName(c.author) } : null };
}

/**
 * Visibility:
 *   - team members + leader can see/post on their team's submissions
 *   - team's doctor + TA can see/post
 *   - admin sees all
 */
async function canAccessSubmission(submissionId, actor) {
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      teamId: true,
      team: {
        select: {
          leaderId: true, doctorId: true, taId: true,
          members: { select: { userId: true } },
        },
      },
    },
  });
  if (!sub) return { ok: false, code: 404 };
  if (actor.role === ROLES.ADMIN) return { ok: true, teamId: sub.teamId };
  const allowed =
    sub.team.leaderId === actor.id ||
    sub.team.doctorId === actor.id ||
    sub.team.taId === actor.id ||
    sub.team.members.some((m) => m.userId === actor.id);
  return { ok: allowed, teamId: sub.teamId, team: sub.team };
}

const listSchema = z.object({
  params: z.object({}).optional().default({}),
  query:  z.object({ submissionId: z.string().trim().min(1) }),
  body:   z.object({}).optional().default({}),
});

const createSchema = z.object({
  params: z.object({}).optional().default({}),
  query:  z.object({}).optional().default({}),
  body: z.object({
    submissionId: z.string().trim().min(1),
    content: z.string().trim().min(1).max(2000),
  }),
});

const idSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query:  z.object({}).optional().default({}),
  body:   z.object({}).optional().default({}),
});

router.get("/", validate(listSchema), async (req, res, next) => {
  try {
    const access = await canAccessSubmission(req.validated.query.submissionId, req.user);
    if (!access.ok) {
      return next(new AppError(access.code === 404 ? "Submission not found" : "Forbidden", access.code ?? 403));
    }
    const rows = await prisma.submissionComment.findMany({
      where: { submissionId: req.validated.query.submissionId },
      select: {
        id: true, submissionId: true, authorUserId: true, authorRole: true,
        content: true, createdAt: true, updatedAt: true,
        author: { select: userSel },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json({ ok: true, data: rows.map(shape) });
  } catch (err) { next(err); }
});

router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const { submissionId, content } = req.validated.body;
    const access = await canAccessSubmission(submissionId, req.user);
    if (!access.ok) {
      return next(new AppError(access.code === 404 ? "Submission not found" : "Forbidden", access.code ?? 403));
    }
    const created = await prisma.submissionComment.create({
      data: {
        submissionId,
        authorUserId: req.user.id,
        authorRole: req.user.role,
        content,
      },
      select: {
        id: true, submissionId: true, authorUserId: true, authorRole: true,
        content: true, createdAt: true, updatedAt: true,
        author: { select: userSel },
      },
    });

    // Notify everyone else who has access to this submission
    const teamInfo = access.team;
    if (teamInfo) {
      const targetIds = new Set([
        teamInfo.leaderId,
        teamInfo.doctorId,
        teamInfo.taId,
        ...teamInfo.members.map((m) => m.userId),
      ]);
      targetIds.delete(req.user.id);
      targetIds.delete(null);
      targetIds.delete(undefined);
      const preview = content.length > 120 ? content.slice(0, 120) + "…" : content;
      await Promise.all(
        Array.from(targetIds).filter(Boolean).map((uid) =>
          notify({
            userId: uid,
            type: "SUBMISSION_FEEDBACK",
            title: "New Submission Comment",
            message: `${fullName(req.user)} commented: ${preview}`,
            actionUrl: "/dashboard/submissions",
          }),
        ),
      );
    }

    res.status(201).json({ ok: true, data: shape(created) });
  } catch (err) { next(err); }
});

router.delete("/:id", validate(idSchema), async (req, res, next) => {
  try {
    const existing = await prisma.submissionComment.findUnique({ where: { id: req.validated.params.id } });
    if (!existing) return next(new AppError("Comment not found", 404));
    if (req.user.role !== ROLES.ADMIN && existing.authorUserId !== req.user.id) {
      return next(new AppError("You can only delete your own comments", 403));
    }
    await prisma.submissionComment.delete({ where: { id: req.validated.params.id } });
    res.json({ ok: true, data: { ok: true } });
  } catch (err) { next(err); }
});

export default router;
