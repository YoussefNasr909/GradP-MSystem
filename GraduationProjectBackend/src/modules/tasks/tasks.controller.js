import path from "node:path";
import { z } from "zod";
import { AppError } from "../../common/errors/AppError.js";
import { removeLocalUploadByUrl, removeUploadedMulterFile } from "../../common/utils/upload-files.js";
import {
  acceptTaskService,
  approveTaskService,
  bootstrapTaskGithubService,
  createTaskEvidenceFileService,
  createTaskEvidenceLinkService,
  createTaskService,
  deleteTaskEvidenceService,
  listTaskEvidenceService,
  listTaskReviewsService,
  listTasksService,
  openTaskPullRequestService,
  rejectTaskService,
  resyncTaskGithubService,
  submitTaskForReviewService,
  updateTaskService,
} from "./tasks.service.js";
import { parseTaskEvidenceFileBody } from "./tasks.schema.js";

function resolveBackendOrigin(req) {
  const apiUrl = process.env.API_URL?.trim();
  if (apiUrl) {
    return apiUrl.replace(/\/api\/v1\/?$/, "");
  }

  return `${req.protocol}://${req.get("host")}`;
}

function mapZodToValidationError(error) {
  if (error instanceof z.ZodError) {
    const firstIssue = error.issues?.[0];
    throw new AppError(firstIssue?.message ?? "Validation error", 422, "VALIDATION_ERROR");
  }

  throw error;
}

function getUploadedFileType(file) {
  const extension = path.extname(file?.originalname ?? "").replace(/^\./, "").trim().toUpperCase();
  if (extension) return extension;

  const fallback = String(file?.mimetype ?? "")
    .split("/")
    .pop()
    ?.trim()
    .toUpperCase();

  return fallback || "FILE";
}

export async function listTasks(req, res) {
  const result = await listTasksService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

export async function createTask(req, res) {
  const result = await createTaskService(req.user, req.validated.body);
  res.status(201).json({ ok: true, data: result });
}

export async function updateTask(req, res) {
  const result = await updateTaskService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data: result });
}

export async function listTaskEvidence(req, res) {
  const result = await listTaskEvidenceService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}

export async function uploadTaskEvidenceFile(req, res) {
  try {
    if (!req.file) {
      throw new AppError("Upload an evidence file first.", 422, "TASK_EVIDENCE_FILE_REQUIRED");
    }

    const payload = parseTaskEvidenceFileBody(req.body);
    const result = await createTaskEvidenceFileService(req.user, req.params.id, {
      ...payload,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: getUploadedFileType(req.file),
      url: `${resolveBackendOrigin(req)}/uploads/task-evidence/${req.file.filename}`,
    });

    res.status(201).json({ ok: true, data: result });
  } catch (error) {
    await removeUploadedMulterFile(req.file);
    mapZodToValidationError(error);
  }
}

export async function addTaskEvidenceLink(req, res) {
  const result = await createTaskEvidenceLinkService(req.user, req.validated.params.id, req.validated.body);
  res.status(201).json({ ok: true, data: result });
}

export async function deleteTaskEvidence(req, res) {
  const result = await deleteTaskEvidenceService(req.user, req.validated.params.id, req.validated.params.evidenceId);
  if (result?.type === "FILE") {
    await removeLocalUploadByUrl(result.url, "task-evidence");
  }
  res.json({ ok: true, data: result });
}

export async function acceptTask(req, res) {
  const result = await acceptTaskService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}

export async function submitTaskForReview(req, res) {
  const result = await submitTaskForReviewService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}

export async function approveTask(req, res) {
  const result = await approveTaskService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data: result });
}

export async function rejectTask(req, res) {
  const result = await rejectTaskService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data: result });
}

export async function listTaskReviews(req, res) {
  const result = await listTaskReviewsService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}

export async function bootstrapTaskGithub(req, res) {
  const result = await bootstrapTaskGithubService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}

export async function openTaskPullRequest(req, res) {
  const result = await openTaskPullRequestService(req.user, req.validated.params.id, req.validated.body);
  res.status(201).json({ ok: true, data: result });
}

export async function resyncTaskGithub(req, res) {
  const result = await resyncTaskGithubService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}
