import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { ROLES } from "../../common/constants/roles.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { approveRisk, createRisk, listRisks, requestRiskRevision, updateRisk } from "./risks.controller.js";
import {
  approveRiskSchema,
  createRiskSchema,
  listRisksSchema,
  requestRiskRevisionSchema,
  updateRiskSchema,
} from "./risks.schema.js";

const router = Router();

router.use(auth);

router.get("/", validate(listRisksSchema), listRisks);
// Only the team leader (or admin) creates a risk; everyone else gets a clean 403.
router.post("/", allowRoles(ROLES.LEADER, ROLES.ADMIN), validate(createRiskSchema), createRisk);
// Updating a risk = leader workflow (status edits etc). Doctor/TA do approve/revision actions
// via the dedicated endpoints below.
router.patch("/:id", allowRoles(ROLES.LEADER, ROLES.ADMIN), validate(updateRiskSchema), updateRisk);
// Approve/request-revision: doctor finalises after resolution, TA approves monitoring.
// Service still re-checks `team.doctor === actor.id` / `team.ta === actor.id`, but the
// route gate stops unauthenticated-role traffic before it ever loads the risk.
router.post(
  "/:id/approve",
  allowRoles(ROLES.DOCTOR, ROLES.TA, ROLES.ADMIN),
  validate(approveRiskSchema),
  approveRisk,
);
router.post(
  "/:id/request-revision",
  allowRoles(ROLES.DOCTOR, ROLES.TA, ROLES.ADMIN),
  validate(requestRiskRevisionSchema),
  requestRiskRevision,
);

export default router;
