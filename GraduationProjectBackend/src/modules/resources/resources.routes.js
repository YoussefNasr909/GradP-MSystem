import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { AppError } from "../../common/errors/AppError.js";
import { ROLES } from "../../common/constants/roles.js";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createResource, deleteResource, listResources, updateResource } from "./resources.controller.js";
import { listResourcesSchema, resourceByIdSchema } from "./resources.schema.js";

const router = Router();
const resourcesUploadDir = path.resolve(process.cwd(), "uploads", "resources");
fs.mkdirSync(resourcesUploadDir, { recursive: true });

const allowedResourceExtensions = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".zip", ".txt"]);
const allowedResourceMimeTypes = new Set([
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
  "application/octet-stream",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, resourcesUploadDir);
    },
    filename: (_req, file, cb) => {
      const safeOriginalName = String(file.originalname || "resource")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .toLowerCase();
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniquePrefix}-${safeOriginalName}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const isAllowed = allowedResourceExtensions.has(extension) || allowedResourceMimeTypes.has(file.mimetype);

    cb(
      isAllowed
        ? null
        : new AppError(
            "Allowed file types: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ZIP, and TXT.",
            422,
            "RESOURCE_INVALID_FILE_TYPE",
          ),
      isAllowed,
    );
  },
});

const uploadSingleResource = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error?.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("Max file size is 20MB.", 422, "RESOURCE_FILE_TOO_LARGE"));
    }

    if (error instanceof AppError) {
      return next(error);
    }

    return next(new AppError(error.message || "File upload failed.", 422, "RESOURCE_FILE_UPLOAD_FAILED"));
  });
};

router.use(auth);
router.get("/", validate(listResourcesSchema), listResources);
router.post("/", allowRoles(ROLES.DOCTOR, ROLES.TA), uploadSingleResource, createResource);
router.patch("/:id", allowRoles(ROLES.DOCTOR, ROLES.TA), uploadSingleResource, updateResource);
router.delete("/:id", allowRoles(ROLES.DOCTOR, ROLES.TA), validate(resourceByIdSchema), deleteResource);

export default router;
