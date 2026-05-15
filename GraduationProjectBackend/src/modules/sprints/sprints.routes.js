import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { ROLES } from "../../common/constants/roles.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  assignTaskToSprint,
  completeSprint,
  createSprint,
  deleteSprint,
  listAssignedSprintTeams,
  listSprintsBoard,
  moveTaskToBacklog,
  reviewSprintEvaluation,
  startSprint,
  updateSprint,
  updateSprintTask,
  upsertMySprintEvaluation,
} from "./sprints.controller.js";
import {
  assignSprintTaskSchema,
  backlogTaskSchema,
  createSprintSchema,
  listAssignedSprintTeamsSchema,
  listSprintsSchema,
  reviewSprintEvaluationSchema,
  sprintActionSchema,
  updateSprintSchema,
  updateSprintTaskSchema,
  upsertSprintEvaluationSchema,
} from "./sprints.schema.js";

const router = Router();

router.use(auth);

// Assigned-teams list is doctor/TA/admin only — students don't have an "assigned-teams" concept.
router.get(
  "/assigned-teams",
  allowRoles(ROLES.DOCTOR, ROLES.TA, ROLES.ADMIN),
  validate(listAssignedSprintTeamsSchema),
  listAssignedSprintTeams,
);
router.get("/", validate(listSprintsSchema), listSprintsBoard);
// Sprint CRUD is leader/admin only.
router.post("/", allowRoles(ROLES.LEADER, ROLES.ADMIN), validate(createSprintSchema), createSprint);
router.patch("/tasks/:taskId", allowRoles(ROLES.LEADER, ROLES.ADMIN), validate(updateSprintTaskSchema), updateSprintTask);
router.post(
  "/backlog/tasks/:taskId",
  allowRoles(ROLES.LEADER, ROLES.ADMIN),
  validate(backlogTaskSchema),
  moveTaskToBacklog,
);
// Sprint evaluations: TA writes their own; admin reviews + finalises.
router.put(
  "/:id/evaluations/me",
  allowRoles(ROLES.TA, ROLES.ADMIN),
  validate(upsertSprintEvaluationSchema),
  upsertMySprintEvaluation,
);
router.patch(
  "/:id/evaluations/:evaluationId/review",
  allowRoles(ROLES.ADMIN),
  validate(reviewSprintEvaluationSchema),
  reviewSprintEvaluation,
);
router.patch("/:id", allowRoles(ROLES.LEADER, ROLES.ADMIN), validate(updateSprintSchema), updateSprint);
router.delete("/:id", allowRoles(ROLES.LEADER, ROLES.ADMIN), validate(sprintActionSchema), deleteSprint);
router.post("/:id/start", allowRoles(ROLES.LEADER, ROLES.ADMIN), validate(sprintActionSchema), startSprint);
router.post("/:id/complete", allowRoles(ROLES.LEADER, ROLES.ADMIN), validate(sprintActionSchema), completeSprint);
router.post(
  "/:id/tasks/:taskId",
  allowRoles(ROLES.LEADER, ROLES.ADMIN),
  validate(assignSprintTaskSchema),
  assignTaskToSprint,
);

export default router;
