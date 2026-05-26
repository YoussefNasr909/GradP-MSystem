import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { Router } from "express";
import { AppError } from "../../common/errors/AppError.js";
import { auth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  addSupportTicketMessage,
  bulkUpdateSupportTickets,
  createSupportSavedReply,
  createSupportTicket,
  deleteSupportSavedReply,
  getSupportSummary,
  getSupportTicket,
  listSupportAgents,
  listSupportSavedReplies,
  listSupportTickets,
  quickChatSupportTicket,
  reopenSupportTicket,
  updateSupportSavedReply,
  updateSupportTicket,
} from "./support.controller.js";
import {
  addSupportTicketMessageSchema,
  bulkUpdateSupportTicketsSchema,
  createSupportSavedReplySchema,
  createSupportTicketSchema,
  deleteSupportSavedReplySchema,
  listSupportAgentsSchema,
  listSupportSavedRepliesSchema,
  listSupportTicketsSchema,
  quickChatSupportTicketSchema,
  reopenSupportTicketSchema,
  supportSummarySchema,
  supportTicketByIdSchema,
  updateSupportSavedReplySchema,
  updateSupportTicketSchema,
} from "./support.schema.js";

const supportUploadDir = path.resolve(process.cwd(), "uploads", "support");
fs.mkdirSync(supportUploadDir, { recursive: true });

const allowedSupportExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".zip",
  ".txt",
]);

const supportUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, supportUploadDir),
    filename: (_req, file, cb) => {
      const safeOriginalName = String(file.originalname || "file")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeOriginalName}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const isAllowed = allowedSupportExtensions.has(extension);
    cb(
      isAllowed
        ? null
        : new AppError("Allowed files: images, PDF, Office documents, ZIP, and TXT.", 422, "SUPPORT_INVALID_FILE_TYPE"),
      isAllowed,
    );
  },
});

const uploadSupportFiles = (req, res, next) => {
  supportUpload.array("files", 5)(req, res, (error) => {
    if (!error) return next();
    if (error?.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("Each support attachment must be 10MB or smaller.", 422, "SUPPORT_FILE_TOO_LARGE"));
    }
    if (error?.code === "LIMIT_FILE_COUNT") {
      return next(new AppError("Attach up to 5 files at a time.", 422, "SUPPORT_TOO_MANY_FILES"));
    }
    if (error instanceof AppError) return next(error);
    return next(new AppError(error.message || "Support file upload failed.", 422, "SUPPORT_FILE_UPLOAD_FAILED"));
  });
};

const router = Router();

router.use(auth);
router.get("/summary", validate(supportSummarySchema), getSupportSummary);
router.get("/agents", validate(listSupportAgentsSchema), listSupportAgents);
router.get("/saved-replies", validate(listSupportSavedRepliesSchema), listSupportSavedReplies);
router.post("/saved-replies", validate(createSupportSavedReplySchema), createSupportSavedReply);
router.patch("/saved-replies/:id", validate(updateSupportSavedReplySchema), updateSupportSavedReply);
router.delete("/saved-replies/:id", validate(deleteSupportSavedReplySchema), deleteSupportSavedReply);
router.get("/tickets", validate(listSupportTicketsSchema), listSupportTickets);
router.post("/tickets", uploadSupportFiles, validate(createSupportTicketSchema), createSupportTicket);
router.post("/tickets/quick-chat", validate(quickChatSupportTicketSchema), quickChatSupportTicket);
router.patch("/tickets/bulk", validate(bulkUpdateSupportTicketsSchema), bulkUpdateSupportTickets);
router.get("/tickets/:id", validate(supportTicketByIdSchema), getSupportTicket);
router.post("/tickets/:id/messages", uploadSupportFiles, validate(addSupportTicketMessageSchema), addSupportTicketMessage);
router.patch("/tickets/:id", validate(updateSupportTicketSchema), updateSupportTicket);
router.post("/tickets/:id/reopen", validate(reopenSupportTicketSchema), reopenSupportTicket);

export default router;
