import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  connectGoogleCalendar,
  connectOutlookCalendar,
  disconnectCalendarIntegration,
  googleCalendarCallback,
  listCalendarEvents,
  listCalendarIntegrations,
  outlookCalendarCallback,
  syncCalendarProvider,
} from "./calendar.controller.js";
import { listCalendarEventsSchema, providerParamsSchema, syncProviderSchema } from "./calendar.schema.js";

const router = Router();
router.get("/integrations/google/callback", googleCalendarCallback);
router.get("/integrations/outlook/callback", outlookCalendarCallback);

router.use(auth);
router.get("/events", validate(listCalendarEventsSchema), listCalendarEvents);
router.get("/integrations", listCalendarIntegrations);
router.post("/integrations/google/connect", connectGoogleCalendar);
router.post("/integrations/outlook/connect", connectOutlookCalendar);
router.post("/integrations/:provider/disconnect", validate(providerParamsSchema), disconnectCalendarIntegration);
router.post("/integrations/:provider/sync", validate(syncProviderSchema), syncCalendarProvider);

export default router;
