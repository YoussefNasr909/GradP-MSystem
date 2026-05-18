import { Router } from "express";
import { ROLES } from "../../common/constants/roles.js";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  listWeeklyReports,
  reviewWeeklyReport,
  submitWeeklyReport,
} from "./weekly-reports.controller.js";
import {
  listWeeklyReportsSchema,
  reviewWeeklyReportSchema,
  submitWeeklyReportSchema,
} from "./weekly-reports.schema.js";

const router = Router();

router.use(auth);

router.get(
  "/",
  allowRoles(ROLES.STUDENT, ROLES.LEADER, ROLES.TA, ROLES.DOCTOR, ROLES.ADMIN),
  validate(listWeeklyReportsSchema),
  listWeeklyReports,
);
router.post(
  "/:id/submit",
  allowRoles(ROLES.STUDENT, ROLES.LEADER, ROLES.ADMIN),
  validate(submitWeeklyReportSchema),
  submitWeeklyReport,
);
router.post(
  "/:id/review",
  allowRoles(ROLES.TA, ROLES.DOCTOR, ROLES.ADMIN),
  validate(reviewWeeklyReportSchema),
  reviewWeeklyReport,
);

export default router;
