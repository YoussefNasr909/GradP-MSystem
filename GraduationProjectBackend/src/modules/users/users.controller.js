import {
  createUserService,
  deleteUserService,
  getDirectoryUserByIdService,
  deleteMeService,
  getUserByIdService,
  getUsersSummaryService,
  listDirectoryUsersService,
  listUsersService,
  updateMeService,
  updateMyRoleService,
  updateUserService,
} from "./users.service.js";
import { AppError } from "../../common/errors/AppError.js";
import { removeLocalUploadByUrl, removeUploadedMulterFile } from "../../common/utils/upload-files.js";
import { findUserById } from "./users.repository.js";

function resolveBackendOrigin(req) {
  const apiUrl = process.env.API_URL?.trim();
  if (apiUrl) {
    return apiUrl.replace(/\/api\/v1\/?$/, "");
  }

  return `${req.protocol}://${req.get("host")}`;
}

export async function createUser(req, res) {
  const user = await createUserService(req.validated.body);
  res.status(201).json({ ok: true, data: user });
}

export async function getUserById(req, res) {
  const { id } = req.validated.params;
  const user = await getUserByIdService(id);
  res.json({ ok: true, data: user });
}

export async function listUsers(req, res) {
  const { page, limit, search, role, status } = req.validated.query;
  const result = await listUsersService({ page, limit, search, role, status });
  res.json({ ok: true, data: result });
}

export async function getUsersSummary(req, res) {
  const result = await getUsersSummaryService();
  res.json({ ok: true, data: result });
}

export async function updateUser(req, res) {
  const updated = await updateUserService(req.user.id, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data: updated });
}

export async function deleteUser(req, res) {
  const deleted = await deleteUserService(req.user.id, req.validated.params.id);
  res.json({ ok: true, data: deleted });
}

export async function deleteMe(req, res) {
  const deleted = await deleteMeService(req.user.id, req.validated.body);
  res.json({ ok: true, data: deleted });
}

export async function updateMe(req, res) {
  const updated = await updateMeService(req.user.id, req.validated.body);
  res.json({ ok: true, data: updated });
}

export async function updateMeAvatar(req, res) {
  try {
    if (!req.file) {
      throw new AppError("Upload a profile photo first.", 422, "AVATAR_FILE_REQUIRED");
    }

    const existing = await findUserById(req.user.id);
    const avatarUrl = `${resolveBackendOrigin(req)}/uploads/avatars/${req.file.filename}`;
    const updated = await updateMeService(req.user.id, { avatarUrl });
    await removeLocalUploadByUrl(existing?.avatarUrl, "avatars");
    res.json({ ok: true, data: updated });
  } catch (error) {
    await removeUploadedMulterFile(req.file);
    throw error;
  }
}

export async function removeMeAvatar(req, res) {
  const existing = await findUserById(req.user.id);
  const updated = await updateMeService(req.user.id, { avatarUrl: null });
  await removeLocalUploadByUrl(existing?.avatarUrl, "avatars");
  res.json({ ok: true, data: updated });
}

export async function updateMyRole(req, res) {
  const updated = await updateMyRoleService(req.user.id, req.validated.body);
  res.json({ ok: true, data: updated });
}

export async function listDirectoryUsers(req, res) {
  const result = await listDirectoryUsersService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

export async function getDirectoryUserById(req, res) {
  const result = await getDirectoryUserByIdService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}
