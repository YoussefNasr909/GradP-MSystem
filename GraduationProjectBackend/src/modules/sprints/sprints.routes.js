import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware.js";
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

router.get("/assigned-teams", validate(listAssignedSprintTeamsSchema), listAssignedSprintTeams);
router.get("/", validate(listSprintsSchema), listSprintsBoard);
router.post("/", validate(createSprintSchema), createSprint);
router.patch("/tasks/:taskId", validate(updateSprintTaskSchema), updateSprintTask);
router.post("/backlog/tasks/:taskId", validate(backlogTaskSchema), moveTaskToBacklog);
router.put("/:id/evaluations/me", validate(upsertSprintEvaluationSchema), upsertMySprintEvaluation);
router.patch("/:id/evaluations/:evaluationId/review", validate(reviewSprintEvaluationSchema), reviewSprintEvaluation);
router.patch("/:id", validate(updateSprintSchema), updateSprint);
router.delete("/:id", validate(sprintActionSchema), deleteSprint);
router.post("/:id/start", validate(sprintActionSchema), startSprint);
router.post("/:id/complete", validate(sprintActionSchema), completeSprint);
router.post("/:id/tasks/:taskId", validate(assignSprintTaskSchema), assignTaskToSprint);

export default router;
