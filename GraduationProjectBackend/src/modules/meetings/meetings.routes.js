import { Router } from "express";
import { z } from "zod";
import { auth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { prisma } from "../../loaders/dbLoader.js";
import {
  approveMeeting,
  cancelMeeting,
  completeMeeting,
  createMeeting,
  declineMeeting,
  deleteMeeting,
  getMeeting,
  listMeetings,
  respondMeeting,
  syncMeeting,
  updateMeeting,
} from "./meetings.controller.js";
import {
  createMeetingSchema,
  declineMeetingSchema,
  listMeetingsSchema,
  meetingParamsSchema,
  respondMeetingSchema,
  updateMeetingSchema,
} from "./meetings.schema.js";

const router = Router();

router.use(auth);

// Defense-slot conflict check — given a proposed time window and userIds,
// returns the meetings within that window for any of those users.
const conflictSchema = z.object({
  params: z.object({}).optional().default({}),
  query:  z.object({
    startAt: z.string().trim().min(1),
    endAt:   z.string().trim().min(1),
    userIds: z.string().trim().min(1),  // comma-separated
  }),
  body:   z.object({}).optional().default({}),
});
router.get("/conflict-check", validate(conflictSchema), async (req, res, next) => {
  try {
    const { startAt, endAt, userIds } = req.validated.query;
    const start = new Date(startAt);
    const end   = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(422).json({ ok: false, code: "BAD_DATES", message: "Invalid dates" });
    }
    const ids = userIds.split(",").map((s) => s.trim()).filter(Boolean);

    // Find meetings overlapping the window where any of the target users
    // are organizer or participant. Skip cancelled/declined meetings.
    const overlapping = await prisma.meeting.findMany({
      where: {
        status: { notIn: ["CANCELLED", "DECLINED"] },
        startAt: { lt: end },
        endAt:   { gt: start },
        OR: [
          { organizerId: { in: ids } },
          { participants: { some: { userId: { in: ids } } } },
        ],
      },
      select: {
        id: true, title: true, startAt: true, endAt: true, mode: true,
        organizerId: true, status: true,
        team: { select: { id: true, name: true } },
        participants: { select: { userId: true, displayName: true } },
      },
      orderBy: { startAt: "asc" },
    });

    res.json({ ok: true, data: overlapping });
  } catch (err) { next(err); }
});

router.get("/", validate(listMeetingsSchema), listMeetings);
router.get("/:id", validate(meetingParamsSchema), getMeeting);
router.post("/", validate(createMeetingSchema), createMeeting);
router.patch("/:id", validate(updateMeetingSchema), updateMeeting);
router.post("/:id/approve", validate(meetingParamsSchema), approveMeeting);
router.post("/:id/decline", validate(declineMeetingSchema), declineMeeting);
router.post("/:id/respond", validate(respondMeetingSchema), respondMeeting);
router.post("/:id/cancel", validate(meetingParamsSchema), cancelMeeting);
router.post("/:id/complete", validate(meetingParamsSchema), completeMeeting);
router.post("/:id/sync", validate(meetingParamsSchema), syncMeeting);
router.delete("/:id", validate(meetingParamsSchema), deleteMeeting);

export default router;
