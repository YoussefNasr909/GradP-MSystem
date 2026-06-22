import path from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
export const fixtureDir = path.resolve(thisDir, "../fixtures");

export const uploadFixtures = {
  validText: path.join(fixtureDir, "valid-note.txt"),
  validPdf: path.join(fixtureDir, "valid-document.pdf"),
  invalidExe: path.join(fixtureDir, "invalid.exe"),
  oversizedBin: path.join(fixtureDir, "oversized.bin"),
};

