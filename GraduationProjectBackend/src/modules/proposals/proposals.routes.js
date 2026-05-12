import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { ROLES } from "../../common/constants/roles.js";
import {
  listProposals,
  getMyProposal,
  getProposal,
  createProposal,
  updateProposal,
  submitProposal,
  reviewProposal,
  deleteProposal,
} from "./proposals.controller.js";
import {
  listProposalsSchema,
  proposalByIdSchema,
  createProposalSchema,
  updateProposalSchema,
  reviewProposalSchema,
  submitProposalSchema,
} from "./proposals.schema.js";

const router = Router();

router.use(auth);

// Read endpoints — visibility enforced inside the service
router.get("/",      validate(listProposalsSchema), listProposals);
router.get("/mine",  getMyProposal);                          // shortcut for leader/member
router.get("/:id",   validate(proposalByIdSchema),   getProposal);

// Leader actions
router.post("/",                allowRoles(ROLES.LEADER, ROLES.ADMIN),  validate(createProposalSchema),  createProposal);
router.patch("/:id",            allowRoles(ROLES.LEADER, ROLES.ADMIN),  validate(updateProposalSchema),  updateProposal);
router.post("/:id/submit",      allowRoles(ROLES.LEADER, ROLES.ADMIN),  validate(submitProposalSchema),  submitProposal);
router.delete("/:id",           allowRoles(ROLES.LEADER, ROLES.ADMIN),  validate(proposalByIdSchema),    deleteProposal);

// Doctor action
router.patch("/:id/review",     allowRoles(ROLES.DOCTOR, ROLES.ADMIN),  validate(reviewProposalSchema),  reviewProposal);

export default router;
