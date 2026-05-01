import fs from "node:fs/promises";
import path from "node:path";

const uploadsRoot = path.resolve(process.cwd(), "uploads");

async function removeFile(filePath) {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("Failed to remove upload file:", filePath, error);
    }
  }
}

/**
 * Removes a file that was uploaded via Multer.
 * @param {import('multer').File} file - The Multer file object.
 */
export async function removeUploadedMulterFile(file) {
  if (!file?.path) return;
  await removeFile(file.path);
}

/**
 * Resolves a local filesystem path from a public upload URL.
 * @param {string} url - The public URL of the uploaded file.
 * @param {string} folderName - The upload subdirectory name.
 * @returns {string|null} The resolved absolute path, or null if invalid.
 */
export function resolveLocalUploadPathFromUrl(url, folderName) {
  const normalizedUrl = String(url ?? "").trim();
  if (!normalizedUrl) return null;

  const marker = `/uploads/${folderName}/`;
  const markerIndex = normalizedUrl.indexOf(marker);
  if (markerIndex === -1) return null;

  const fileName = normalizedUrl.slice(markerIndex + marker.length).split(/[?#]/, 1)[0];
  if (!fileName || fileName.includes("..") || path.basename(fileName) !== fileName) {
    return null;
  }

  return path.resolve(uploadsRoot, folderName, fileName);
}

/**
 * Deletes a locally stored upload file given its public URL.
 * @param {string} url - The public URL of the uploaded file.
 * @param {string} folderName - The upload subdirectory name.
 */
export async function removeLocalUploadByUrl(url, folderName) {
  const filePath = resolveLocalUploadPathFromUrl(url, folderName);
  await removeFile(filePath);
}
