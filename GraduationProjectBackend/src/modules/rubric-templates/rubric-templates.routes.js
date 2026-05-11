import { Router } from "express";
import { z } from "zod";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { prisma } from "../../loaders/dbLoader.js";
import { AppError } from "../../common/errors/AppError.js";
import { ROLES } from "../../common/constants/roles.js";

const router = Router();
router.use(auth);

const rubricItem = z.object({
  name: z.string().trim().min(1).max(120),
  score: z.coerce.number().min(0).max(100),
  maxScore: z.coerce.number().min(1).max(100),
});

const deliverableTypeSchema = z.enum([
  "SRS", "UML", "PROTOTYPE", "CODE", "TEST_PLAN", "FINAL_REPORT", "PRESENTATION",
]);

const listSchema = z.object({
  params: z.object({}).optional().default({}),
  query:  z.object({ teamId: z.string().trim().min(1) }),
  body:   z.object({}).optional().default({}),
});

const upsertSchema = z.object({
  params: z.object({}).optional().default({}),
  query:  z.object({}).optional().default({}),
  body: z.object({
    teamId: z.string().trim().min(1),
    deliverableType: deliverableTypeSchema,
    rubric: z.array(rubricItem).min(1).max(15),
  }),
});

const idSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query:  z.object({}).optional().default({}),
  body:   z.object({}).optional().default({}),
});

async function assertSupervisor(actor, teamId) {
  if (actor.role === ROLES.ADMIN) return;
  if (actor.role !== ROLES.DOCTOR && actor.role !== ROLES.TA) {
    throw new AppError("Only supervisors can manage rubric templates.", 403, "RUBRIC_FORBIDDEN");
  }
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { doctorId: true, taId: true },
  });
  if (!team) throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
  if (team.doctorId !== actor.id && team.taId !== actor.id) {
    throw new AppError("You're not a supervisor for this team.", 403, "RUBRIC_FORBIDDEN");
  }
}

// LIST templates for a team (visible to anyone with team access)
router.get("/", validate(listSchema), async (req, res, next) => {
  try {
    const rows = await prisma.teamRubricTemplate.findMany({
      where: { teamId: req.validated.query.teamId },
      orderBy: { deliverableType: "asc" },
    });
    res.json({ ok: true, data: rows });
  } catch (err) { next(err); }
});

// UPSERT a template (supervisor)
router.post(
  "/",
  allowRoles(ROLES.DOCTOR, ROLES.TA, ROLES.ADMIN),
  validate(upsertSchema),
  async (req, res, next) => {
    try {
      const { teamId, deliverableType, rubric } = req.validated.body;
      await assertSupervisor(req.user, teamId);

      const existing = await prisma.teamRubricTemplate.findUnique({
        where: { teamId_deliverableType: { teamId, deliverableType } },
        select: { id: true },
      });

      const data = {
        teamId,
        deliverableType,
        rubric,
        createdByUserId: req.user.id,
      };

      const result = existing
        ? await prisma.teamRubricTemplate.update({
            where: { id: existing.id },
            data,
          })
        : await prisma.teamRubricTemplate.create({ data });

      res.status(existing ? 200 : 201).json({ ok: true, data: result });
    } catch (err) { next(err); }
  },
);

// DELETE a template (supervisor)
router.delete(
  "/:id",
  allowRoles(ROLES.DOCTOR, ROLES.TA, ROLES.ADMIN),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const tpl = await prisma.teamRubricTemplate.findUnique({ where: { id: req.validated.params.id } });
      if (!tpl) return next(new AppError("Template not found", 404));
      await assertSupervisor(req.user, tpl.teamId);
      await prisma.teamRubricTemplate.delete({ where: { id: req.validated.params.id } });
      res.json({ ok: true, data: { ok: true } });
    } catch (err) { next(err); }
  },
);

export default router;
