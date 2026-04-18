import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { ROLES } from "../../common/constants/roles.js";
import { AppError } from "../../common/errors/AppError.js";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createDocument, deleteDocument, listDocuments, updateDocument } from "./documents.controller.js";
import { documentByIdSchema, listDocumentsSchema, updateDocumentSchema } from "./documents.schema.js";

const router = Router();
const documentsUploadDir = path.resolve(process.cwd(), "uploads", "documents");
fs.mkdirSync(documentsUploadDir, { recursive: true });

const allowedDocumentExtensions = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".zip", ".txt"]);
const allowedDocumentMimeTypes = new Set([
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
      cb(null, documentsUploadDir);
    },
    filename: (_req, file, cb) => {
      const safeOriginalName = String(file.originalname || "document")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .toLowerCase();
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniquePrefix}-${safeOriginalName}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const isAllowed = allowedDocumentExtensions.has(extension) || allowedDocumentMimeTypes.has(file.mimetype);

    cb(
      isAllowed
        ? null
        : new AppError(
            "Allowed document types: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ZIP, and TXT.",
            422,
            "DOCUMENT_INVALID_FILE_TYPE",
          ),
      isAllowed,
    );
  },
});

const uploadSingleDocument = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error?.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("Document max size is 25MB.", 422, "DOCUMENT_FILE_TOO_LARGE"));
    }

    if (error instanceof AppError) {
      return next(error);
    }

    return next(new AppError(error.message || "Document upload failed.", 422, "DOCUMENT_FILE_UPLOAD_FAILED"));
  });
};

router.use(auth);
router.get("/", validate(listDocumentsSchema), listDocuments);
router.post("/", allowRoles(ROLES.LEADER, ROLES.STUDENT), uploadSingleDocument, createDocument);
router.patch("/:id", allowRoles(ROLES.LEADER, ROLES.STUDENT), uploadSingleDocument, validate(updateDocumentSchema), updateDocument);
router.delete("/:id", allowRoles(ROLES.LEADER), validate(documentByIdSchema), deleteDocument);

export default router;
