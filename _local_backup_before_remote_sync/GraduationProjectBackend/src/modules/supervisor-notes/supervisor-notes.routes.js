import { Router } from "express";
import { z } from "zod";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { ROLES } from "../../common/constants/roles.js";
import {
  listNotesService,
  createNoteService,
  updateNoteService,
  deleteNoteService,
} from "./supervisor-notes.service.js";

const noteContentSchema = z.string().trim().min(1).max(5000);

const listSchema = z.object({
  params: z.object({}).optional().default({}),
  query:  z.object({ teamId: z.string().trim().min(1) }),
  body:   z.object({}).optional().default({}),
});

const createSchema = z.object({
  params: z.object({}).optional().default({}),
  query:  z.object({}).optional().default({}),
  body:   z.object({ teamId: z.string().trim().min(1), content: noteContentSchema }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query:  z.object({}).optional().default({}),
  body:   z.object({ content: noteContentSchema }),
});

const deleteSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query:  z.object({}).optional().default({}),
  body:   z.object({}).optional().default({}),
});

const router = Router();
router.use(auth);
router.use(allowRoles(ROLES.DOCTOR, ROLES.TA, ROLES.ADMIN));

router.get("/", validate(listSchema), async (req, res, next) => {
  try {
    const data = await listNotesService(req.user, req.validated.query.teamId);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const data = await createNoteService(req.user, req.validated.body.teamId, { content: req.validated.body.content });
    res.status(201).json({ ok: true, data });
  } catch (err) { next(err); }
});

router.patch("/:id", validate(updateSchema), async (req, res, next) => {
  try {
    const data = await updateNoteService(req.user, req.validated.params.id, req.validated.body);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

router.delete("/:id", validate(deleteSchema), async (req, res, next) => {
  try {
    const data = await deleteNoteService(req.user, req.validated.params.id);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

export default router;
