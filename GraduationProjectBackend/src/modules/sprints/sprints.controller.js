import {
  assignTaskToSprintService,
  completeSprintService,
  createSprintService,
  listSprintsBoardService,
  moveTaskToBacklogService,
  startSprintService,
  updateSprintService,
  updateSprintTaskService,
} from "./sprints.service.js";

export async function listSprintsBoard(req, res) {
  const result = await listSprintsBoardService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

export async function createSprint(req, res) {
  const result = await createSprintService(req.user, req.validated.body);
  res.status(201).json({ ok: true, data: result });
}

export async function updateSprint(req, res) {
  const result = await updateSprintService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data: result });
}

export async function startSprint(req, res) {
  const result = await startSprintService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}

export async function completeSprint(req, res) {
  const result = await completeSprintService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}

export async function assignTaskToSprint(req, res) {
  const result = await assignTaskToSprintService(
    req.user,
    req.validated.params.id,
    req.validated.params.taskId,
    req.validated.body,
  );
  res.json({ ok: true, data: result });
}

export async function moveTaskToBacklog(req, res) {
  const result = await moveTaskToBacklogService(req.user, req.validated.params.taskId);
  res.json({ ok: true, data: result });
}

export async function updateSprintTask(req, res) {
  const result = await updateSprintTaskService(req.user, req.validated.params.taskId, req.validated.body);
  res.json({ ok: true, data: result });
}
