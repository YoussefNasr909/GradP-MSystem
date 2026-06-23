import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { validate } from "../../middlewares/validate.middleware.js";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { ROLES } from "../../common/constants/roles.js";
import { AppError } from "../../common/errors/AppError.js";
import {
  createUserSchema,
  deleteMeSchema,
  getDirectoryUserByIdSchema,
  deleteUserSchema,
  getUserByIdSchema,
  getUsersSummarySchema,
  listDirectoryUsersSchema,
  listUsersSchema,
  updateMeSchema,
  updateMyRoleSchema,
  updateUserSchema,
} from "./users.schema.js";
import {
  createUser,
  deleteMe,
  deleteUser,
  getDirectoryUserById,
  getUserById,
  getUsersSummary,
  listDirectoryUsers,
  listUsers,
  removeMeAvatar,
  updateMeAvatar,
  updateMe,
  updateMyRole,
  updateUser,
} from "./users.controller.js";

const router = Router();
const avatarsUploadDir = path.resolve(process.cwd(), "uploads", "avatars");
fs.mkdirSync(avatarsUploadDir, { recursive: true });

const allowedAvatarExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const allowedAvatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const avatarUploadLimitBytes = 2 * 1024 * 1024;

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarsUploadDir),
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      const userId = String(req.user?.id ?? "user").replace(/[^a-zA-Z0-9_-]/g, "");
      cb(null, `${userId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    },
  }),
  limits: { fileSize: avatarUploadLimitBytes },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const isAllowed = allowedAvatarExtensions.has(extension) && allowedAvatarMimeTypes.has(file.mimetype);

    cb(
      isAllowed
        ? null
        : new AppError("Upload a JPG, PNG, WEBP, or GIF image.", 422, "AVATAR_INVALID_FILE_TYPE"),
      isAllowed,
    );
  },
});

const uploadSingleAvatar = (req, res, next) => {
  avatarUpload.single("avatar")(req, res, (error) => {
    if (!error) return next();

    if (error?.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("Profile photo must be 2MB or smaller.", 422, "AVATAR_FILE_TOO_LARGE"));
    }

    if (error instanceof AppError) return next(error);

    return next(new AppError(error.message || "Profile photo upload failed.", 422, "AVATAR_UPLOAD_FAILED"));
  });
};

router.use(auth);
router.patch("/me/avatar", uploadSingleAvatar, updateMeAvatar);
router.delete("/me/avatar", removeMeAvatar);
router.patch("/me", validate(updateMeSchema), updateMe);
router.delete("/me", validate(deleteMeSchema), deleteMe);
router.patch("/me/role", validate(updateMyRoleSchema), updateMyRole);
router.get("/directory", validate(listDirectoryUsersSchema), listDirectoryUsers);
router.get("/directory/:id", validate(getDirectoryUserByIdSchema), getDirectoryUserById);

router.use(allowRoles(ROLES.ADMIN));

router.get("/summary", validate(getUsersSummarySchema), getUsersSummary);
router.get("/", validate(listUsersSchema), listUsers);
router.post("/", validate(createUserSchema), createUser);
router.get("/:id", validate(getUserByIdSchema), getUserById);
router.patch("/:id", validate(updateUserSchema), updateUser);
router.delete("/:id", validate(deleteUserSchema), deleteUser);

export default router;
