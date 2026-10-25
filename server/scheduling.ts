import { z } from "zod";
import type { PoolClient } from "pg";
import { db } from "./db";
import { transaction, audit } from "./crm";
import { HttpError } from "./auth";
import { eligibleCompanion } from "../domain/pricing";
import { sessionMinutes, parisDate } from "../domain/scheduling";
const instant = z.iso.datetime({ offset: true });
const interval = z.object({ startsAt: instant, endsAt: instant });
const bookingInput = interval.extend({
  vehicleId: z.uuid(),
  instructorId: z.uuid().nullable().default(null),
  companionName: z.string().trim().min(1).max(150).optional(),
  companionLicenseDate: z.iso.date().optional(),
  requestId: z.uuid(),
});
const resourceInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("vehicle"),
    label: z.string().trim().min(1).max(100),
    modelId: z.string().min(1).max(80),
  }),
  z.object({
    kind: z.literal("instructor"),
    name: z.string().trim().min(1).max(150),
  }),
]);
const resourceKind = z.enum(["vehicle", "instructor", "client"]);
const columns = {
  vehicle: "vehicle_id",
  instructor: "instructor_id",
  client: "client_id",
} as const;
async function resourceLock(
  c: PoolClient,
  kind: keyof typeof columns,
  id: string,
) {
  const r = await c.query(`SELECT * FROM ${kind} WHERE id=$1 FOR UPDATE`, [id]);
  if (
    !r.rowCount ||
    (kind === "client" ? r.rows[0].status === "Archivé" : !r.rows[0].active)
  )
    throw new HttpError(422, "Ressource introuvable ou archivée");
  return r.rows[0];
}
async function occupy(
  c: PoolClient,
  kind: keyof typeof columns,
  resource: string,
  start: string,
  end: string,
  booking: string | null,
  block: string | null,
) {
  await c.query(
    `INSERT INTO calendar_occupancy(${columns[kind]},starts_at,ends_at,booking_id,unavailability_id) VALUES($1,$2,$3,$4,$5)`,
    [resource, start, end, booking, block],
  );
}
function conflict(e: unknown): never {
  const pg = e as { code?: string; constraint?: string };
  if (pg.code === "23P01") {
    const messages: Record<string, string> = {
      vehicle_busy: "Véhicule déjà réservé ou indisponible.",
      instructor_busy: "Moniteur déjà réservé ou indisponible.",
      client_busy: "Client déjà occupé ou indisponible.",
    };
    throw new HttpError(
      409,
      messages[pg.constraint ?? ""] ?? "Créneau indisponible.",
    );
  }
  if (pg.code === "23505")
    throw new HttpError(
      409,
      "Identifiant déjà utilisé. Vérifiez les données avant de réessayer.",
    );
  throw e;
}
export async function resources() {
  const [vehicles, instructors, blocks, policy] = await Promise.all([
    db().query(
      "SELECT v.*,m.label AS model_label FROM vehicle v JOIN vehicle_model m ON m.id=v.model_id ORDER BY v.label",
    ),
    db().query("SELECT * FROM instructor ORDER BY name"),
    db().query(
      `SELECT u.*,o.vehicle_id,o.instructor_id,o.client_id,v.label AS vehicle_label,i.name AS instructor_name,concat(c.first_name,' ',c.last_name) AS client_name FROM unavailability u JOIN calendar_occupancy o ON o.unavailability_id=u.id LEFT JOIN vehicle v ON v.id=o.vehicle_id LEFT JOIN instructor i ON i.id=o.instructor_id LEFT JOIN client c ON c.id=o.client_id WHERE u.released_at IS NULL ORDER BY starts_at`,
    ),
    db().query("SELECT credit_policy FROM scheduling_policy WHERE id=true"),
  ]);
  return {
    vehicles: vehicles.rows,
    instructors: instructors.rows,
    blocks: blocks.rows,
    creditPolicy: policy.rows[0].credit_policy,
  };
}
export async function createResource(raw: unknown, actor: string) {
  const x = resourceInput.parse(raw);
  try {
    return await transaction(async (c) => {
      const r =
        x.kind === "vehicle"
          ? await c.query(
              "INSERT INTO vehicle(model_id,label,created_by) SELECT id,$2,$3 FROM vehicle_model WHERE id=$1 RETURNING *",
              [x.modelId, x.label, actor],
            )
          : await c.query(
              "INSERT INTO instructor(name,created_by) VALUES($1,$2) RETURNING *",
              [x.name, actor],
            );
      if (!r.rowCount) throw new HttpError(422, "Modèle inconnu");
      await audit(c, actor, "resource.created", r.rows[0].id, { kind: x.kind });
      return r.rows[0];
    });
  } catch (e) {
    conflict(e);
  }
}
export async function archiveResource(raw: unknown, actor: string) {
  const x = z
    .object({ kind: z.enum(["vehicle", "instructor"]), id: z.uuid() })
    .parse(raw);
  return transaction(async (c) => {
    await resourceLock(c, x.kind, x.id);
    if (
      (
        await c.query(
          `SELECT 1 FROM calendar_occupancy WHERE ${columns[x.kind]}=$1 AND ends_at>now() LIMIT 1`,
          [x.id],
        )
      ).rowCount
    )
      throw new HttpError(
        409,
        "Cette ressource a des séances ou indisponibilités à venir.",
      );
    await c.query(`UPDATE ${x.kind} SET active=false WHERE id=$1`, [x.id]);
    await audit(c, actor, "resource.archived", x.id, { kind: x.kind });
    return { ok: true };
  });
}
export async function createBlock(raw: unknown, actor: string) {
  const x = interval
    .extend({
      kind: resourceKind,
      resourceId: z.uuid(),
      reason: z.string().trim().min(1).max(500),
    })
    .parse(raw);
  try {
    sessionMinutes(x.startsAt, x.endsAt);
  } catch (e) {
    throw new HttpError(422, (e as Error).message);
  }
  try {
    return await transaction(async (c) => {
      await resourceLock(c, x.kind, x.resourceId);
      const r = await c.query(
        "INSERT INTO unavailability(reason,starts_at,ends_at,created_by) VALUES($1,$2,$3,$4) RETURNING *",
        [x.reason, x.startsAt, x.endsAt, actor],
      );
      await occupy(
        c,
        x.kind,
        x.resourceId,
        x.startsAt,
        x.endsAt,
        null,
        r.rows[0].id,
      );
      await audit(c, actor, "unavailability.created", r.rows[0].id, {
        kind: x.kind,
        resourceId: x.resourceId,
      });
      return r.rows[0];
    });
  } catch (e) {
    conflict(e);
  }
}
export async function releaseBlock(id: string, actor: string) {
  z.uuid().parse(id);
  return transaction(async (c) => {
    const r = await c.query(
      "SELECT * FROM unavailability WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!r.rowCount) throw new HttpError(404, "Indisponibilité introuvable");
    if (!r.rows[0].released_at) {
      await c.query(
        "DELETE FROM calendar_occupancy WHERE unavailability_id=$1",
        [id],
      );
      await c.query(
        "UPDATE unavailability SET released_at=now(),released_by=$2 WHERE id=$1",
        [id, actor],
      );
      await audit(c, actor, "unavailability.released", id);
    }
    return { ok: true };
  });
}
export async function listBookings(clientId?: string) {
  if (clientId) z.uuid().parse(clientId);
  return (
    await db().query(
      `SELECT b.*,v.label AS vehicle_label,i.name AS instructor_name,c.first_name,c.last_name FROM booking b JOIN vehicle v ON v.id=b.vehicle_id LEFT JOIN instructor i ON i.id=b.instructor_id JOIN client c ON c.id=b.client_id ${clientId ? "WHERE b.client_id=$1" : ""} ORDER BY b.starts_at DESC LIMIT 500`,
      clientId ? [clientId] : [],
    )
  ).rows;
}
export async function createBooking(
  serviceId: string,
  raw: unknown,
  actor: string,
) {
  z.uuid().parse(serviceId);
  const x = bookingInput.parse(raw);
  let minutes: number;
  try {
    minutes = sessionMinutes(x.startsAt, x.endsAt);
  } catch (e) {
    throw new HttpError(422, (e as Error).message);
  }
  try {
    return await transaction(async (c) => {
      // Same lock as payments and completion: prevents credit oversubscription.
      const found = await c.query(
        "SELECT * FROM service WHERE id=$1 FOR UPDATE",
        [serviceId],
      );
      if (!found.rowCount) throw new HttpError(404, "Prestation introuvable");
      const s = found.rows[0];
      const previous = await c.query(
        "SELECT * FROM booking WHERE request_id=$1",
        [x.requestId],
      );
      if (previous.rowCount) {
        const b = previous.rows[0];
        if (
          b.service_id !== serviceId ||
          b.vehicle_id !== x.vehicleId ||
          b.instructor_id !== x.instructorId ||
          b.starts_at.toISOString() !== new Date(x.startsAt).toISOString() ||
          b.ends_at.toISOString() !== new Date(x.endsAt).toISOString() ||
          b.companion_name !== (x.companionName ?? null) ||
          (b.companion_license_date?.toISOString?.().slice(0, 10) ??
            b.companion_license_date) !== (x.companionLicenseDate ?? null)
        )
          throw new HttpError(
            409,
            "Clé de réservation déjà utilisée pour une autre demande",
          );
        return b;
      }
      if (s.status !== "Active")
        throw new HttpError(422, "Prestation non active");
      const policy = (
        await c.query(
          "SELECT credit_policy FROM scheduling_policy WHERE id=true",
        )
      ).rows[0].credit_policy;
      if (!policy)
        throw new HttpError(
          422,
          "La politique de réservation des heures doit être validée par GoPermis avant confirmation.",
        );
      // Stable resource lock order shared with unavailable periods and archiving.
      const client = await resourceLock(c, "client", s.client_id);
      const vehicle = await resourceLock(c, "vehicle", x.vehicleId);
      if (vehicle.model_id !== s.price_snapshot.model)
        throw new HttpError(
          422,
          "Véhicule incompatible avec le modèle de la prestation",
        );
      if (s.price_snapshot.support === "GoPermis") {
        if (!x.instructorId)
          throw new HttpError(
            422,
            "Moniteur requis pour un accompagnement GoPermis",
          );
        if (x.companionName || x.companionLicenseDate)
          throw new HttpError(422, "Accompagnateur personnel incompatible");
        await resourceLock(c, "instructor", x.instructorId);
      } else {
        if (x.instructorId || s.price_snapshot.model === "rs3")
          throw new HttpError(
            422,
            "Accompagnement incompatible avec la prestation",
          );
        if (
          !x.companionName ||
          !x.companionLicenseDate ||
          !eligibleCompanion(x.companionLicenseDate, parisDate(x.startsAt))
        )
          throw new HttpError(
            422,
            "Accompagnateur personnel : nom et permis de cinq ans révolus requis au jour de la séance",
          );
      }
      if (policy === "reserve_credit") {
        const balance = (
          await c.query(
            "SELECT COALESCE(sum(minutes),0)::integer AS minutes FROM hour_ledger WHERE service_id=$1",
            [serviceId],
          )
        ).rows[0].minutes;
        const held = (
          await c.query(
            "SELECT COALESCE(sum(minutes),0)::integer AS minutes FROM booking WHERE service_id=$1 AND status='confirmed'",
            [serviceId],
          )
        ).rows[0].minutes;
        if (balance - held < minutes)
          throw new HttpError(
            422,
            "Heures disponibles insuffisantes après les séances déjà réservées",
          );
      }
      const r = await c.query(
        `INSERT INTO booking(service_id,client_id,vehicle_id,instructor_id,starts_at,ends_at,minutes,companion_name,companion_license_date,request_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          serviceId,
          client.id,
          x.vehicleId,
          x.instructorId,
          x.startsAt,
          x.endsAt,
          minutes,
          x.companionName ?? null,
          x.companionLicenseDate ?? null,
          x.requestId,
          actor,
        ],
      );
      const b = r.rows[0];
      await occupy(c, "client", client.id, x.startsAt, x.endsAt, b.id, null);
      await occupy(c, "vehicle", x.vehicleId, x.startsAt, x.endsAt, b.id, null);
      if (x.instructorId)
        await occupy(
          c,
          "instructor",
          x.instructorId,
          x.startsAt,
          x.endsAt,
          b.id,
          null,
        );
      await audit(c, actor, "booking.confirmed", serviceId, {
        bookingId: b.id,
      });
      return b;
    });
  } catch (e) {
    conflict(e);
  }
}
export async function completeBooking(id: string, actor: string) {
  z.uuid().parse(id);
  return transaction(async (c) => {
    const ref = await c.query("SELECT service_id FROM booking WHERE id=$1", [
      id,
    ]);
    if (!ref.rowCount) throw new HttpError(404, "Séance introuvable");
    await c.query("SELECT id FROM service WHERE id=$1 FOR UPDATE", [
      ref.rows[0].service_id,
    ]);
    const b = (
      await c.query("SELECT * FROM booking WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (b.status === "completed") return b;
    if (b.status !== "confirmed")
      throw new HttpError(422, "Seule une séance confirmée peut être réalisée");
    if (b.ends_at.getTime() > Date.now())
      throw new HttpError(
        422,
        "La séance ne peut pas être réalisée avant son heure de fin",
      );
    const balance = (
      await c.query(
        "SELECT COALESCE(sum(minutes),0)::integer AS minutes FROM hour_ledger WHERE service_id=$1",
        [b.service_id],
      )
    ).rows[0].minutes;
    if (balance < b.minutes)
      throw new HttpError(
        422,
        "Crédit insuffisant : aucun découvert autorisé.",
      );
    await c.query(
      "INSERT INTO hour_ledger(service_id,minutes,kind,reason,created_by,booking_id) VALUES($1,$2,'session','Séance réalisée',$3,$4)",
      [b.service_id, -b.minutes, actor, id],
    );
    const r = await c.query(
      "UPDATE booking SET status='completed',completed_at=now(),completed_by=$2 WHERE id=$1 RETURNING *",
      [id, actor],
    );
    await audit(c, actor, "session.completed", b.service_id, {
      bookingId: id,
      minutes: b.minutes,
    });
    return r.rows[0];
  });
}
