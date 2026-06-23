import { Router } from "express";
import { z } from "zod";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { ROLES } from "../../common/constants/roles.js";
import {
  listDeadlinesService,
  upsertDeadlineService,
  deleteDeadlineService,
} from "./deadlines.service.js";

const deliverableTypeSchema = z.enum([
  "SRS", "UML", "PROTOTYPE", "CODE", "TEST_PLAN", "FINAL_REPORT", "PRESENTATION",
]);

const listSchema = z.object({
  params: z.object({}).optional().default({}),
  query:  z.object({
    teamId: z.string().trim().min(1).optional(),
    upcoming: z.enum(["true", "false"]).optional(),
  }),
  body: z.object({}).optional().default({}),
});

const upsertSchema = z.object({
  params: z.object({}).optional().default({}),
  query:  z.object({}).optional().default({}),
  body: z.object({
    teamId: z.string().trim().min(1),
    deliverableType: deliverableTypeSchema,
    dueDate: z.string().trim().min(1),
    note: z.string().trim().max(500).optional(),
  }),
});

const idSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query:  z.object({}).optional().default({}),
  body:   z.object({}).optional().default({}),
});

const router = Router();
router.use(auth);

// Read — any authenticated user (visibility filtered inside service)
router.get("/", validate(listSchema), async (req, res, next) => {
  try {
    const upcoming = req.validated.query.upcoming === "true";
    const data = await listDeadlinesService(req.user, {
      teamId: req.validated.query.teamId,
      upcoming,
    });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

// Write — supervisors only
router.post(
  "/",
  allowRoles(ROLES.DOCTOR, ROLES.TA, ROLES.ADMIN),
  validate(upsertSchema),
  async (req, res, next) => {
    try {
      const data = await upsertDeadlineService(req.user, req.validated.body);
      res.status(201).json({ ok: true, data });
    } catch (err) { next(err); }
  },
);

router.delete(
  "/:id",
  allowRoles(ROLES.DOCTOR, ROLES.TA, ROLES.ADMIN),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const data = await deleteDeadlineService(req.user, req.validated.params.id);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },
);

export default router;
