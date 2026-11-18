/**
 * Drive (MySQL) : envois par morceaux, flux de téléchargement, corbeille,
 * déplacement, copie et actions groupées.
 */
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { appendFile, copyFile, mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { Readable } from "node:stream";
import { z } from "zod";
import { mysqlQuery, mysqlTransaction } from "./mysql.mjs";
import { HttpError } from "./errors.mjs";
import { deletePrivateFile, resolveSafeStoragePath } from "./storage";

export const CHUNK_BYTES = 5 * 1024 * 1024;
const TRASH_RETENTION_DAYS = 30;

export function maxDriveFileBytes() {
  const n = Number(process.env.MAX_DRIVE_FILE_BYTES || 10 * 1024 * 1024 * 1024);
  return Number.isFinite(n) && n > 0 ? n : 10 * 1024 * 1024 * 1024;
}

export type DriveEntry = {
  id: string;
  parentId: string | null;
  name: string;
  type: "folder" | "file";
  mimeType: string | null;
  size: number;
  starred: boolean;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  trashedAt: string | null;
  creatorName: string | null;
  childCount: number;
  url: string | null;
};

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(v as string | Date).toISOString() : null);

function toEntry(r: Row): DriveEntry {
  const type = r.type === "folder" ? "folder" : "file";
  return {
    id: String(r.id),
    parentId: r.parent_id ? String(r.parent_id) : null,
    name: String(r.name),
    type,
    mimeType: r.mime_type ? String(r.mime_type) : null,
    size: Number(r.size || 0),
    starred: Boolean(Number(r.starred)),
    color: r.color ? String(r.color) : null,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
    trashedAt: iso(r.trashed_at),
    creatorName: r.creator_name ? String(r.creator_name) : null,
    childCount: Number(r.child_count || 0),
    url: type === "file" ? `/api/drive2/file/${r.id}` : null,
  };
}

/** Nom de fichier sûr : on garde le nom choisi, sans séparateur de chemin ni caractère de contrôle. */
export function cleanName(raw: string) {
  const name = String(raw ?? "")
    .replace(/[\\/\u0000-\u001f\u007f]/g, "_")
    .replace(/^\.+$/, "_")
    .trim()
    .slice(0, 255);
  if (!name) throw new HttpError(422, "Nom requis.");
  return name;
}

const KIND_EXT: Record<string, string[]> = {
  pdf: [".pdf"],
  doc: [".doc", ".docx", ".odt", ".rtf", ".txt", ".md", ".pages"],
  sheet: [".xls", ".xlsx", ".csv", ".ods", ".numbers"],
  slide: [".ppt", ".pptx", ".odp", ".key"],
  image: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".heic", ".bmp", ".tif", ".tiff", ".avif"],
  video: [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv"],
  audio: [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"],
  archive: [".zip", ".rar", ".7z", ".tar", ".gz"],
};
export function fileKind(name: string, mime: string | null) {
  const ext = extname(name).toLowerCase();
  for (const [k, list] of Object.entries(KIND_EXT)) if (list.includes(ext)) return k;
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  return "other";
}

const BASE_SELECT = `
  SELECT d.id, d.parent_id, d.name, d.type, d.mime_type, d.size, d.starred, d.color, d.created_at, d.updated_at,
         d.trashed_at, u.name AS creator_name,
         (SELECT COUNT(*) FROM drive_items c WHERE c.parent_id = d.id AND c.trashed_at IS NULL) AS child_count
  FROM drive_items d LEFT JOIN users u ON u.id = d.created_by`;

async function purgeExpiredTrash() {
  const roots = (await mysqlQuery(
    `SELECT id FROM drive_items WHERE trash_root_id = id AND trashed_at < (UTC_TIMESTAMP(3) - INTERVAL ${TRASH_RETENTION_DAYS} DAY) LIMIT 50`,
  )) as Row[];
  if (roots.length) await purge(roots.map((r) => String(r.id)));
}

async function breadcrumbsFor(folderId: string | null) {
  const trail: { id: string | null; name: string }[] = [];
  let cur = folderId;
  for (let i = 0; cur && i < 40; i++) {
    const r = ((await mysqlQuery("SELECT id, name, parent_id FROM drive_items WHERE id = ?", [cur])) as Row[])[0];
    if (!r) break;
    trail.unshift({ id: String(r.id), name: String(r.name) });
    cur = r.parent_id ? String(r.parent_id) : null;
  }
  return [{ id: null, name: "Mon Drive" }, ...trail];
}

export async function listDrive(opts: { view?: string; parentId?: string | null; q?: string; kind?: string }) {
  await purgeExpiredTrash().catch(() => {});
  const view = opts.view ?? "folder";
  const parentId = opts.parentId && opts.parentId !== "root" ? opts.parentId : null;
  let rows: Row[];
  if (opts.q?.trim()) {
    rows = (await mysqlQuery(`${BASE_SELECT} WHERE d.trashed_at IS NULL AND LOWER(d.name) LIKE ? ORDER BY (d.type = 'folder') DESC, d.name LIMIT 500`, [
      `%${opts.q.trim().toLowerCase()}%`,
    ])) as Row[];
  } else if (view === "trash") {
    rows = (await mysqlQuery(`${BASE_SELECT} WHERE d.trash_root_id = d.id ORDER BY d.trashed_at DESC LIMIT 1000`)) as Row[];
  } else if (view === "starred") {
    rows = (await mysqlQuery(`${BASE_SELECT} WHERE d.trashed_at IS NULL AND d.starred = 1 ORDER BY (d.type = 'folder') DESC, d.name`)) as Row[];
  } else if (view === "recent") {
    rows = (await mysqlQuery(
      `${BASE_SELECT} WHERE d.trashed_at IS NULL AND d.type = 'file' ORDER BY d.updated_at DESC LIMIT 100`,
    )) as Row[];
  } else {
    rows = (await mysqlQuery(
      `${BASE_SELECT} WHERE d.trashed_at IS NULL AND ${parentId ? "d.parent_id = ?" : "d.parent_id IS NULL"}
       ORDER BY (d.type = 'folder') DESC, d.name`,
      parentId ? [parentId] : [],
    )) as Row[];
  }
  let items = rows.map(toEntry);
  if (opts.kind && opts.kind !== "all")
    items = items.filter((i) => (opts.kind === "folder" ? i.type === "folder" : i.type === "file" && fileKind(i.name, i.mimeType) === opts.kind));

  const [tree, stats] = await Promise.all([
    mysqlQuery(
      `SELECT d.id, d.name, d.parent_id, d.color,
              (SELECT COUNT(*) FROM drive_items c WHERE c.parent_id = d.id AND c.trashed_at IS NULL) AS item_count
       FROM drive_items d WHERE d.type = 'folder' AND d.trashed_at IS NULL ORDER BY d.name`,
    ) as Promise<Row[]>,
    mysqlQuery(
      `SELECT SUM(type = 'file' AND trashed_at IS NULL) AS files, SUM(type = 'folder' AND trashed_at IS NULL) AS folders,
              COALESCE(SUM(CASE WHEN type = 'file' AND trashed_at IS NULL THEN size ELSE 0 END), 0) AS bytes,
              COALESCE(SUM(CASE WHEN type = 'file' AND trashed_at IS NOT NULL THEN size ELSE 0 END), 0) AS trash_bytes,
              SUM(trash_root_id = id) AS trash_count
       FROM drive_items`,
    ) as Promise<Row[]>,
  ]);
  return {
    items,
    breadcrumbs: view === "folder" && !opts.q ? await breadcrumbsFor(parentId) : [],
    tree: tree.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      parentId: r.parent_id ? String(r.parent_id) : null,
      color: r.color ? String(r.color) : null,
      itemCount: Number(r.item_count || 0),
    })),
    stats: {
      files: Number(stats[0]?.files || 0),
      folders: Number(stats[0]?.folders || 0),
      bytes: Number(stats[0]?.bytes || 0),
      trashBytes: Number(stats[0]?.trash_bytes || 0),
      trashCount: Number(stats[0]?.trash_count || 0),
    },
    limits: { chunkBytes: CHUNK_BYTES, maxFileBytes: maxDriveFileBytes(), trashRetentionDays: TRASH_RETENTION_DAYS },
  };
}

async function assertFolder(id: string | null) {
  if (!id) return;
  const r = ((await mysqlQuery("SELECT type, trashed_at FROM drive_items WHERE id = ?", [id])) as Row[])[0];
  if (!r || r.type !== "folder" || r.trashed_at) throw new HttpError(404, "Dossier de destination introuvable.");
}

const idList = z.array(z.string().uuid()).min(1).max(500);
const parentInput = z.string().uuid().nullable().optional();

export async function createFolder2(raw: unknown, userId: string) {
  const x = z.object({ name: z.string().max(255), parentId: parentInput, color: z.string().max(32).nullable().optional() }).parse(raw);
  await assertFolder(x.parentId ?? null);
  const id = randomUUID();
  await mysqlQuery("INSERT INTO drive_items (id, name, type, parent_id, color, created_by) VALUES (?, ?, 'folder', ?, ?, ?)", [
    id,
    cleanName(x.name),
    x.parentId ?? null,
    x.color ?? null,
    userId,
  ]);
  return { ok: true, id };
}

/* ------------------------------------------------------------------ Envois */

function newStoragePath(name: string) {
  const ext = extname(name).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 16);
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `drive/${ym}/${randomUUID()}${ext}`;
}

export async function startUpload(raw: unknown, userId: string) {
  const x = z
    .object({
      name: z.string().max(255),
      size: z.number().int().min(0),
      mimeType: z.string().max(150).optional(),
      parentId: parentInput,
    })
    .parse(raw);
  if (x.size > maxDriveFileBytes())
    throw new HttpError(413, `Fichier trop volumineux (limite ${Math.round(maxDriveFileBytes() / 1024 ** 3)} Go).`);
  await assertFolder(x.parentId ?? null);
  const id = randomUUID();
  const tempPath = `tmp/${id}.part`;
  const full = resolveSafeStoragePath(tempPath);
  await mkdir(resolve(full, ".."), { recursive: true });
  await writeFile(full, Buffer.alloc(0), { mode: 0o600 });
  await mysqlQuery(
    "INSERT INTO drive_uploads (id, user_id, parent_id, name, mime_type, size, temp_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, userId, x.parentId ?? null, cleanName(x.name), (x.mimeType || "application/octet-stream").slice(0, 150), x.size, tempPath],
  );
  // Nettoie les envois abandonnés depuis plus d'un jour.
  const stale = (await mysqlQuery(
    "SELECT id, temp_path FROM drive_uploads WHERE created_at < (UTC_TIMESTAMP(3) - INTERVAL 1 DAY) LIMIT 20",
  )) as Row[];
  for (const s of stale) {
    await deletePrivateFile(String(s.temp_path));
    await mysqlQuery("DELETE FROM drive_uploads WHERE id = ?", [s.id as string]);
  }
  return { uploadId: id, chunkBytes: CHUNK_BYTES };
}

async function getUpload(id: string, userId: string) {
  z.string().uuid().parse(id);
  const u = ((await mysqlQuery("SELECT * FROM drive_uploads WHERE id = ? AND user_id = ?", [id, userId])) as Row[])[0];
  if (!u) throw new HttpError(404, "Envoi introuvable ou expiré : relancez l'import.");
  return u;
}

export async function appendChunk(id: string, offset: number, body: ArrayBuffer, userId: string) {
  const u = await getUpload(id, userId);
  const received = Number(u.received);
  if (offset !== received) return { received, resync: true };
  const chunk = Buffer.from(body);
  if (chunk.byteLength > CHUNK_BYTES + 1024) throw new HttpError(413, "Morceau trop grand.");
  if (received + chunk.byteLength > Number(u.size)) throw new HttpError(422, "Le fichier dépasse la taille annoncée.");
  await appendFile(resolveSafeStoragePath(String(u.temp_path)), chunk);
  await mysqlQuery("UPDATE drive_uploads SET received = received + ? WHERE id = ?", [chunk.byteLength, id]);
  return { received: received + chunk.byteLength };
}

export async function finishUpload(raw: unknown, userId: string) {
  const { uploadId } = z.object({ uploadId: z.string().uuid() }).parse(raw);
  const u = await getUpload(uploadId, userId);
  const tempFull = resolveSafeStoragePath(String(u.temp_path));
  const actual = (await stat(tempFull)).size;
  if (actual !== Number(u.size)) throw new HttpError(422, "Envoi incomplet : relancez l'import.");
  const storagePath = newStoragePath(String(u.name));
  const finalFull = resolveSafeStoragePath(storagePath);
  await mkdir(resolve(finalFull, ".."), { recursive: true });
  await rename(tempFull, finalFull);
  const id = randomUUID();
  try {
    await mysqlQuery(
      `INSERT INTO drive_items (id, name, type, parent_id, mime_type, size, storage_path, created_by)
       VALUES (?, ?, 'file', ?, ?, ?, ?, ?)`,
      [id, u.name as string, (u.parent_id as string) ?? null, u.mime_type as string, actual, storagePath, userId],
    );
  } catch (e) {
    await unlink(finalFull).catch(() => {});
    throw e;
  }
  await mysqlQuery("DELETE FROM drive_uploads WHERE id = ?", [uploadId]);
  return { ok: true, id };
}

/* ----------------------------------------------------------- Téléchargement */

const INLINE_SAFE = /^(image\/(png|jpe?g|gif|webp|avif)|video\/|audio\/|application\/pdf|text\/plain)/;

export async function streamFile(id: string, rangeHeader: string | null, inline: boolean) {
  z.string().uuid().parse(id);
  const r = ((await mysqlQuery(
    "SELECT name, mime_type, size, storage_path, document_id FROM drive_items WHERE id = ? AND type = 'file'",
    [id],
  )) as Row[])[0];
  if (!r) throw new HttpError(404, "Fichier introuvable.");
  let storagePath = r.storage_path ? String(r.storage_path) : "";
  if (!storagePath && r.document_id) {
    const d = ((await mysqlQuery("SELECT storage_path FROM documents WHERE id = ?", [r.document_id as string])) as Row[])[0];
    storagePath = d ? String(d.storage_path) : "";
  }
  const full = resolveSafeStoragePath(storagePath);
  const size = (await stat(full).catch(() => {
    throw new HttpError(404, "Fichier physique introuvable.");
  })).size;
  const mime = String(r.mime_type || "application/octet-stream");
  const showInline = inline && INLINE_SAFE.test(mime);
  const name = String(r.name);
  const headers: Record<string, string> = {
    "Content-Type": showInline ? mime : "application/octet-stream",
    "Content-Disposition": `${showInline ? "inline" : "attachment"}; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'",
    "Cache-Control": "private, max-age=0",
    "Accept-Ranges": "bytes",
  };
  let start = 0;
  let end = size - 1;
  let status = 200;
  const m = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && size > 0) {
    if (m[1]) start = Number(m[1]);
    if (m[2]) end = Math.min(Number(m[2]), size - 1);
    if (!m[1] && m[2]) {
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    }
    if (start > end || start >= size) return { status: 416, headers: { "Content-Range": `bytes */${size}` }, body: null };
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = String(size === 0 ? 0 : end - start + 1);
  const body =
    size === 0 ? null : (Readable.toWeb(createReadStream(full, { start, end })) as unknown as ReadableStream<Uint8Array>);
  return { status, headers, body };
}

/* ------------------------------------------------------------- Opérations */

export async function updateItem(raw: unknown) {
  const x = z
    .object({
      ids: idList,
      name: z.string().max(255).optional(),
      starred: z.boolean().optional(),
      color: z.string().max(32).nullable().optional(),
    })
    .parse(raw);
  if (x.name !== undefined) {
    if (x.ids.length !== 1) throw new HttpError(422, "Renommez un élément à la fois.");
    await mysqlQuery("UPDATE drive_items SET name = ? WHERE id = ?", [cleanName(x.name), x.ids[0]]);
  }
  if (x.starred !== undefined)
    await mysqlQuery(`UPDATE drive_items SET starred = ? WHERE id IN (${x.ids.map(() => "?").join(",")})`, [
      x.starred ? 1 : 0,
      ...x.ids,
    ]);
  if (x.color !== undefined)
    await mysqlQuery(`UPDATE drive_items SET color = ? WHERE type = 'folder' AND id IN (${x.ids.map(() => "?").join(",")})`, [
      x.color,
      ...x.ids,
    ]);
  return { ok: true };
}

async function ancestorsOf(id: string | null) {
  const out = new Set<string>();
  let cur = id;
  for (let i = 0; cur && i < 60; i++) {
    out.add(cur);
    const r = ((await mysqlQuery("SELECT parent_id FROM drive_items WHERE id = ?", [cur])) as Row[])[0];
    cur = r?.parent_id ? String(r.parent_id) : null;
  }
  return out;
}

export async function moveItems(raw: unknown) {
  const x = z.object({ ids: idList, parentId: parentInput }).parse(raw);
  const target = x.parentId ?? null;
  await assertFolder(target);
  const chain = await ancestorsOf(target);
  if (x.ids.some((id) => chain.has(id))) throw new HttpError(422, "Impossible de déplacer un dossier dans lui-même.");
  await mysqlQuery(
    `UPDATE drive_items SET parent_id = ? WHERE trashed_at IS NULL AND id IN (${x.ids.map(() => "?").join(",")})`,
    [target, ...x.ids],
  );
  return { ok: true };
}

async function subtree(rootId: string) {
  const all: Row[] = [];
  let frontier = [rootId];
  const root = ((await mysqlQuery("SELECT * FROM drive_items WHERE id = ?", [rootId])) as Row[])[0];
  if (!root) return all;
  all.push(root);
  for (let depth = 0; frontier.length && depth < 60; depth++) {
    const kids = (await mysqlQuery(
      `SELECT * FROM drive_items WHERE parent_id IN (${frontier.map(() => "?").join(",")})`,
      frontier,
    )) as Row[];
    all.push(...kids);
    frontier = kids.filter((k) => k.type === "folder").map((k) => String(k.id));
  }
  return all;
}

function copyName(name: string) {
  const ext = extname(name);
  const base = ext && ext.length < name.length ? name.slice(0, -ext.length) : name;
  return `${base} (copie)${ext && ext.length < name.length ? ext : ""}`.slice(0, 255);
}

export async function copyItems(raw: unknown, userId: string) {
  const x = z.object({ ids: idList.max(100), parentId: parentInput, keepName: z.boolean().optional() }).parse(raw);
  if (x.parentId !== undefined) await assertFolder(x.parentId ?? null);
  const created: string[] = [];
  for (const rootId of x.ids) {
    const nodes = await subtree(rootId);
    if (!nodes.length || nodes[0].trashed_at) continue;
    const map = new Map<string, string>();
    for (const n of nodes) {
      const newId = randomUUID();
      map.set(String(n.id), newId);
      const isRoot = String(n.id) === rootId;
      const parent = isRoot
        ? x.parentId !== undefined
          ? x.parentId
          : (n.parent_id as string | null)
        : map.get(String(n.parent_id))!;
      let storagePath: string | null = null;
      if (n.type === "file") {
        let src = n.storage_path ? String(n.storage_path) : "";
        if (!src && n.document_id) {
          const d = ((await mysqlQuery("SELECT storage_path FROM documents WHERE id = ?", [n.document_id as string])) as Row[])[0];
          src = d ? String(d.storage_path) : "";
        }
        if (!src) continue;
        storagePath = newStoragePath(String(n.name));
        const dest = resolveSafeStoragePath(storagePath);
        await mkdir(resolve(dest, ".."), { recursive: true });
        await copyFile(resolveSafeStoragePath(src), dest);
      }
      const sameFolder = isRoot && (x.parentId === undefined || x.parentId === (n.parent_id ?? null));
      await mysqlQuery(
        `INSERT INTO drive_items (id, name, type, parent_id, mime_type, size, storage_path, color, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          isRoot && sameFolder && !x.keepName ? copyName(String(n.name)) : String(n.name),
          String(n.type),
          parent ?? null,
          (n.mime_type as string) ?? null,
          Number(n.size || 0),
          storagePath,
          (n.color as string) ?? null,
          userId,
        ],
      );
      if (isRoot) created.push(newId);
    }
  }
  return { ok: true, ids: created };
}

export async function trashItems(raw: unknown) {
  const { ids } = z.object({ ids: idList }).parse(raw);
  for (const id of ids) {
    const nodes = await subtree(id);
    if (!nodes.length || nodes[0].trashed_at) continue;
    const list = nodes.map((n) => String(n.id));
    await mysqlQuery(
      `UPDATE drive_items SET trashed_at = UTC_TIMESTAMP(3), trash_root_id = ? WHERE trashed_at IS NULL AND id IN (${list
        .map(() => "?")
        .join(",")})`,
      [id, ...list],
    );
  }
  return { ok: true };
}

export async function restoreItems(raw: unknown) {
  const { ids } = z.object({ ids: idList }).parse(raw);
  for (const id of ids) {
    const r = ((await mysqlQuery("SELECT parent_id FROM drive_items WHERE id = ? AND trash_root_id = id", [id])) as Row[])[0];
    if (!r) continue;
    // Si le dossier d'origine n'existe plus ou est lui-même à la corbeille, on restaure à la racine.
    let parent = r.parent_id ? String(r.parent_id) : null;
    if (parent) {
      const p = ((await mysqlQuery("SELECT trashed_at FROM drive_items WHERE id = ?", [parent])) as Row[])[0];
      if (!p || p.trashed_at) parent = null;
    }
    await mysqlTransaction(async (conn) => {
      await conn.execute("UPDATE drive_items SET trashed_at = NULL, trash_root_id = NULL WHERE trash_root_id = ?", [id]);
      await conn.execute("UPDATE drive_items SET parent_id = ? WHERE id = ?", [parent, id]);
    });
  }
  return { ok: true };
}

async function purge(rootIds: string[]) {
  for (const id of rootIds) {
    const nodes = (await mysqlQuery("SELECT id, storage_path, document_id FROM drive_items WHERE trash_root_id = ?", [id])) as Row[];
    for (const n of nodes) {
      if (n.storage_path) await deletePrivateFile(String(n.storage_path));
      if (n.document_id) {
        const d = ((await mysqlQuery("SELECT storage_path FROM documents WHERE id = ?", [n.document_id as string])) as Row[])[0];
        if (d?.storage_path) await deletePrivateFile(String(d.storage_path));
      }
    }
    await mysqlTransaction(async (conn) => {
      const docIds = nodes.filter((n) => n.document_id).map((n) => String(n.document_id));
      await conn.execute("DELETE FROM drive_items WHERE id = ?", [id]); // cascade sur les descendants
      for (const d of docIds) await conn.execute("DELETE FROM documents WHERE id = ? AND client_id IS NULL", [d]);
    });
  }
}

export async function purgeItems(raw: unknown) {
  const { ids } = z.object({ ids: idList }).parse(raw);
  const roots = (await mysqlQuery(
    `SELECT id FROM drive_items WHERE trash_root_id = id AND id IN (${ids.map(() => "?").join(",")})`,
    ids,
  )) as Row[];
  await purge(roots.map((r) => String(r.id)));
  return { ok: true, purged: roots.length };
}

export async function emptyTrash() {
  const roots = (await mysqlQuery("SELECT id FROM drive_items WHERE trash_root_id = id")) as Row[];
  await purge(roots.map((r) => String(r.id)));
  return { ok: true, purged: roots.length };
}
