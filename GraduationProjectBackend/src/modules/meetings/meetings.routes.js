import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
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
