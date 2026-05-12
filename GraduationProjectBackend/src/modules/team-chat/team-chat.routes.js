import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { auth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { AppError } from "../../common/errors/AppError.js";
import {
  getTeamGroupChatBootstrap,
  getTeamGroupConversationMessages,
  markTeamGroupConversationSeen,
  sendTeamGroupMessage,
} from "./team-chat.controller.js";
import {
  getTeamGroupChatBootstrapSchema,
  getTeamGroupConversationMessagesSchema,
  markTeamGroupConversationSeenSchema,
  sendTeamGroupMessageSchema,
} from "./team-chat.schema.js";

const teamChatUploadDir = path.resolve(process.cwd(), "uploads", "team-chat");
fs.mkdirSync(teamChatUploadDir, { recursive: true });

const allowedTeamChatExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
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

const allowedTeamChatMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
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

const teamChatUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, teamChatUploadDir);
    },
    filename: (_req, file, cb) => {
      const safeOriginalName = String(file.originalname || "file")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .toLowerCase();
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniquePrefix}-${safeOriginalName}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const isAllowed = allowedTeamChatExtensions.has(extension) || allowedTeamChatMimeTypes.has(file.mimetype);

    cb(
      isAllowed
        ? null
        : new AppError(
            "Allowed file types: Images, PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ZIP, and TXT.",
            422,
            "TEAM_CHAT_INVALID_FILE_TYPE",
          ),
      isAllowed,
    );
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadSingleTeamChatFile = (req, res, next) => {
  teamChatUpload.single("file")(req, res, (error) => {
    if (!error) {
      return next();
    }
    if (error?.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("Max file size for team chat is 10MB.", 422, "TEAM_CHAT_FILE_TOO_LARGE"));
    }
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError(error.message || "File upload failed.", 422, "TEAM_CHAT_FILE_UPLOAD_FAILED"));
  });
};

const router = Router();

router.use(auth);

router.get("/bootstrap", validate(getTeamGroupChatBootstrapSchema), getTeamGroupChatBootstrap);
router.get("/conversations/:id/messages", validate(getTeamGroupConversationMessagesSchema), getTeamGroupConversationMessages);
router.post("/conversations/:id/messages", uploadSingleTeamChatFile, validate(sendTeamGroupMessageSchema), sendTeamGroupMessage);
router.patch("/conversations/:id/seen", validate(markTeamGroupConversationSeenSchema), markTeamGroupConversationSeen);

export default router;
