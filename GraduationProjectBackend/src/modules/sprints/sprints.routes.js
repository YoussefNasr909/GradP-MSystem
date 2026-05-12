import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  assignTaskToSprint,
  completeSprint,
  createSprint,
  listSprintsBoard,
  moveTaskToBacklog,
  startSprint,
  updateSprint,
  updateSprintTask,
} from "./sprints.controller.js";
import {
  assignSprintTaskSchema,
  backlogTaskSchema,
  createSprintSchema,
  listSprintsSchema,
  sprintActionSchema,
  updateSprintSchema,
  updateSprintTaskSchema,
} from "./sprints.schema.js";

const router = Router();

router.use(auth);

router.get("/", validate(listSprintsSchema), listSprintsBoard);
router.post("/", validate(createSprintSchema), createSprint);
router.patch("/tasks/:taskId", validate(updateSprintTaskSchema), updateSprintTask);
router.post("/backlog/tasks/:taskId", validate(backlogTaskSchema), moveTaskToBacklog);
router.patch("/:id", validate(updateSprintSchema), updateSprint);
router.post("/:id/start", validate(sprintActionSchema), startSprint);
router.post("/:id/complete", validate(sprintActionSchema), completeSprint);
router.post("/:id/tasks/:taskId", validate(assignSprintTaskSchema), assignTaskToSprint);

export default router;
