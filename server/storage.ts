import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, extname, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { HttpError } from "./errors.mjs";

export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".webp": ["image/webp"],
  ".txt": ["text/plain"],
  ".csv": ["text/csv", "application/csv", "text/plain"],
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],
};

export function maxUploadBytes(): number {
  const n = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);
  return Number.isFinite(n) && n > 0 ? n : 10 * 1024 * 1024;
}

/**
 * Dossier de stockage des fichiers.
 * En production sans STORAGE_DIR, on stocke HORS du dossier de la version
 * déployée (sinon chaque redéploiement Hostinger efface les fichiers) :
 * ~/gopermis-data/uploads.
 */
export function getStorageRoot(): string {
  const explicit = (process.env.STORAGE_DIR || "").trim();
  const home = (process.env.HOME || "").trim();
  const persistentBase = process.env.NODE_ENV === "production" && home ? resolve(home, "gopermis-data") : process.cwd();
  // Un chemin relatif est résolu dans le dossier persistant (jamais dans la version déployée).
  const root = explicit
    ? resolve(persistentBase, explicit)
    : persistentBase === process.cwd()
      ? resolve(process.cwd(), ".data/uploads")
      : resolve(persistentBase, "uploads");
  const publicDir = resolve(process.cwd(), "public");
  if (root === publicDir || root.startsWith(publicDir + sep)) {
    throw new HttpError(
      500,
      "Configuration invalide : STORAGE_DIR ne doit jamais être dans public/.",
      "INVALID_STORAGE_CONFIG",
    );
  }
  return root;
}

export function sanitizeOriginalFilename(rawName: string): string {
  if (typeof rawName !== "string") {
    throw new HttpError(400, "Nom de fichier requis.", "INVALID_FILENAME");
  }
  const trimmed = rawName.trim();
  if (!trimmed || trimmed.length > 255) {
    throw new HttpError(400, "Nom de fichier invalide.", "INVALID_FILENAME");
  }
  if (
    trimmed.includes("..") ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("\0") ||
    /[\x00-\x1f\x7f]/.test(trimmed)
  ) {
    throw new HttpError(
      400,
      "Nom de fichier dangereux refusé.",
      "UNSAFE_FILENAME",
    );
  }
  const base = basename(trimmed);
  if (!base || base !== trimmed || base.startsWith(".")) {
    throw new HttpError(400, "Nom de fichier invalide.", "INVALID_FILENAME");
  }
  return base;
}

export function validateFilePayload(
  originalName: string,
  mimeType: string,
  buffer: Buffer,
) {
  const safeName = sanitizeOriginalFilename(originalName);
  const ext = extname(safeName).toLowerCase();
  const allowedMimes = ALLOWED_MIME_TYPES[ext];
  if (!allowedMimes) {
    throw new HttpError(
      415,
      `Extension de fichier non autorisée (${ext || "aucune"}).`,
      "UNSUPPORTED_FILE_TYPE",
    );
  }

  const normalizedMime = (mimeType || "").split(";")[0].trim().toLowerCase();
  if (!normalizedMime || !allowedMimes.includes(normalizedMime)) {
    throw new HttpError(
      415,
      `Type MIME non autorisé ou incompatible avec l'extension (${normalizedMime || "inconnu"}).`,
      "UNSUPPORTED_MIME_TYPE",
    );
  }

  const maxBytes = maxUploadBytes();
  if (buffer.byteLength === 0) {
    throw new HttpError(400, "Le fichier est vide.", "EMPTY_FILE");
  }
  if (buffer.byteLength > maxBytes) {
    throw new HttpError(
      413,
      `Fichier trop volumineux (max ${Math.round(maxBytes / (1024 * 1024))} Mo).`,
      "FILE_TOO_LARGE",
    );
  }

  // Vérification des signatures magiques pour les formats binaires courants
  if (ext === ".pdf" && buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new HttpError(415, "Signature PDF invalide.", "INVALID_FILE_SIGNATURE");
  }
  if (
    ext === ".png" &&
    !buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    throw new HttpError(415, "Signature PNG invalide.", "INVALID_FILE_SIGNATURE");
  }
  if (
    (ext === ".jpg" || ext === ".jpeg") &&
    !(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
  ) {
    throw new HttpError(415, "Signature JPEG invalide.", "INVALID_FILE_SIGNATURE");
  }
  if (
    ext === ".webp" &&
    !(
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    )
  ) {
    throw new HttpError(415, "Signature WEBP invalide.", "INVALID_FILE_SIGNATURE");
  }
  if (
    (ext === ".docx" || ext === ".xlsx") &&
    !(buffer[0] === 0x50 && buffer[1] === 0x4b)
  ) {
    throw new HttpError(415, "Signature Office invalide.", "INVALID_FILE_SIGNATURE");
  }

  return { safeName, ext, normalizedMime, fileSize: buffer.byteLength };
}

export function resolveSafeStoragePath(storagePath: string): string {
  if (!storagePath || storagePath.includes("\0") || storagePath.includes("..")) {
    throw new HttpError(400, "Chemin de stockage invalide.", "INVALID_STORAGE_PATH");
  }
  const root = getStorageRoot();
  const full = resolve(root, storagePath);
  const rel = relative(root, full);
  if (!rel || rel.startsWith("..") || rel.includes(`..${sep}`)) {
    throw new HttpError(403, "Accès chemin refusé.", "PATH_TRAVERSAL_BLOCKED");
  }
  return full;
}

export async function savePrivateFile(
  originalName: string,
  mimeType: string,
  buffer: Buffer,
  namespace = "documents",
): Promise<{
  originalName: string;
  storedName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
}> {
  const { safeName, ext, normalizedMime, fileSize } = validateFilePayload(
    originalName,
    mimeType,
    buffer,
  );
  const safeNamespace = namespace.replace(/[^a-zA-Z0-9_-]/g, "") || "documents";
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const storedName = `${randomUUID()}${ext}`;
  const relPath = `${safeNamespace}/${ym}/${storedName}`;
  const fullPath = resolveSafeStoragePath(relPath);

  await mkdir(resolve(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, buffer, { flag: "wx", mode: 0o600 });

  return {
    originalName: safeName,
    storedName,
    storagePath: relPath,
    mimeType: normalizedMime,
    fileSize,
  };
}

export async function readPrivateFile(storagePath: string): Promise<Buffer> {
  const fullPath = resolveSafeStoragePath(storagePath);
  try {
    return await readFile(fullPath);
  } catch {
    throw new HttpError(404, "Fichier physique introuvable.", "FILE_NOT_FOUND");
  }
}

export async function deletePrivateFile(storagePath: string): Promise<void> {
  if (!storagePath) return;
  try {
    const fullPath = resolveSafeStoragePath(storagePath);
    await unlink(fullPath);
  } catch {
    // Ignore if already missing on disk
  }
}

export function decodeBase64DataUrl(raw: string): {
  buffer: Buffer;
  detectedMime?: string;
} {
  if (typeof raw !== "string" || !raw) {
    throw new HttpError(400, "Contenu de fichier manquant.", "EMPTY_FILE");
  }
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      detectedMime: match[1],
      buffer: Buffer.from(match[2], "base64"),
    };
  }
  return {
    buffer: Buffer.from(raw, "base64"),
  };
}
