import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { ROLES } from "../../common/constants/roles.js";
import { AppError } from "../../common/errors/AppError.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  acceptTask,
  addTaskEvidenceLink,
  approveTask,
  bootstrapTaskGithub,
  createTask,
  deleteTaskEvidence,
  listTaskEvidence,
  listTaskReviews,
  listTasks,
  openTaskPullRequest,
  rejectTask,
  resyncTaskGithub,
  submitTaskForReview,
  uploadTaskEvidenceFile,
  updateTask,
} from "./tasks.controller.js";
import {
  approveTaskSchema,
  bootstrapTaskGithubSchema,
  createTaskSchema,
  listTasksSchema,
  openTaskPullRequestSchema,
  rejectTaskSchema,
  taskActionSchema,
  taskEvidenceDeleteSchema,
  taskEvidenceLinkSchema,
  taskEvidenceRouteSchema,
  taskGithubRouteSchema,
  updateTaskSchema,
} from "./tasks.schema.js";

const router = Router();
const taskEvidenceUploadDir = path.resolve(process.cwd(), "uploads", "task-evidence");
fs.mkdirSync(taskEvidenceUploadDir, { recursive: true });

const allowedTaskEvidenceExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".zip",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);
const allowedTaskEvidenceMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/octet-stream",
]);

function parseUploadLimitInMb(value) {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 25 * 1024 * 1024;
  return Math.floor(parsed * 1024 * 1024);
}

const taskEvidenceUploadLimitBytes = parseUploadLimitInMb(process.env.TASK_EVIDENCE_MAX_SIZE_MB);
const taskEvidenceUploadLimitLabel = `${Number.parseFloat((taskEvidenceUploadLimitBytes / (1024 * 1024)).toFixed(2))}MB`;

const taskEvidenceUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, taskEvidenceUploadDir),
    filename: (_req, file, cb) => {
      const safeOriginalName = String(file.originalname || "task-evidence")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .toLowerCase();
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniquePrefix}-${safeOriginalName}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const isAllowed = allowedTaskEvidenceExtensions.has(extension) || allowedTaskEvidenceMimeTypes.has(file.mimetype);
    cb(
      isAllowed
        ? null
        : new AppError(
            "Allowed evidence types: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ZIP, TXT, PNG, JPG, JPEG, and WEBP.",
            422,
            "TASK_EVIDENCE_INVALID_FILE_TYPE",
          ),
      isAllowed,
    );
  },
  limits: { fileSize: taskEvidenceUploadLimitBytes },
});

const uploadSingleTaskEvidence = (req, res, next) => {
  taskEvidenceUpload.single("file")(req, res, (error) => {
    if (!error) return next();

    if (error?.code === "LIMIT_FILE_SIZE") {
      return next(new AppError(`Evidence max size is ${taskEvidenceUploadLimitLabel}.`, 422, "TASK_EVIDENCE_FILE_TOO_LARGE"));
    }

    if (error instanceof AppError) return next(error);
    return next(new AppError(error.message || "Evidence upload failed.", 422, "TASK_EVIDENCE_UPLOAD_FAILED"));
  });
};

router.use(auth);

router.get("/", validate(listTasksSchema), listTasks);
router.post("/", validate(createTaskSchema), createTask);
router.patch("/:id", validate(updateTaskSchema), updateTask);
router.get("/:id/evidence", validate(taskEvidenceRouteSchema), listTaskEvidence);
router.post("/:id/evidence/file", uploadSingleTaskEvidence, uploadTaskEvidenceFile);
router.post("/:id/evidence/link", validate(taskEvidenceLinkSchema), addTaskEvidenceLink);
router.delete("/:id/evidence/:evidenceId", validate(taskEvidenceDeleteSchema), deleteTaskEvidence);
router.post("/:id/accept", validate(taskActionSchema), acceptTask);
router.post("/:id/submit-review", validate(taskActionSchema), submitTaskForReview);
// Defence-in-depth: only the reviewer roles can hit approve/reject. The service
// also re-checks team membership via canReviewTaskTeam, but rejecting at the
// route level returns a clearer 403 and avoids loading the task for a request
// that was never going to succeed.
router.post(
  "/:id/approve",
  allowRoles(ROLES.LEADER, ROLES.TA, ROLES.ADMIN),
  validate(approveTaskSchema),
  approveTask,
);
router.post(
  "/:id/reject",
  allowRoles(ROLES.LEADER, ROLES.TA, ROLES.ADMIN),
  validate(rejectTaskSchema),
  rejectTask,
);
router.get("/:id/reviews", validate(taskActionSchema), listTaskReviews);
router.post("/:id/github/bootstrap", validate(bootstrapTaskGithubSchema), bootstrapTaskGithub);
router.post("/:id/github/open-pr", validate(openTaskPullRequestSchema), openTaskPullRequest);
router.post("/:id/github/resync", validate(taskGithubRouteSchema), resyncTaskGithub);

export default router;
