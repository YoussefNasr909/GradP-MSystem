import { Router } from "express";
import { z } from "zod";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { ROLES } from "../../common/constants/roles.js";
import {
  listAnnouncementsService,
  createAnnouncementService,
  updateAnnouncementService,
  deleteAnnouncementService,
} from "./announcements.service.js";

const createSchema = z.object({
  params: z.object({}).optional().default({}),
  query:  z.object({}).optional().default({}),
  body: z.object({
    title:   z.string().trim().min(3).max(200),
    content: z.string().trim().min(5).max(5000),
    teamId:  z.string().trim().min(1).optional().nullable(),
    pinned:  z.boolean().optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query:  z.object({}).optional().default({}),
  body: z.object({
    title:   z.string().trim().min(3).max(200).optional(),
    content: z.string().trim().min(5).max(5000).optional(),
    pinned:  z.boolean().optional(),
  }),
});

const idSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query:  z.object({}).optional().default({}),
  body:   z.object({}).optional().default({}),
});

const router = Router();
router.use(auth);

router.get("/", async (req, res, next) => {
  try {
    const data = await listAnnouncementsService(req.user);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

router.post(
  "/",
  allowRoles(ROLES.DOCTOR, ROLES.TA, ROLES.ADMIN),
  validate(createSchema),
  async (req, res, next) => {
    try {
      const data = await createAnnouncementService(req.user, req.validated.body);
      res.status(201).json({ ok: true, data });
    } catch (err) { next(err); }
  },
);

router.patch(
  "/:id",
  allowRoles(ROLES.DOCTOR, ROLES.TA, ROLES.ADMIN),
  validate(updateSchema),
  async (req, res, next) => {
    try {
      const data = await updateAnnouncementService(req.user, req.validated.params.id, req.validated.body);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },
);

router.delete(
  "/:id",
  allowRoles(ROLES.DOCTOR, ROLES.TA, ROLES.ADMIN),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const data = await deleteAnnouncementService(req.user, req.validated.params.id);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },
);

export default router;
