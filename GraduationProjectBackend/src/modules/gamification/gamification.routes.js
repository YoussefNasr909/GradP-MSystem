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
  getRules,
  getAdminCases,
  resolveAdminCase,
  getAdminAdjustments,
  createAdminAdjustment,
  reviewAdminAdjustment,
  getAdminAuditLogs,
  processEvents,
  generateLeaderboardSnapshots,
} from "./gamification.controller.js";
import {
  getMyOverviewSchema,
  getMyHistorySchema,
  getMyBadgesSchema,
  getTeamSummarySchema,
  getTeamHistorySchema,
  getLeaderboardsSchema,
  getRulesSchema,
  getAdminCasesSchema,
  resolveAdminCaseSchema,
  getAdminAdjustmentsSchema,
  createAdminAdjustmentSchema,
  reviewAdminAdjustmentSchema,
  getAdminAuditLogsSchema,
  generateLeaderboardSnapshotsSchema,
  processEventsSchema,
} from "./gamification.schema.js";

const router = Router();

// All gamification routes require authentication
router.use(auth);

// ─── Student / User read endpoints ───────────────────────────
router.get("/me", validate(getMyOverviewSchema), getMyOverview);
router.get("/me/history", validate(getMyHistorySchema), getMyHistory);
router.get("/me/badges", validate(getMyBadgesSchema), getMyBadges);

// ─── Team read endpoints ─────────────────────────────────────
router.get("/team/:teamId", validate(getTeamSummarySchema), getTeamSummary);
router.get("/team/:teamId/history", validate(getTeamHistorySchema), getTeamHistory);

// ─── Leaderboards ────────────────────────────────────────────
router.get("/leaderboards", validate(getLeaderboardsSchema), getLeaderboards);

// ─── Rules (visible to all authenticated users) ──────────────
router.get("/rules", validate(getRulesSchema), getRules);

// ─── Admin / Staff endpoints ─────────────────────────────────
router.get(
  "/admin/cases",
  allowRoles(ROLES.TA, ROLES.DOCTOR, ROLES.ADMIN),
  validate(getAdminCasesSchema),
  getAdminCases,
);

router.patch(
  "/admin/cases/:caseId/resolve",
  allowRoles(ROLES.DOCTOR, ROLES.ADMIN),
  validate(resolveAdminCaseSchema),
  resolveAdminCase,
);

router.get(
  "/admin/adjustments",
  allowRoles(ROLES.TA, ROLES.DOCTOR, ROLES.ADMIN),
  validate(getAdminAdjustmentsSchema),
  getAdminAdjustments,
);

router.post(
  "/admin/adjustments",
  allowRoles(ROLES.TA, ROLES.DOCTOR, ROLES.ADMIN),
  validate(createAdminAdjustmentSchema),
  createAdminAdjustment,
);

router.patch(
  "/admin/adjustments/:adjustmentId/review",
  allowRoles(ROLES.DOCTOR, ROLES.ADMIN),
  validate(reviewAdminAdjustmentSchema),
  reviewAdminAdjustment,
);

router.get(
  "/admin/audit-logs",
  allowRoles(ROLES.ADMIN),
  validate(getAdminAuditLogsSchema),
  getAdminAuditLogs,
);

router.post(
  "/admin/leaderboards/snapshots",
  allowRoles(ROLES.ADMIN),
  validate(generateLeaderboardSnapshotsSchema),
  generateLeaderboardSnapshots,
);

// ─── Processor trigger (Admin only) ──────────────────────────
router.post(
  "/admin/process-events",
  allowRoles(ROLES.ADMIN),
  validate(processEventsSchema),
  processEvents,
);

export default router;
