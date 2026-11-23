/**
 * Import initial des élèves en cours, de leurs pièces et du planning.
 *
 * 1. `importPlan` crée (ou retrouve) les élèves et les séances en une fois.
 * 2. `importDocument` récupère une pièce depuis le lien Google Drive partagé
 *    et la range dans le dossier de l'élève — appelé pièce par pièce par
 *    l'écran d'import pour afficher la progression.
 * Tout est rejouable : un élément déjà importé n'est jamais dupliqué.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { z } from "zod";
import { isMysqlMode, mysqlQuery, mysqlTransaction } from "./mysql.mjs";
import { HttpError } from "./errors.mjs";
import { resolveSafeStoragePath } from "./storage";
import { CLIENT_CATEGORY_IDS } from "../lib/client-categories";

type Row = Record<string, unknown>;
const str = (max: number) => z.string().trim().max(max);

const documentInput = z.object({
  driveId: z.string().regex(/^[A-Za-z0-9_-]{10,100}$/),
  name: str(255).min(1),
  folder: str(200).optional(),
});

const planInput = z.object({
  version: z.literal(1),
  clients: z
    .array(
      z.object({
        key: str(120).min(1),
        firstName: str(100).min(1),
        lastName: str(100).min(1),
        phone: str(30).optional(),
        email: str(254).optional(),
        address: str(255).optional(),
        birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        neph: str(20).optional(),
        category: z.enum(CLIENT_CATEGORY_IDS).optional(),
        notes: str(5000).optional(),
        documents: z.array(documentInput).max(200).default([]),
      }),
    )
    .max(2000),
  bookings: z
    .array(
      z.object({
        ref: str(120).min(1),
        clientKey: str(120).min(1),
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
        gearbox: z.enum(["BM", "BA"]).optional(),
        vehicleHint: str(60).optional(),
        instructor: str(150).optional(),
        kind: z.enum(["lesson", "rental", "exam"]).default("rental"),
        note: str(1000).optional(),
      }),
    )
    .max(5000)
    .default([]),
});

/** Date locale Europe/Paris « AAAA-MM-JJTHH:MM » → instant UTC. */
function parisToUtc(local: string) {
  const guess = new Date(`${local}:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asParis = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  return new Date(guess.getTime() - (asParis - guess.getTime()));
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export async function importPlan(raw: unknown, userId: string) {
  if (!isMysqlMode()) throw new HttpError(501, "Import disponible avec la base MySQL.");
  const x = planInput.parse(raw);

  const vehicles = (await mysqlQuery("SELECT id, label, model_id, registration_number, model FROM vehicles WHERE active = 1")) as Row[];
  const instructors = (await mysqlQuery("SELECT id, name FROM instructors WHERE active = 1")) as Row[];
  const existing = (await mysqlQuery("SELECT id, first_name, last_name, import_key FROM clients")) as Row[];

  const keyToId = new Map<string, string>();
  const report = { clientsCreated: 0, clientsExisting: 0, bookingsCreated: 0, bookingsSkipped: 0, warnings: [] as string[] };

  await mysqlTransaction(async (conn) => {
    for (const c of x.clients) {
      const match =
        existing.find((e) => e.import_key === c.key) ??
        existing.find((e) => norm(`${e.first_name} ${e.last_name}`) === norm(`${c.firstName} ${c.lastName}`));
      if (match) {
        keyToId.set(c.key, String(match.id));
        report.clientsExisting++;
        // Complète seulement les champs vides, sans écraser une saisie.
        await conn.execute(
          `UPDATE clients SET import_key = COALESCE(import_key, ?),
             email = COALESCE(email, ?), address = COALESCE(address, ?), birth_date = COALESCE(birth_date, ?),
             neph = COALESCE(neph, ?), category = COALESCE(category, ?),
             phone = CASE WHEN phone = '' THEN ? ELSE phone END
           WHERE id = ?`,
          [c.key, c.email || null, c.address || null, c.birthDate || null, c.neph || null, c.category || null, c.phone || "", String(match.id)],
        );
        continue;
      }
      const id = randomUUID();
      await conn.execute(
        `INSERT INTO clients (id, first_name, last_name, phone, email, address, birth_date, neph, category, notes, source, status, import_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Import Google Drive', 'Actif', ?)`,
        [
          id,
          c.firstName,
          c.lastName,
          c.phone || "",
          c.email || null,
          c.address || null,
          c.birthDate || null,
          c.neph || null,
          c.category || null,
          c.notes || null,
          c.key,
        ],
      );
      keyToId.set(c.key, id);
      existing.push({ id, first_name: c.firstName, last_name: c.lastName, import_key: c.key });
      report.clientsCreated++;
    }

    const now = Date.now();
    for (const b of x.bookings) {
      const clientId = keyToId.get(b.clientKey);
      if (!clientId) {
        report.warnings.push(`Séance ${b.ref} : élève inconnu (${b.clientKey}).`);
        continue;
      }
      const [dup] = await conn.execute("SELECT id FROM bookings WHERE import_ref = ?", [b.ref]);
      if ((dup as unknown[]).length) {
        report.bookingsSkipped++;
        continue;
      }
      const hint = b.vehicleHint ? norm(b.vehicleHint) : "";
      const vehicle =
        (hint &&
          vehicles.find((v) =>
            [v.label, v.model, v.registration_number].some((t) => t && norm(String(t)).includes(hint)),
          )) ||
        vehicles.find((v) => (b.gearbox === "BA" ? v.model_id === "clio-auto" : b.gearbox === "BM" ? v.model_id === "clio-manual" : false)) ||
        vehicles[0];
      if (!vehicle) throw new HttpError(422, "Ajoutez au moins un véhicule actif avant l'import du planning.");
      const instructor = b.instructor
        ? instructors.find((i) => norm(String(i.name)).includes(norm(b.instructor!)))
        : undefined;
      if (b.instructor && !instructor) report.warnings.push(`Séance ${b.ref} : moniteur « ${b.instructor} » introuvable, séance sans moniteur.`);
      const start = parisToUtc(b.start);
      const end = parisToUtc(b.end);
      const minutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
      const past = end.getTime() < now;
      await conn.execute(
        `INSERT INTO bookings (id, service_id, client_id, vehicle_id, instructor_id, start_at, end_at, minutes, status, notes,
                               session_kind, import_ref, request_id, created_by, completed_by, completed_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          clientId,
          String(vehicle.id),
          instructor ? String(instructor.id) : null,
          start,
          end,
          minutes,
          past ? "completed" : "confirmed",
          b.note || null,
          b.kind,
          b.ref,
          randomUUID(),
          userId,
          past ? userId : null,
          past ? end : null,
        ],
      );
      report.bookingsCreated++;
    }
    await conn.execute(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, 'import.plan', 'import', 'drive', ?)`,
      [randomUUID(), userId, JSON.stringify({ ...report, warnings: report.warnings.length })],
    );
  });

  // Pièces restant à récupérer (celles déjà importées sont ignorées).
  const done = new Set(
    ((await mysqlQuery("SELECT import_ref FROM documents WHERE import_ref IS NOT NULL")) as Row[]).map((r) => String(r.import_ref)),
  );
  const documents = x.clients.flatMap((c) =>
    c.documents
      .filter((d) => !done.has(d.driveId))
      .map((d) => ({ clientId: keyToId.get(c.key)!, clientName: `${c.firstName} ${c.lastName}`, ...d })),
  );
  return { ok: true, report, documents };
}

const MAGIC: [RegExp | ((b: Buffer) => boolean), string, string][] = [
  [(b) => b.subarray(0, 4).toString("latin1") === "%PDF", "application/pdf", ".pdf"],
  [(b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, "image/jpeg", ".jpg"],
  [(b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png", ".png"],
  [(b) => b.subarray(4, 12).toString("latin1").includes("ftypheic") || b.subarray(4, 12).toString("latin1").includes("ftypmif1"), "image/heic", ".heic"],
  [(b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP", "image/webp", ".webp"],
];
const EXT_MIME: Record<string, string> = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".doc": "application/msword",
};

export async function importDocument(raw: unknown, userId: string) {
  if (!isMysqlMode()) throw new HttpError(501, "Import disponible avec la base MySQL.");
  const x = documentInput.extend({ clientId: z.uuid() }).parse(raw);
  const [already] = (await mysqlQuery("SELECT id FROM documents WHERE import_ref = ? LIMIT 1", [x.driveId])) as Row[];
  if (already) return { ok: true, status: "deja-importe" };
  const client = ((await mysqlQuery("SELECT id FROM clients WHERE id = ?", [x.clientId])) as Row[])[0];
  if (!client) throw new HttpError(404, "Élève introuvable.");

  const res = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(x.driveId)}&export=download&confirm=t`, {
    redirect: "follow",
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new HttpError(502, `Google Drive a répondu ${res.status} pour « ${x.name} ».`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 200 * 1024 * 1024) throw new HttpError(413, "Pièce trop volumineuse.");
  const textStart = buf.subarray(0, 200).toString("latin1").trimStart().toLowerCase();
  if (textStart.startsWith("<!doctype html") || textStart.startsWith("<html"))
    return { ok: true, status: "document-google", message: "Document Google Docs : non transférable, à régénérer depuis le CRM." };

  let mime = "application/octet-stream";
  let ext = extname(x.name).toLowerCase().slice(0, 10);
  for (const [test, m, e] of MAGIC)
    if (typeof test === "function" && test(buf)) {
      mime = m;
      if (!ext || ext === ".jpeg" || !Object.keys(EXT_MIME).includes(ext)) ext = ext === ".jpeg" ? ".jpeg" : e;
      break;
    }
  if (mime === "application/octet-stream" && EXT_MIME[ext]) mime = EXT_MIME[ext];
  const displayName = extname(x.name) ? x.name : `${x.name}${ext}`;

  // Sous-dossier de l'élève (« CNI », « Permis accompagnateur »…).
  let folderId: string | null = null;
  if (x.folder) {
    const f = ((await mysqlQuery("SELECT id FROM client_folders WHERE client_id = ? AND parent_id IS NULL AND name = ? LIMIT 1", [
      x.clientId,
      x.folder,
    ])) as Row[])[0];
    folderId = f ? String(f.id) : randomUUID();
    if (!f)
      await mysqlQuery("INSERT INTO client_folders (id, client_id, parent_id, name, created_by) VALUES (?, ?, NULL, ?, ?)", [
        folderId,
        x.clientId,
        x.folder,
        userId,
      ]);
  }

  const now = new Date();
  const storedName = `${randomUUID()}${ext || ".bin"}`;
  const storagePath = `documents/${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}/${storedName}`;
  const full = resolveSafeStoragePath(storagePath);
  await mkdir(resolve(full, ".."), { recursive: true });
  await writeFile(full, buf, { mode: 0o600 });
  await mysqlQuery(
    `INSERT INTO documents (id, client_id, folder_id, uploaded_by, original_name, stored_name, storage_path, mime_type, file_size, is_private, import_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [randomUUID(), x.clientId, folderId, userId, displayName.slice(0, 255), storedName, storagePath, mime, buf.byteLength, x.driveId],
  );
  return { ok: true, status: "importe", size: buf.byteLength };
}
