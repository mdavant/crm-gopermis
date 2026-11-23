/**
 * Fiche de location et attestation d'assurance générées depuis la fiche élève.
 * Le PDF est rangé dans les documents de l'élève et tracé dans generated_documents.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isMysqlMode, mysqlQuery, mysqlTransaction } from "./mysql.mjs";
import { HttpError } from "./errors.mjs";
import { deletePrivateFile, savePrivateFile } from "./storage";
import { buildInsurancePdf, buildRentalPdf, rentalDurationMinutes } from "./contract-pdf";

type Row = Record<string, unknown>;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide");

const input = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rental"),
    vehicleId: z.uuid(),
    bookingId: z.uuid().optional(),
    signatureDate: isoDate,
    startDate: isoDate,
    startTime: hhmm,
    endDate: isoDate,
    endTime: hhmm,
    hourlyCents: z.number().int().min(0).max(1000000).nullable().optional(),
    totalCents: z.number().int().min(0).max(100000000),
  }),
  z.object({
    kind: z.literal("insurance"),
    vehicleId: z.uuid(),
    bookingId: z.uuid().optional(),
    signatureDate: isoDate,
  }),
]);

const dateOnly = (v: unknown) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null);
const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export async function generateClientDocument(clientId: string, raw: unknown, userId: string) {
  if (!isMysqlMode()) throw new HttpError(501, "Génération disponible avec la base MySQL.");
  z.uuid().parse(clientId);
  const x = input.parse(raw);
  const c = ((await mysqlQuery("SELECT * FROM clients WHERE id = ?", [clientId])) as Row[])[0];
  if (!c) throw new HttpError(404, "Élève introuvable.");
  const v = ((await mysqlQuery(
    `SELECT v.*, m.label AS model_label FROM vehicles v JOIN vehicle_models m ON m.id = v.model_id WHERE v.id = ?`,
    [x.vehicleId],
  )) as Row[])[0];
  if (!v) throw new HttpError(404, "Véhicule introuvable.");
  const vehicle = {
    brand: (v.brand as string) || "RENAULT",
    model: (v.model as string) || (v.model_label as string),
    registration: (v.registration_number as string)?.trim().toUpperCase() || null,
    color: (v.color as string) || null,
  };
  if (!vehicle.registration)
    throw new HttpError(422, "Renseignez l'immatriculation du véhicule (Données → Véhicules & moniteurs).");

  const client = {
    lastName: String(c.last_name),
    firstName: String(c.first_name),
    birthDate: dateOnly(c.birth_date),
    address: (c.address as string) || null,
    phone: (c.phone as string) || null,
    email: (c.email as string) || null,
    neph: (c.neph as string) || null,
  };

  let pdf: Uint8Array;
  let title: string;
  let period: { start: string; end: string } | null = null;
  if (x.kind === "rental") {
    const minutes = rentalDurationMinutes({ start: { date: x.startDate, time: x.startTime }, end: { date: x.endDate, time: x.endTime } });
    if (minutes <= 0) throw new HttpError(422, "La fin de la location doit être après le début.");
    pdf = await buildRentalPdf({
      client,
      vehicle,
      start: { date: x.startDate, time: x.startTime },
      end: { date: x.endDate, time: x.endTime },
      hourlyCents: x.hourlyCents ?? null,
      totalCents: x.totalCents,
      signatureDate: x.signatureDate,
    });
    title = "Fiche_de_location";
    period = { start: `${x.startDate} ${x.startTime}:00`, end: `${x.endDate} ${x.endTime}:00` };
  } else {
    const signatory = (v.insurance_signatory as string) || "";
    if (!signatory)
      throw new HttpError(422, "Renseignez le signataire de l'attestation pour ce véhicule (Données → Véhicules & moniteurs).");
    pdf = await buildInsurancePdf({
      client,
      vehicle,
      signatory,
      policy: (v.insurance_policy as string) || "AU479942",
      insurer: (v.insurer as string) || "GENERALI IARD - 75456, Paris Cedex 09 - France",
      signatureDate: x.signatureDate,
    });
    title = "Attestation_assurance";
  }

  const fileName = `${title}_${slug(vehicle.model)}_${slug(client.lastName)}_${slug(client.firstName)}_${x.signatureDate}.pdf`;
  const saved = await savePrivateFile(fileName, "application/pdf", Buffer.from(pdf), "documents");
  const documentId = randomUUID();
  const id = randomUUID();
  try {
    await mysqlTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO documents (id, client_id, folder_id, uploaded_by, original_name, stored_name, storage_path, mime_type, file_size, is_private)
         VALUES (?, ?, NULL, ?, ?, ?, ?, 'application/pdf', ?, 1)`,
        [documentId, clientId, userId, saved.originalName, saved.storedName, saved.storagePath, saved.fileSize],
      );
      await conn.execute(
        `INSERT INTO generated_documents (id, client_id, kind, vehicle_id, booking_id, document_id, signature_date,
                                          period_start, period_end, total_cents, params, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          clientId,
          x.kind,
          x.vehicleId,
          x.bookingId ?? null,
          documentId,
          x.signatureDate,
          period?.start ?? null,
          period?.end ?? null,
          x.kind === "rental" ? x.totalCents : null,
          JSON.stringify(x),
          userId,
        ],
      );
      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, 'document.generated', 'client', ?, ?)`,
        [randomUUID(), userId, clientId, JSON.stringify({ kind: x.kind, documentId })],
      );
    });
  } catch (e) {
    await deletePrivateFile(saved.storagePath);
    throw e;
  }
  return { ok: true, id, documentId, fileName: saved.originalName, url: `/api/documents/${documentId}/download` };
}

export async function listClientGeneratedDocuments(clientId: string) {
  z.uuid().parse(clientId);
  if (!isMysqlMode()) return [];
  const rows = (await mysqlQuery(
    `SELECT g.id, g.kind, g.document_id, g.signature_date, g.period_start, g.period_end, g.total_cents, g.created_at,
            v.label AS vehicle_label, d.original_name, d.file_size, u.name AS created_by_name
     FROM generated_documents g
     LEFT JOIN vehicles v ON v.id = g.vehicle_id
     LEFT JOIN documents d ON d.id = g.document_id
     LEFT JOIN users u ON u.id = g.created_by
     WHERE g.client_id = ?
     ORDER BY g.created_at DESC`,
    [clientId],
  )) as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    kind: r.kind === "rental" ? "rental" : "insurance",
    documentId: r.document_id ? String(r.document_id) : null,
    url: r.document_id ? `/api/documents/${r.document_id}/download` : null,
    fileName: r.original_name ? String(r.original_name) : null,
    size: Number(r.file_size || 0),
    signatureDate: dateOnly(r.signature_date),
    periodStart: r.period_start ? new Date(r.period_start as string | Date).toISOString() : null,
    periodEnd: r.period_end ? new Date(r.period_end as string | Date).toISOString() : null,
    totalCents: r.total_cents === null || r.total_cents === undefined ? null : Number(r.total_cents),
    vehicleLabel: r.vehicle_label ? String(r.vehicle_label) : null,
    createdAt: new Date(r.created_at as string | Date).toISOString(),
    createdBy: r.created_by_name ? String(r.created_by_name) : null,
  }));
}
