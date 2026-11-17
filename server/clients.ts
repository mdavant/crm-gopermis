import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { clientInput, transaction, audit } from "./crm";
import { db } from "./db";
import { isMysqlMode, mysqlQuery, mysqlTransaction } from "./mysql.mjs";
import { HttpError } from "./auth";
import { normalizeSearch } from "../domain/pricing";

export const directoryInput = z.object({
  q: z.string().trim().max(200).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["Prospect", "Actif", "Terminé", "Archivé"]).optional(),
});

function phoneKeyJs(value: string): string {
  const d = value.replace(/[^0-9]/g, "");
  if (d.length === 13 && d.startsWith("0033")) return "0" + d.slice(-9);
  if (d.length === 11 && d.startsWith("33")) return "0" + d.slice(-9);
  return d;
}

export async function searchClients(raw: unknown) {
  const x = directoryInput.parse(raw);

  if (isMysqlMode()) {
    const like = `%${x.q.trim()}%`;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (x.q.trim()) {
      conditions.push(
        "(LOWER(first_name) LIKE LOWER(?) OR LOWER(last_name) LIKE LOWER(?) OR phone LIKE ? OR LOWER(COALESCE(email, '')) LIKE LOWER(?) OR id = ?)",
      );
      params.push(like, like, like, like, x.q.trim());
    }
    if (x.status) {
      conditions.push("status = ?");
      params.push(x.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRows = (await mysqlQuery(
      `SELECT COUNT(*) AS total FROM clients ${where}`,
      params,
    )) as Array<{ total: number }>;
    const total = Number(countRows[0]?.total ?? 0);

    const limit = Math.max(1, Math.min(100, Number(x.pageSize)));
    const offset = Math.max(0, (x.page - 1) * limit);

    const items = await mysqlQuery(
      `SELECT id, first_name, last_name, phone, email, address, notes, source, status, created_at, version, updated_at
       FROM clients ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    return {
      items,
      total,
      page: x.page,
      pageSize: x.pageSize,
      pages: Math.ceil(total / x.pageSize),
    };
  }

  const key = normalizeSearch(x.q);
  return transaction(async (c) => {
    await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const values = [key, x.status ?? null];
    const where =
      "WHERE ($1='' OR search_key LIKE '%'||$1||'%') AND ($2::text IS NULL OR status=$2)";
    const total = (
      await c.query(
        "SELECT count(*)::integer AS total FROM client " + where,
        values,
      )
    ).rows[0].total;
    const items = (
      await c.query(
        "SELECT id,first_name,last_name,phone,email,source,status,created_at,version,updated_at FROM client " +
          where +
          " ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4",
        [...values, x.pageSize, (x.page - 1) * x.pageSize],
      )
    ).rows;
    return {
      items,
      total,
      page: x.page,
      pageSize: x.pageSize,
      pages: Math.ceil(total / x.pageSize),
    };
  });
}

export async function listClients(q: string) {
  return (await searchClients({ q, pageSize: 100 })).items;
}

async function assertIdentity(
  c: PoolClient,
  phone: string,
  email: string | null,
  id: string | null = null,
) {
  const phoneKey = (await c.query("SELECT crm_phone_key($1) AS key", [phone]))
    .rows[0].key;
  const keys = [
    "phone:" + phoneKey,
    ...(email ? ["email:" + email.toLowerCase()] : []),
  ].sort();
  for (const key of keys)
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      key,
    ]);
  const found = await c.query(
    `SELECT id FROM client WHERE ($3::uuid IS NULL OR id<>$3) AND (crm_phone_key(phone)=crm_phone_key($1) OR ($2::text IS NOT NULL AND lower(email)=lower($2))) LIMIT 1`,
    [phone, email, id],
  );
  if (found.rowCount)
    throw new HttpError(
      409,
      "Un client avec ce téléphone ou cet email existe déjà. Vérifiez sa fiche avant de continuer.",
      "DUPLICATE_CLIENT",
    );
}

export async function createClient(raw: unknown, actor: string) {
  const x = clientInput.parse(raw);

  if (isMysqlMode()) {
    const id = randomUUID();
    const cleanEmail = x.email ? x.email.trim().toLowerCase() : null;
    const cleanPhone = phoneKeyJs(x.phone);

    return mysqlTransaction(async (conn) => {
      const [allExisting] = await conn.execute(
        cleanEmail
          ? "SELECT id, phone, email FROM clients WHERE LOWER(email) = ? OR phone = ?"
          : "SELECT id, phone, email FROM clients WHERE phone = ?",
        cleanEmail ? [cleanEmail, x.phone] : [x.phone],
      );
      const list = allExisting as Array<{ id: string; phone: string; email: string | null }>;
      if (
        list.some(
          (row) =>
            phoneKeyJs(row.phone) === cleanPhone ||
            (cleanEmail && row.email?.toLowerCase() === cleanEmail),
        )
      ) {
        throw new HttpError(
          409,
          "Un client avec ce téléphone ou cet email existe déjà. Vérifiez sa fiche avant de continuer.",
          "DUPLICATE_CLIENT",
        );
      }

      await conn.execute(
        `INSERT INTO clients (id, first_name, last_name, phone, email, address, notes, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          x.firstName,
          x.lastName,
          x.phone,
          cleanEmail,
          x.address ?? null,
          x.notes ?? null,
          x.source,
        ],
      );

      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, 'client.created', 'client', ?, ?)`,
        [randomUUID(), actor, id, JSON.stringify({ firstName: x.firstName, lastName: x.lastName })],
      );

      const [created] = await conn.execute("SELECT * FROM clients WHERE id = ?", [id]);
      return (created as Record<string, unknown>[])[0];
    });
  }

  return transaction(async (c) => {
    await assertIdentity(c, x.phone, x.email || null);
    const r = await c.query(
      "INSERT INTO client(first_name,last_name,phone,email,source) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [x.firstName, x.lastName, x.phone, x.email || null, x.source],
    );
    await audit(c, actor, "client.created", r.rows[0].id);
    return r.rows[0];
  });
}

export async function getClientById(id: string) {
  z.uuid().parse(id);
  if (isMysqlMode()) {
    const rows = (await mysqlQuery("SELECT * FROM clients WHERE id = ? LIMIT 1", [
      id,
    ])) as Record<string, unknown>[];
    if (!rows.length) throw new HttpError(404, "Client introuvable");
    return rows[0];
  }
  const r = await db().query("SELECT * FROM client WHERE id = $1", [id]);
  if (!r.rowCount) throw new HttpError(404, "Client introuvable");
  return r.rows[0];
}

export async function updateClient(id: string, raw: unknown, actor: string) {
  z.uuid().parse(id);
  const x = clientInput
    .extend({ version: z.number().int().positive() })
    .parse(raw);

  if (isMysqlMode()) {
    const cleanEmail = x.email ? x.email.trim().toLowerCase() : null;
    const cleanPhone = phoneKeyJs(x.phone);

    return mysqlTransaction(async (conn) => {
      const [prevRows] = await conn.execute(
        "SELECT * FROM clients WHERE id = ? FOR UPDATE",
        [id],
      );
      const previous = (prevRows as Record<string, unknown>[])[0];
      if (!previous) throw new HttpError(404, "Client introuvable");
      if (Number(previous.version) !== x.version) {
        throw new HttpError(
          409,
          "Cette fiche a été modifiée entre-temps. Rechargez-la avant d’enregistrer.",
          "STALE_CLIENT",
        );
      }

      const [dupRows] = await conn.execute(
        cleanEmail
          ? "SELECT id, phone, email FROM clients WHERE id <> ? AND (LOWER(email) = ? OR phone = ?)"
          : "SELECT id, phone, email FROM clients WHERE id <> ? AND phone = ?",
        cleanEmail ? [id, cleanEmail, x.phone] : [id, x.phone],
      );
      const dups = dupRows as Array<{ id: string; phone: string; email: string | null }>;
      if (
        dups.some(
          (row) =>
            phoneKeyJs(row.phone) === cleanPhone ||
            (cleanEmail && row.email?.toLowerCase() === cleanEmail),
        )
      ) {
        throw new HttpError(
          409,
          "Un client avec ce téléphone ou cet email existe déjà. Vérifiez sa fiche avant de continuer.",
          "DUPLICATE_CLIENT",
        );
      }

      await conn.execute(
        `UPDATE clients
         SET first_name = ?, last_name = ?, phone = ?, email = ?, address = ?, notes = ?, source = ?, version = version + 1
         WHERE id = ?`,
        [
          x.firstName,
          x.lastName,
          x.phone,
          cleanEmail,
          x.address ?? (previous.address ? String(previous.address) : null),
          x.notes ?? (previous.notes ? String(previous.notes) : null),
          x.source,
          id,
        ],
      );

      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, 'client.updated', 'client', ?, ?)`,
        [
          randomUUID(),
          actor,
          id,
          JSON.stringify({ fromVersion: x.version, toVersion: x.version + 1 }),
        ],
      );

      const [updated] = await conn.execute("SELECT * FROM clients WHERE id = ?", [id]);
      return (updated as Record<string, unknown>[])[0];
    });
  }

  return transaction(async (c) => {
    const previous = (
      await c.query("SELECT * FROM client WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!previous) throw new HttpError(404, "Client introuvable");
    if (previous.version !== x.version)
      throw new HttpError(
        409,
        "Cette fiche a été modifiée entre-temps. Rechargez-la avant d’enregistrer.",
        "STALE_CLIENT",
      );
    await assertIdentity(c, x.phone, x.email || null, id);
    const values = {
      first_name: x.firstName,
      last_name: x.lastName,
      phone: x.phone,
      email: x.email || null,
      source: x.source,
    };
    const changed = Object.entries(values)
      .filter(([k, v]) => previous[k] !== v)
      .map(([k]) => k);
    if (!changed.length) return previous;
    const r = await c.query(
      "UPDATE client SET first_name=$2,last_name=$3,phone=$4,email=$5,source=$6,version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
      [id, x.firstName, x.lastName, x.phone, x.email || null, x.source],
    );
    await audit(c, actor, "client.updated", id, {
      fields: changed,
      fromVersion: x.version,
      toVersion: x.version + 1,
    });
    return r.rows[0];
  });
}
