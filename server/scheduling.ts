import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import type { PoolConnection } from "mysql2/promise";
import { db } from "./db";
import { isMysqlMode, mysqlQuery, mysqlTransaction } from "./mysql.mjs";
import { transaction, audit } from "./crm";
import { splitFullName } from "./accounts.mjs";
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
    registrationNumber: z.string().trim().max(32).optional(),
    brand: z.string().trim().max(100).optional(),
    model: z.string().trim().max(100).optional(),
    color: z.string().trim().max(40).optional(),
    insuranceSignatory: z.string().trim().max(150).optional(),
    insurancePolicy: z.string().trim().max(60).optional(),
    insurer: z.string().trim().max(255).optional(),
    year: z.number().int().min(1980).max(2100).optional(),
  }),
  z.object({
    kind: z.literal("instructor"),
    name: z.string().trim().min(1).max(150),
    email: z.string().trim().max(254).optional(),
    phone: z.string().trim().max(30).optional(),
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
  if (pg.code === "23505" || pg.code === "ER_DUP_ENTRY")
    throw new HttpError(
      409,
      "Identifiant déjà utilisé. Vérifiez les données avant de réessayer.",
    );
  throw e;
}

async function mysqlCheckOverlap(
  conn: PoolConnection,
  kind: "vehicle" | "instructor" | "client",
  resourceId: string,
  startDate: Date,
  endDate: Date,
) {
  const col = `${kind}_id`;
  const [bookingRows] = await conn.execute(
    `SELECT id FROM bookings
     WHERE ${col} = ? AND status IN ('confirmed', 'completed')
       AND start_at < ? AND end_at > ?
     LIMIT 1 FOR UPDATE`,
    [resourceId, endDate, startDate],
  );
  if (Array.isArray(bookingRows) && bookingRows.length > 0) {
    const msgs = {
      vehicle: "Véhicule déjà réservé ou indisponible.",
      instructor: "Moniteur déjà réservé ou indisponible.",
      client: "Client déjà occupé ou indisponible.",
    };
    throw new HttpError(409, msgs[kind]);
  }
  const [unavailRows] = await conn.execute(
    `SELECT id FROM unavailabilities
     WHERE ${col} = ? AND released_at IS NULL
       AND starts_at < ? AND ends_at > ?
     LIMIT 1 FOR UPDATE`,
    [resourceId, endDate, startDate],
  );
  if (Array.isArray(unavailRows) && unavailRows.length > 0) {
    const msgs = {
      vehicle: "Véhicule déjà réservé ou indisponible.",
      instructor: "Moniteur déjà réservé ou indisponible.",
      client: "Client déjà occupé ou indisponible.",
    };
    throw new HttpError(409, msgs[kind]);
  }
}

export const DEFAULT_COMPANION_COLOR = "#0ea5e9";
export const DEFAULT_EXAM_COLOR = "#f59e0b";
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide");

/** Couleurs générales du planning (accompagnateur personnel, examen pratique). */
export async function updatePlanningColors(raw: unknown, actor: string) {
  const x = z.object({ companion: hexColor, exam: hexColor }).parse(raw);
  if (isMysqlMode()) {
    await mysqlQuery("UPDATE scheduling_policy SET companion_color = ?, exam_color = ? WHERE id = 1", [x.companion, x.exam]);
    await mysqlQuery(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, 'planning.colors', 'planning', 'colors', ?)`,
      [randomUUID(), actor, JSON.stringify(x)],
    );
  } else {
    await db().query("UPDATE scheduling_policy SET companion_color=$1, exam_color=$2 WHERE id=true", [x.companion, x.exam]);
  }
  return { ok: true };
}

/** Moniteur rattaché à un compte (lien direct, sinon même e-mail, sinon même nom). */
export async function instructorIdForUser(u: { id: string; email?: string; name?: string }): Promise<string | null> {
  try {
    if (isMysqlMode()) {
      const rows = (await mysqlQuery(
        `SELECT id FROM instructors WHERE active = 1 AND (user_id = ? OR (email IS NOT NULL AND email <> '' AND LOWER(email) = LOWER(?)) OR LOWER(name) = LOWER(?))
         ORDER BY (user_id = ?) DESC LIMIT 1`,
        [u.id, u.email ?? "", u.name ?? "", u.id],
      )) as { id: string }[];
      return rows[0]?.id ?? null;
    }
    const r = await db().query(
      `SELECT id FROM instructors WHERE active AND (user_id::text = $1 OR LOWER(name) = LOWER($2)) LIMIT 1`,
      [u.id, u.name ?? ""],
    );
    return (r.rows[0]?.id as string) ?? null;
  } catch {
    return null;
  }
}

export async function resources() {
  if (isMysqlMode()) {
    const [vehicles, instructors, blocks, policy] = await Promise.all([
      mysqlQuery(
        "SELECT v.*, m.label AS model_label FROM vehicles v JOIN vehicle_models m ON m.id = v.model_id ORDER BY v.label ASC",
      ),
      mysqlQuery("SELECT * FROM instructors ORDER BY name ASC"),
      mysqlQuery(
        `SELECT u.*, v.label AS vehicle_label, i.name AS instructor_name, CONCAT(c.first_name, ' ', c.last_name) AS client_name
         FROM unavailabilities u
         LEFT JOIN vehicles v ON v.id = u.vehicle_id
         LEFT JOIN instructors i ON i.id = u.instructor_id
         LEFT JOIN clients c ON c.id = u.client_id
         WHERE u.released_at IS NULL
         ORDER BY u.starts_at ASC`,
      ),
      mysqlQuery("SELECT credit_policy, companion_color, exam_color FROM scheduling_policy WHERE id = 1"),
    ]);
    const pol = (policy as Array<Record<string, unknown>>)[0] ?? {};
    return {
      vehicles,
      instructors,
      blocks,
      creditPolicy: String(pol.credit_policy ?? "credit_on_completion"),
      planningColors: {
        companion: (pol.companion_color as string) || DEFAULT_COMPANION_COLOR,
        exam: (pol.exam_color as string) || DEFAULT_EXAM_COLOR,
      },
    };
  }

  const [vehicles, instructors, blocks, policy] = await Promise.all([
    db().query(
      "SELECT v.*,m.label AS model_label FROM vehicle v JOIN vehicle_model m ON m.id=v.model_id ORDER BY v.label",
    ),
    db().query("SELECT * FROM instructor ORDER BY name"),
    db().query(
      `SELECT u.*,o.vehicle_id,o.instructor_id,o.client_id,v.label AS vehicle_label,i.name AS instructor_name,concat(c.first_name,' ',c.last_name) AS client_name FROM unavailability u JOIN calendar_occupancy o ON o.unavailability_id=u.id LEFT JOIN vehicle v ON v.id=o.vehicle_id LEFT JOIN instructor i ON i.id=o.instructor_id LEFT JOIN client c ON c.id=o.client_id WHERE u.released_at IS NULL ORDER BY starts_at`,
    ),
    db().query("SELECT credit_policy, companion_color, exam_color FROM scheduling_policy WHERE id=true"),
  ]);
  return {
    vehicles: vehicles.rows,
    instructors: instructors.rows,
    blocks: blocks.rows,
    creditPolicy: policy.rows[0].credit_policy,
    planningColors: {
      companion: policy.rows[0].companion_color || DEFAULT_COMPANION_COLOR,
      exam: policy.rows[0].exam_color || DEFAULT_EXAM_COLOR,
    },
  };
}

export async function createResource(raw: unknown, actor: string) {
  const x = resourceInput.parse(raw);

  if (isMysqlMode()) {
    try {
      return await mysqlTransaction(async (conn) => {
        const id = randomUUID();
        if (x.kind === "vehicle") {
          const [models] = await conn.execute(
            "SELECT id, label FROM vehicle_models WHERE id = ? LIMIT 1",
            [x.modelId],
          );
          const model = (models as Array<{ id: string; label: string }>)[0];
          if (!model) throw new HttpError(422, "Modèle inconnu");
          await conn.execute(
            `INSERT INTO vehicles (id, model_id, registration_number, brand, model, year, label, color,
                                   insurance_signatory, insurance_policy, insurer, active, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [
              id,
              x.modelId,
              x.registrationNumber || null,
              x.brand || "RENAULT",
              x.model || model.label,
              x.year ?? null,
              x.label,
              x.color || null,
              x.insuranceSignatory || null,
              x.insurancePolicy || null,
              x.insurer || null,
              actor,
            ],
          );
          await conn.execute(
            `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
             VALUES (?, ?, 'resource.created', 'vehicle', ?, ?)`,
            [randomUUID(), actor, id, JSON.stringify({ kind: "vehicle" })],
          );
          const [created] = await conn.execute("SELECT * FROM vehicles WHERE id = ?", [id]);
          return (created as Record<string, unknown>[])[0];
        } else {
          const split = splitFullName(x.name);
          await conn.execute(
            `INSERT INTO instructors (id, first_name, last_name, name, email, phone, active, created_by)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
            [id, split.firstName, split.lastName, x.name, x.email ?? null, x.phone ?? null, actor],
          );
          await conn.execute(
            `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
             VALUES (?, ?, 'resource.created', 'instructor', ?, ?)`,
            [randomUUID(), actor, id, JSON.stringify({ kind: "instructor" })],
          );
          const [created] = await conn.execute("SELECT * FROM instructors WHERE id = ?", [id]);
          return (created as Record<string, unknown>[])[0];
        }
      });
    } catch (e) {
      conflict(e);
    }
  }

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

  if (isMysqlMode()) {
    return mysqlTransaction(async (conn) => {
      const table = x.kind === "vehicle" ? "vehicles" : "instructors";
      const col = x.kind === "vehicle" ? "vehicle_id" : "instructor_id";
      const [rows] = await conn.execute(`SELECT id, active FROM ${table} WHERE id = ? FOR UPDATE`, [
        x.id,
      ]);
      const r = (rows as Array<{ id: string; active: number }>)[0];
      if (!r || !r.active) throw new HttpError(422, "Ressource introuvable ou archivée");

      const [busyB] = await conn.execute(
        `SELECT 1 FROM bookings WHERE ${col} = ? AND end_at > UTC_TIMESTAMP(3) AND status = 'confirmed' LIMIT 1`,
        [x.id],
      );
      if (Array.isArray(busyB) && busyB.length > 0) {
        throw new HttpError(409, "Cette ressource a des séances ou indisponibilités à venir.");
      }

      await conn.execute(`UPDATE ${table} SET active = 0, status = 'archived' WHERE id = ?`, [x.id]);
      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, 'resource.archived', ?, ?, '{}')`,
        [randomUUID(), actor, x.kind, x.id],
      );
      return { ok: true };
    });
  }

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

export async function updateResource(raw: unknown, actor: string) {
  const x = z
    .discriminatedUnion("kind", [
      z.object({
        kind: z.literal("vehicle"),
        id: z.uuid(),
        label: z.string().trim().min(1).max(100),
        modelId: z.string().min(1).max(80).optional(),
        active: z.boolean().optional(),
        registrationNumber: z.string().trim().max(32).optional(),
        brand: z.string().trim().max(100).optional(),
        model: z.string().trim().max(100).optional(),
        color: z.string().trim().max(40).optional(),
        insuranceSignatory: z.string().trim().max(150).optional(),
        insurancePolicy: z.string().trim().max(60).optional(),
        insurer: z.string().trim().max(255).optional(),
      }),
      z.object({
        kind: z.literal("instructor"),
        id: z.uuid(),
        name: z.string().trim().min(1).max(150),
        active: z.boolean().optional(),
        color: hexColor.nullable().optional(),
      }),
    ])
    .parse(raw);

  if (isMysqlMode()) {
    try {
      return await mysqlTransaction(async (conn) => {
        const table = x.kind === "vehicle" ? "vehicles" : "instructors";
        const [rows] = await conn.execute(`SELECT * FROM ${table} WHERE id = ? FOR UPDATE`, [x.id]);
        const current = (rows as Record<string, unknown>[])[0];
        if (!current) throw new HttpError(404, "Ressource introuvable");

        const col = x.kind === "vehicle" ? "vehicle_id" : "instructor_id";
        if (x.active === false) {
          const [busyB] = await conn.execute(
            `SELECT 1 FROM bookings WHERE ${col} = ? AND end_at > UTC_TIMESTAMP(3) AND status = 'confirmed' LIMIT 1`,
            [x.id],
          );
          if (Array.isArray(busyB) && busyB.length > 0) {
            throw new HttpError(409, "Cette ressource a des séances ou indisponibilités à venir.");
          }
        }

        if (x.kind === "vehicle") {
          await conn.execute(
            "UPDATE vehicles SET label = ?, model_id = COALESCE(?, model_id), active = COALESCE(?, active) WHERE id = ?",
            [x.label, x.modelId ?? null, x.active === undefined ? null : x.active ? 1 : 0, x.id],
          );
          // Informations des documents : un champ envoyé vide efface la valeur.
          const docCols: [string, string | undefined][] = [
            ["registration_number", x.registrationNumber],
            ["brand", x.brand],
            ["model", x.model],
            ["color", x.color],
            ["insurance_signatory", x.insuranceSignatory],
            ["insurance_policy", x.insurancePolicy],
            ["insurer", x.insurer],
          ];
          for (const [col, val] of docCols)
            if (val !== undefined) await conn.execute(`UPDATE vehicles SET ${col} = ? WHERE id = ?`, [val || null, x.id]);
        } else {
          const split = splitFullName(x.name);
          await conn.execute(
            "UPDATE instructors SET first_name = ?, last_name = ?, name = ?, active = COALESCE(?, active) WHERE id = ?",
            [
              split.firstName,
              split.lastName,
              x.name,
              x.active === undefined ? null : x.active ? 1 : 0,
              x.id,
            ],
          );
          if (x.color !== undefined)
            await conn.execute("UPDATE instructors SET color = ? WHERE id = ?", [x.color, x.id]);
        }

        await conn.execute(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
           VALUES (?, ?, 'resource.updated', ?, ?, '{}')`,
          [randomUUID(), actor, x.kind, x.id],
        );
        return { ok: true };
      });
    } catch (e) {
      conflict(e);
    }
  }

  try {
    return await transaction(async (c) => {
      const table = x.kind === "vehicle" ? "vehicle" : "instructor";
      const current = (await c.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [x.id]))
        .rows[0];
      if (!current) throw new HttpError(404, "Ressource introuvable");
      if (
        x.active === false &&
        (
          await c.query(
            `SELECT 1 FROM calendar_occupancy WHERE ${columns[x.kind]}=$1 AND ends_at>now() LIMIT 1`,
            [x.id],
          )
        ).rowCount
      )
        throw new HttpError(409, "Cette ressource a des séances ou indisponibilités à venir.");
      if (x.kind === "vehicle") {
        if (x.modelId && x.modelId !== current.model_id) {
          if (!(await c.query("SELECT 1 FROM vehicle_model WHERE id=$1", [x.modelId])).rowCount)
            throw new HttpError(422, "Modèle inconnu");
          if ((await c.query("SELECT 1 FROM booking WHERE vehicle_id=$1 LIMIT 1", [x.id])).rowCount)
            throw new HttpError(
              409,
              "Le modèle d’un véhicule associé à des séances ne peut pas être modifié.",
            );
        }
        await c.query(
          "UPDATE vehicle SET label=$1,model_id=COALESCE($2,model_id),active=COALESCE($3,active) WHERE id=$4",
          [x.label, x.modelId ?? null, x.active ?? null, x.id],
        );
      } else {
        await c.query("UPDATE instructor SET name=$1,active=COALESCE($2,active) WHERE id=$3", [
          x.name,
          x.active ?? null,
          x.id,
        ]);
        if (x.color !== undefined)
          await c.query("UPDATE instructor SET color=$1 WHERE id=$2", [x.color, x.id]);
      }
      await audit(c, actor, "resource.updated", x.id, { kind: x.kind });
      return { ok: true };
    });
  } catch (e) {
    conflict(e);
  }
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

  if (isMysqlMode()) {
    const startD = new Date(x.startsAt);
    const endD = new Date(x.endsAt);
    return mysqlTransaction(async (conn) => {
      await mysqlCheckOverlap(conn, x.kind, x.resourceId, startD, endD);
      const id = randomUUID();
      await conn.execute(
        `INSERT INTO unavailabilities (id, kind, vehicle_id, instructor_id, client_id, reason, starts_at, ends_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          x.kind,
          x.kind === "vehicle" ? x.resourceId : null,
          x.kind === "instructor" ? x.resourceId : null,
          x.kind === "client" ? x.resourceId : null,
          x.reason,
          startD,
          endD,
          actor,
        ],
      );
      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, 'unavailability.created', 'unavailability', ?, ?)`,
        [randomUUID(), actor, id, JSON.stringify({ kind: x.kind, resourceId: x.resourceId })],
      );
      const [rows] = await conn.execute("SELECT * FROM unavailabilities WHERE id = ?", [id]);
      return (rows as Record<string, unknown>[])[0];
    });
  }

  try {
    return await transaction(async (c) => {
      await resourceLock(c, x.kind, x.resourceId);
      const r = await c.query(
        "INSERT INTO unavailability(reason,starts_at,ends_at,created_by) VALUES($1,$2,$3,$4) RETURNING *",
        [x.reason, x.startsAt, x.endsAt, actor],
      );
      await occupy(c, x.kind, x.resourceId, x.startsAt, x.endsAt, null, r.rows[0].id);
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

  if (isMysqlMode()) {
    return mysqlTransaction(async (conn) => {
      const [rows] = await conn.execute(
        "SELECT id, released_at FROM unavailabilities WHERE id = ? FOR UPDATE",
        [id],
      );
      const r = (rows as Array<{ id: string; released_at: unknown }>)[0];
      if (!r) throw new HttpError(404, "Indisponibilité introuvable");
      if (!r.released_at) {
        await conn.execute(
          "UPDATE unavailabilities SET released_at = UTC_TIMESTAMP(3), released_by = ? WHERE id = ?",
          [actor, id],
        );
        await conn.execute(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
           VALUES (?, ?, 'unavailability.released', 'unavailability', ?, '{}')`,
          [randomUUID(), actor, id],
        );
      }
      return { ok: true };
    });
  }

  return transaction(async (c) => {
    const r = await c.query("SELECT * FROM unavailability WHERE id=$1 FOR UPDATE", [id]);
    if (!r.rowCount) throw new HttpError(404, "Indisponibilité introuvable");
    if (!r.rows[0].released_at) {
      await c.query("DELETE FROM calendar_occupancy WHERE unavailability_id=$1", [id]);
      await c.query(
        "UPDATE unavailability SET released_at=now(),released_by=$2 WHERE id=$1",
        [id, actor],
      );
      await audit(c, actor, "unavailability.released", id);
    }
    return { ok: true };
  });
}

export async function getHomeStats() {
  if (isMysqlMode()) {
    const todayParis = new Date().toLocaleDateString("en-CA", {
      timeZone: "Europe/Paris",
    });
    const startUtc = new Date(`${todayParis}T00:00:00+01:00`);
    const endUtc = new Date(startUtc.getTime() + 86400000);
    const [totalClientsRows, todayBookingsRows] = await Promise.all([
      mysqlQuery("SELECT COUNT(*) AS total FROM clients"),
      mysqlQuery(
        `SELECT COUNT(*) AS count, COALESCE(SUM(minutes), 0) AS total_minutes
         FROM bookings
         WHERE start_at < ? AND end_at > ? AND status <> 'cancelled'`,
        [endUtc, startUtc],
      ),
    ]);
    const totalClients = Number((totalClientsRows as Array<{ total: number }>)[0]?.total ?? 0);
    const todayRow = (todayBookingsRows as Array<{ count: number; total_minutes: number }>)[0];
    const totalMinutes = Number(todayRow?.total_minutes ?? 0);
    return {
      totalClients,
      todayBookingsCount: Number(todayRow?.count ?? 0),
      todayMinutes: totalMinutes,
      todayHours: Math.round((totalMinutes / 60) * 10) / 10,
    };
  }

  const pool = db();
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Paris",
  });
  const [totalClientsRes, todayBookingsRes] = await Promise.all([
    pool.query("SELECT count(*)::integer AS total FROM client"),
    pool.query(
      `SELECT count(*)::integer AS count, COALESCE(sum(minutes),0)::integer AS total_minutes
       FROM booking
       WHERE starts_at < (($1::date + 1)::timestamp AT TIME ZONE 'Europe/Paris')
         AND ends_at > ($1::date::timestamp AT TIME ZONE 'Europe/Paris')`,
      [today],
    ),
  ]);
  const totalMinutes = todayBookingsRes.rows[0]?.total_minutes ?? 0;
  return {
    totalClients: totalClientsRes.rows[0]?.total ?? 0,
    todayBookingsCount: todayBookingsRes.rows[0]?.count ?? 0,
    todayMinutes: totalMinutes,
    todayHours: Math.round((totalMinutes / 60) * 10) / 10,
  };
}

export async function listBookings(
  clientId?: string,
  date?: string,
  startDate?: string,
  endDate?: string,
) {
  if (clientId) z.uuid().parse(clientId);
  if (date) z.iso.date().parse(date);
  if (startDate) z.iso.date().parse(startDate);
  if (endDate) z.iso.date().parse(endDate);

  if (isMysqlMode()) {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (clientId) {
      conds.push("b.client_id = ?");
      params.push(clientId);
    }
    if (date) {
      const startD = new Date(`${date}T00:00:00Z`);
      const endD = new Date(startD.getTime() + 86400000);
      conds.push("b.start_at < ? AND b.end_at > ?");
      params.push(endD, startD);
    }
    if (startDate) {
      conds.push("b.end_at >= ?");
      params.push(new Date(`${startDate}T00:00:00Z`));
    }
    if (endDate) {
      const endD = new Date(new Date(`${endDate}T00:00:00Z`).getTime() + 86400000);
      conds.push("b.start_at < ?");
      params.push(endD);
    }
    // Sans filtre : séances des 6 derniers mois et à venir (évite de tronquer les plus récentes).
    if (!conds.length) conds.push("b.end_at >= (UTC_TIMESTAMP() - INTERVAL 180 DAY)");
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const rows = (await mysqlQuery(
      `SELECT b.*, b.start_at AS starts_at, b.end_at AS ends_at,
              v.label AS vehicle_label, v.model_id AS vehicle_model, i.name AS instructor_name, i.color AS instructor_color,
              c.first_name, c.last_name, s.type_id AS service_type,
              (SELECT g.document_id FROM generated_documents g
                WHERE g.booking_id = b.id AND g.kind = 'rental' ORDER BY g.created_at DESC LIMIT 1) AS rental_document_id
       FROM bookings b
       JOIN vehicles v ON v.id = b.vehicle_id
       LEFT JOIN instructors i ON i.id = b.instructor_id
       LEFT JOIN services s ON s.id = b.service_id
       JOIN clients c ON c.id = b.client_id
       ${where}
       ORDER BY b.start_at ASC, b.id ASC
       LIMIT 5000`,
      params,
    )) as Record<string, unknown>[];
    return rows;
  }

  return (
    await db().query(
      `SELECT b.*,v.label AS vehicle_label,v.model_id AS vehicle_model,i.name AS instructor_name,i.color AS instructor_color,c.first_name,c.last_name,s.type_id AS service_type
       FROM booking b 
       JOIN vehicle v ON v.id=b.vehicle_id 
       LEFT JOIN instructor i ON i.id=b.instructor_id 
       LEFT JOIN service s ON s.id=b.service_id
       JOIN client c ON c.id=b.client_id 
       WHERE ($1::uuid IS NULL OR b.client_id=$1) 
         AND ($2::date IS NULL OR (b.starts_at<(($2::date+1)::timestamp AT TIME ZONE 'Europe/Paris') AND b.ends_at>($2::date::timestamp AT TIME ZONE 'Europe/Paris')))
         AND ($3::date IS NULL OR b.ends_at>=($3::date::timestamp AT TIME ZONE 'Europe/Paris'))
         AND ($4::date IS NULL OR b.starts_at<(($4::date+1)::timestamp AT TIME ZONE 'Europe/Paris'))
       ORDER BY b.starts_at ASC, b.id LIMIT 1000`,
      [clientId ?? null, date ?? null, startDate ?? null, endDate ?? null],
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

  if (isMysqlMode()) {
    const startD = new Date(x.startsAt);
    const endD = new Date(x.endsAt);

    return mysqlTransaction(async (conn) => {
      const [found] = await conn.execute("SELECT * FROM services WHERE id = ? FOR UPDATE", [
        serviceId,
      ]);
      const s = (found as Record<string, unknown>[])[0];
      if (!s) throw new HttpError(404, "Prestation introuvable");
      const snapshot =
        typeof s.price_snapshot === "string"
          ? JSON.parse(s.price_snapshot)
          : (s.price_snapshot as { model: string; support: string });

      const [prev] = await conn.execute("SELECT * FROM bookings WHERE request_id = ? LIMIT 1", [
        x.requestId,
      ]);
      if (Array.isArray(prev) && prev.length > 0) {
        return prev[0];
      }

      if (s.status !== "Active") throw new HttpError(422, "Prestation non active");

      const [polRows] = await conn.execute(
        "SELECT credit_policy FROM scheduling_policy WHERE id = 1",
      );
      const policy = (polRows as Array<{ credit_policy: string }>)[0]?.credit_policy;
      if (!policy) {
        throw new HttpError(
          422,
          "La politique de réservation des heures doit être validée par GoPermis avant confirmation.",
        );
      }

      const [clRows] = await conn.execute(
        "SELECT id, status FROM clients WHERE id = ? FOR UPDATE",
        [String(s.client_id)],
      );
      const clientRow = (clRows as Array<{ id: string; status: string }>)[0];
      if (!clientRow || clientRow.status === "Archivé") {
        throw new HttpError(422, "Ressource introuvable ou archivée");
      }

      const [vRows] = await conn.execute(
        "SELECT id, model_id, active FROM vehicles WHERE id = ? FOR UPDATE",
        [x.vehicleId],
      );
      const vehicleRow = (vRows as Array<{ id: string; model_id: string; active: number }>)[0];
      if (!vehicleRow || !vehicleRow.active) {
        throw new HttpError(422, "Ressource introuvable ou archivée");
      }
      if (vehicleRow.model_id !== snapshot.model) {
        throw new HttpError(422, "Véhicule incompatible avec le modèle de la prestation");
      }

      if (snapshot.support === "GoPermis") {
        if (!x.instructorId)
          throw new HttpError(422, "Moniteur requis pour un accompagnement GoPermis");
        if (x.companionName || x.companionLicenseDate)
          throw new HttpError(422, "Accompagnateur personnel incompatible");
        const [iRows] = await conn.execute(
          "SELECT id, active FROM instructors WHERE id = ? FOR UPDATE",
          [x.instructorId],
        );
        const inst = (iRows as Array<{ id: string; active: number }>)[0];
        if (!inst || !inst.active) throw new HttpError(422, "Ressource introuvable ou archivée");
      } else {
        if (x.instructorId || snapshot.model === "rs3")
          throw new HttpError(422, "Accompagnement incompatible avec la prestation");
        if (
          !x.companionName ||
          !x.companionLicenseDate ||
          !eligibleCompanion(x.companionLicenseDate, parisDate(x.startsAt))
        ) {
          throw new HttpError(
            422,
            "Accompagnateur personnel : nom et permis de cinq ans révolus requis au jour de la séance",
          );
        }
      }

      await mysqlCheckOverlap(conn, "client", clientRow.id, startD, endD);
      await mysqlCheckOverlap(conn, "vehicle", x.vehicleId, startD, endD);
      if (x.instructorId) {
        await mysqlCheckOverlap(conn, "instructor", x.instructorId, startD, endD);
      }

      const bookingId = randomUUID();
      await conn.execute(
        `INSERT INTO bookings
         (id, service_id, client_id, vehicle_id, instructor_id, start_at, end_at, minutes, status, companion_name, companion_license_date, request_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)`,
        [
          bookingId,
          serviceId,
          clientRow.id,
          x.vehicleId,
          x.instructorId,
          startD,
          endD,
          minutes,
          x.companionName ?? null,
          x.companionLicenseDate ?? null,
          x.requestId,
          actor,
        ],
      );

      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, 'booking.confirmed', 'booking', ?, ?)`,
        [randomUUID(), actor, bookingId, JSON.stringify({ serviceId })],
      );

      const [created] = await conn.execute(
        "SELECT *, start_at AS starts_at, end_at AS ends_at FROM bookings WHERE id = ?",
        [bookingId],
      );
      return (created as Record<string, unknown>[])[0];
    });
  }

  try {
    return await transaction(async (c) => {
      const found = await c.query("SELECT * FROM service WHERE id=$1 FOR UPDATE", [serviceId]);
      if (!found.rowCount) throw new HttpError(404, "Prestation introuvable");
      const s = found.rows[0];
      const previous = await c.query("SELECT * FROM booking WHERE request_id=$1", [x.requestId]);
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
          throw new HttpError(409, "Clé de réservation déjà utilisée pour une autre demande");
        return b;
      }
      if (s.status !== "Active") throw new HttpError(422, "Prestation non active");
      const policy = (
        await c.query("SELECT credit_policy FROM scheduling_policy WHERE id=true")
      ).rows[0].credit_policy;
      if (!policy)
        throw new HttpError(
          422,
          "La politique de réservation des heures doit être validée par GoPermis avant confirmation.",
        );
      const client = await resourceLock(c, "client", s.client_id);
      const vehicle = await resourceLock(c, "vehicle", x.vehicleId);
      if (vehicle.model_id !== s.price_snapshot.model)
        throw new HttpError(422, "Véhicule incompatible avec le modèle de la prestation");
      if (s.price_snapshot.support === "GoPermis") {
        if (!x.instructorId)
          throw new HttpError(422, "Moniteur requis pour un accompagnement GoPermis");
        if (x.companionName || x.companionLicenseDate)
          throw new HttpError(422, "Accompagnateur personnel incompatible");
        await resourceLock(c, "instructor", x.instructorId);
      } else {
        if (x.instructorId || s.price_snapshot.model === "rs3")
          throw new HttpError(422, "Accompagnement incompatible avec la prestation");
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
        await occupy(c, "instructor", x.instructorId, x.startsAt, x.endsAt, b.id, null);
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

  if (isMysqlMode()) {
    return mysqlTransaction(async (conn) => {
      const [bRows] = await conn.execute("SELECT * FROM bookings WHERE id = ? FOR UPDATE", [id]);
      const b = (bRows as Record<string, unknown>[])[0];
      if (!b) throw new HttpError(404, "Séance introuvable");
      if (b.status === "completed") return b;
      if (b.status !== "confirmed") {
        throw new HttpError(422, "Seule une séance confirmée peut être réalisée");
      }
      if (new Date(b.end_at as string | Date).getTime() > Date.now()) {
        throw new HttpError(422, "La séance ne peut pas être réalisée avant son heure de fin");
      }
      if (b.service_id) {
        const svcId = String(b.service_id);
        const [balRows] = await conn.execute(
          "SELECT COALESCE(SUM(minutes), 0) AS minutes FROM hour_ledger WHERE service_id = ?",
          [svcId],
        );
        const balance = Number((balRows as Array<{ minutes: number }>)[0]?.minutes ?? 0);
        if (balance < Number(b.minutes)) {
          throw new HttpError(422, "Crédit insuffisant : aucun découvert autorisé.");
        }
        await conn.execute(
          "INSERT INTO hour_ledger (id, service_id, minutes, kind, reason, created_by, booking_id) VALUES (?, ?, ?, 'session', 'Séance réalisée', ?, ?)",
          [randomUUID(), svcId, -Number(b.minutes), actor, id],
        );
      }

      await conn.execute(
        "UPDATE bookings SET status = 'completed', completed_at = UTC_TIMESTAMP(3), completed_by = ? WHERE id = ?",
        [actor, id],
      );
      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, 'session.completed', 'booking', ?, ?)`,
        [randomUUID(), actor, id, JSON.stringify({ minutes: b.minutes })],
      );

      const [updated] = await conn.execute(
        "SELECT *, start_at AS starts_at, end_at AS ends_at FROM bookings WHERE id = ?",
        [id],
      );
      return (updated as Record<string, unknown>[])[0];
    });
  }

  return transaction(async (c) => {
    const ref = await c.query("SELECT service_id FROM booking WHERE id=$1", [id]);
    if (!ref.rowCount) throw new HttpError(404, "Séance introuvable");
    await c.query("SELECT id FROM service WHERE id=$1 FOR UPDATE", [ref.rows[0].service_id]);
    const b = (await c.query("SELECT * FROM booking WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (b.status === "completed") return b;
    if (b.status !== "confirmed")
      throw new HttpError(422, "Seule une séance confirmée peut être réalisée");
    if (b.ends_at.getTime() > Date.now())
      throw new HttpError(422, "La séance ne peut pas être réalisée avant son heure de fin");
    const balance = (
      await c.query(
        "SELECT COALESCE(sum(minutes),0)::integer AS minutes FROM hour_ledger WHERE service_id=$1",
        [b.service_id],
      )
    ).rows[0].minutes;
    if (balance < b.minutes)
      throw new HttpError(422, "Crédit insuffisant : aucun découvert autorisé.");
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
