import { Router } from "express";
import { ROLES } from "../../common/constants/roles.js";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  getMyOverview,
  getMyHistory,
  getMyBadges,
  getTeamSummary,
  getTeamHistory,
  getLeaderboards,
  processEvents,
} from "./gamification.controller.js";
import {
  getMyOverviewSchema,
  getMyHistorySchema,
  getMyBadgesSchema,
  getTeamSummarySchema,
  getTeamHistorySchema,
  getLeaderboardsSchema,
  processEventsSchema,
} from "./gamification.schema.js";

const router = Router();

router.use(auth);

router.get("/me", validate(getMyOverviewSchema), getMyOverview);
router.get("/me/history", validate(getMyHistorySchema), getMyHistory);
router.get("/me/badges", validate(getMyBadgesSchema), getMyBadges);

router.get("/team/:teamId", validate(getTeamSummarySchema), getTeamSummary);
router.get("/team/:teamId/history", validate(getTeamHistorySchema), getTeamHistory);

router.get("/leaderboards", validate(getLeaderboardsSchema), getLeaderboards);

router.post(
  "/admin/process-events",
  allowRoles(ROLES.ADMIN),
  validate(processEventsSchema),
  processEvents,
);

export default router;
