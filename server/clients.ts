import { z } from "zod";
import type { PoolClient } from "pg";
import { clientInput, transaction, audit } from "./crm";
import { HttpError } from "./auth";
import { normalizeSearch } from "../domain/pricing";
export const directoryInput = z.object({
  q: z.string().trim().max(200).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["Prospect", "Actif", "Terminé", "Archivé"]).optional(),
});
export async function searchClients(raw: unknown) {
  const x = directoryInput.parse(raw);
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
  // Deterministic advisory locks serialize API writes without imposing a destructive
  // unique migration on any historical duplicates. No existing record is merged.
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
export async function updateClient(id: string, raw: unknown, actor: string) {
  z.uuid().parse(id);
  const x = clientInput
    .extend({ version: z.number().int().positive() })
    .parse(raw);
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
