import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { db } from "./db";
import { isMysqlMode, mysqlQuery, mysqlTransaction } from "./mysql.mjs";
import { quote, type Rate, type Offer } from "../domain/pricing";
import { HttpError } from "./auth";

export const clientInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(30)
    .regex(/^[+\d ().-]+$/),
  email: z.union([z.email(), z.literal("")]).optional(),
  address: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(5000).optional(),
  source: z.string().trim().min(1).max(100).default("Saisie manuelle"),
});

export const serviceInput = z.object({
  typeId: z.string().min(1).max(80),
  model: z.string().min(1),
  support: z.enum(["GoPermis", "Personnel"]),
  minutes: z.number().int().positive().max(60000),
  offerId: z.string().optional(),
});

export const paymentInput = z.object({
  amountCents: z.number().int().positive().max(100000000),
  method: z.enum(["Carte", "Virement", "Espèces"]),
  requestId: z.uuid(),
});

export async function transaction<T>(fn: (c: PoolClient) => Promise<T>) {
  const c = await db().connect();
  try {
    await c.query("BEGIN");
    const value = await fn(c);
    await c.query("COMMIT");
    return value;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

export async function audit(
  c: PoolClient,
  actor: string,
  action: string,
  id: string,
  details: object = {},
) {
  await c.query(
    "INSERT INTO audit_event(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)",
    [actor, action, id, JSON.stringify(details)],
  );
}

function parseJsonCol<T>(val: unknown): T {
  if (typeof val === "string") return JSON.parse(val) as T;
  return val as T;
}

function groupLinks(rows: Array<Record<string, unknown>>) {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const k = String(r.offer_id);
    map.set(k, [...(map.get(k) ?? []), String(r.model_id)]);
  }
  return map;
}

/** Identifiant lisible à partir d'un libellé (« Peugeot 208 BVA » → « peugeot-208-bva »). */
export function slugId(label: string) {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "element";
}

export async function catalog() {
  if (isMysqlMode()) {
    const [rates, offers, types, models, links] = await Promise.all([
      mysqlQuery(
        `SELECT id, model, support, cents, DATE_FORMAT(valid_from, '%Y-%m-%d') AS validFrom, DATE_FORMAT(valid_to, '%Y-%m-%d') AS validTo FROM tariff_versions`,
      ),
      mysqlQuery(
        `SELECT id, label, paid_minutes AS paidMinutes, bonus_minutes AS bonusMinutes, single_payment AS singlePayment FROM offers WHERE active = 1`,
      ),
      mysqlQuery(`SELECT id, label, pricing_mode FROM service_types WHERE active = 1`),
      mysqlQuery(`SELECT id, label FROM vehicle_models ORDER BY label`),
      mysqlQuery(`SELECT offer_id, model_id FROM offer_models`),
    ]);
    const byOffer = groupLinks(links as Array<Record<string, unknown>>);
    return {
      rates: rates as Rate[],
      offers: (offers as Array<Record<string, unknown>>).map((o) => ({
        ...o,
        singlePayment: Boolean(o.singlePayment),
        modelIds: byOffer.get(String(o.id)) ?? [],
      })) as (Offer & { label: string; modelIds: string[] })[],
      types: types as { id: string; label: string; pricing_mode: string }[],
      models: models as { id: string; label: string }[],
    };
  }

  const [rates, offers, types, models, links] = await Promise.all([
    db().query(
      `SELECT id,model,support,cents,to_char(valid_from,'YYYY-MM-DD') AS "validFrom",to_char(valid_to,'YYYY-MM-DD') AS "validTo" FROM tariff_version`,
    ),
    db().query(
      'SELECT id,label,paid_minutes AS "paidMinutes",bonus_minutes AS "bonusMinutes",single_payment AS "singlePayment" FROM offer WHERE active',
    ),
    db().query("SELECT id,label,pricing_mode FROM service_type WHERE active"),
    db().query("SELECT * FROM vehicle_model ORDER BY label"),
    db().query("SELECT offer_id, model_id FROM offer_model"),
  ]);
  const byOffer = groupLinks(links.rows as Array<Record<string, unknown>>);
  return {
    rates: rates.rows as Rate[],
    offers: (offers.rows as Array<Record<string, unknown>>).map((o) => ({
      ...o,
      modelIds: byOffer.get(String(o.id)) ?? [],
    })) as (Offer & { label: string; modelIds: string[] })[],
    types: types.rows as { id: string; label: string; pricing_mode: string }[],
    models: models.rows as { id: string; label: string }[],
  };
}

export async function detail(
  id: string,
  financial: boolean,
  auditAllowed: boolean,
) {
  z.uuid().parse(id);

  if (isMysqlMode()) {
    const clientRows = (await mysqlQuery("SELECT * FROM clients WHERE id = ? LIMIT 1", [
      id,
    ])) as Record<string, unknown>[];
    if (!clientRows.length) throw new HttpError(404, "Client introuvable");

    const [services, ledger, notes, payments, history] = await Promise.all([
      mysqlQuery(
        "SELECT s.*, t.label FROM services s JOIN service_types t ON t.id = s.type_id WHERE s.client_id = ? ORDER BY s.created_at DESC",
        [id],
      ),
      mysqlQuery(
        "SELECT h.* FROM hour_ledger h JOIN services s ON s.id = h.service_id WHERE s.client_id = ? ORDER BY h.created_at ASC",
        [id],
      ),
      mysqlQuery(
        "SELECT n.*, u.name AS author FROM client_notes n JOIN users u ON u.id = n.created_by WHERE n.client_id = ? ORDER BY n.created_at DESC",
        [id],
      ),
      financial
        ? mysqlQuery(
            "SELECT p.* FROM payments p JOIN services s ON s.id = p.service_id WHERE s.client_id = ? ORDER BY p.created_at DESC",
            [id],
          )
        : Promise.resolve([]),
      auditAllowed
        ? mysqlQuery(
            `SELECT a.action, a.created_at, COALESCE(u.name, 'Système') AS actor
             FROM audit_logs a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE a.entity_id = ?
                OR a.entity_id IN (SELECT id FROM services WHERE client_id = ?)
             ORDER BY a.created_at DESC LIMIT 50`,
            [id, id],
          )
        : Promise.resolve([]),
    ]);

    return {
      client: clientRows[0],
      services: (services as Record<string, unknown>[]).map((s) => ({
        ...s,
        price_snapshot: parseJsonCol(s.price_snapshot),
      })),
      ledger,
      notes,
      payments,
      history,
    };
  }

  const client = await db().query("SELECT * FROM client WHERE id=$1", [id]);
  if (!client.rowCount) throw new HttpError(404, "Client introuvable");
  const [services, ledger, notes, payments, history] = await Promise.all([
    db().query(
      "SELECT s.*,t.label FROM service s JOIN service_type t ON t.id=s.type_id WHERE client_id=$1 ORDER BY created_at DESC",
      [id],
    ),
    db().query(
      "SELECT h.* FROM hour_ledger h JOIN service s ON s.id=h.service_id WHERE s.client_id=$1 ORDER BY h.created_at",
      [id],
    ),
    db().query(
      "SELECT n.*,u.name AS author FROM note n JOIN app_user u ON u.id=n.created_by WHERE client_id=$1 ORDER BY created_at DESC",
      [id],
    ),
    financial
      ? db().query(
          "SELECT p.* FROM payment p JOIN service s ON s.id=p.service_id WHERE s.client_id=$1 ORDER BY p.created_at DESC",
          [id],
        )
      : Promise.resolve({ rows: [] }),
    auditAllowed
      ? db().query(
          "SELECT a.action,a.created_at,u.name AS actor FROM audit_event a JOIN app_user u ON u.id=a.actor_id WHERE resource_id=$1 OR resource_id IN(SELECT id FROM service WHERE client_id=$1) ORDER BY created_at DESC LIMIT 50",
          [id],
        )
      : Promise.resolve({ rows: [] }),
  ]);
  return {
    client: client.rows[0],
    services: services.rows,
    ledger: ledger.rows,
    notes: notes.rows,
    payments: payments.rows,
    history: history.rows,
  };
}

export async function createService(
  clientId: string,
  raw: unknown,
  actor: string,
) {
  z.uuid().parse(clientId);
  const x = serviceInput.parse(raw);
  const cat = await catalog();
  const type = cat.types.find((t) => t.id === x.typeId);
  if (!type || type.pricing_mode !== "hourly")
    throw new HttpError(
      422,
      "Cette prestation nécessite un devis ; aucun tarif VTC automatique.",
    );
  let snapshot;
  try {
    snapshot = quote(cat.rates, cat.offers, {
      ...x,
      date: new Date().toLocaleDateString("en-CA", {
        timeZone: "Europe/Paris",
      }),
    });
  } catch (e) {
    throw new HttpError(422, (e as Error).message);
  }

  if (isMysqlMode()) {
    const id = randomUUID();
    return mysqlTransaction(async (conn) => {
      const [cl] = await conn.execute(
        "SELECT id FROM clients WHERE id = ? FOR UPDATE",
        [clientId],
      );
      if (!Array.isArray(cl) || cl.length === 0) {
        throw new HttpError(404, "Client introuvable");
      }
      await conn.execute(
        "INSERT INTO services (id, client_id, type_id, price_snapshot) VALUES (?, ?, ?, ?)",
        [id, clientId, x.typeId, JSON.stringify(snapshot)],
      );
      await conn.execute("UPDATE clients SET status = 'Actif' WHERE id = ?", [
        clientId,
      ]);
      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, 'service.created', 'service', ?, ?)`,
        [randomUUID(), actor, id, JSON.stringify({ snapshot })],
      );
      const [created] = await conn.execute("SELECT * FROM services WHERE id = ?", [id]);
      const row = (created as Record<string, unknown>[])[0];
      return { ...row, price_snapshot: parseJsonCol(row.price_snapshot) };
    });
  }

  return transaction(async (c) => {
    if (
      !(
        await c.query("SELECT id FROM client WHERE id=$1 FOR UPDATE", [
          clientId,
        ])
      ).rowCount
    )
      throw new HttpError(404, "Client introuvable");
    const s = await c.query(
      "INSERT INTO service(client_id,type_id,price_snapshot) VALUES($1,$2,$3) RETURNING *",
      [clientId, x.typeId, JSON.stringify(snapshot)],
    );
    await c.query("UPDATE client SET status='Actif' WHERE id=$1", [clientId]);
    await audit(c, actor, "service.created", s.rows[0].id, { snapshot });
    return s.rows[0];
  });
}

export async function recordPayment(
  serviceId: string,
  raw: unknown,
  actor: string,
) {
  z.uuid().parse(serviceId);
  const x = paymentInput.parse(raw);

  if (isMysqlMode()) {
    return mysqlTransaction(async (conn) => {
      const [found] = await conn.execute(
        "SELECT * FROM services WHERE id = ? FOR UPDATE",
        [serviceId],
      );
      const s = (found as Record<string, unknown>[])[0];
      if (!s) throw new HttpError(404, "Prestation introuvable");
      const snapshot = parseJsonCol<{
        totalCents: number;
        paidMinutes: number;
        potentialBonusMinutes: number;
      }>(s.price_snapshot);

      const [prev] = await conn.execute(
        "SELECT * FROM payments WHERE request_id = ? LIMIT 1",
        [x.requestId],
      );
      if (Array.isArray(prev) && prev.length > 0) {
        const p = prev[0] as Record<string, unknown>;
        if (
          p.service_id !== serviceId ||
          Number(p.amount_cents) !== x.amountCents ||
          p.method !== x.method
        ) {
          throw new HttpError(409, "Clé de paiement déjà utilisée");
        }
        return p;
      }

      const [sumRows] = await conn.execute(
        "SELECT COALESCE(SUM(amount_cents), 0) AS total, COUNT(*) AS count FROM payments WHERE service_id = ?",
        [serviceId],
      );
      const paid = (sumRows as Record<string, unknown>[])[0];
      const paidTotal = Number(paid.total || 0);
      const paidCount = Number(paid.count || 0);

      if (paidTotal + x.amountCents > snapshot.totalCents) {
        throw new HttpError(422, "Le paiement dépasse le montant restant dû");
      }

      const paymentId = randomUUID();
      await conn.execute(
        "INSERT INTO payments (id, service_id, amount_cents, method, created_by, request_id) VALUES (?, ?, ?, ?, ?, ?)",
        [paymentId, serviceId, x.amountCents, x.method, actor, x.requestId],
      );

      if (paidTotal + x.amountCents === snapshot.totalCents) {
        await conn.execute(
          "INSERT INTO hour_ledger (id, service_id, minutes, kind, reason, created_by) VALUES (?, ?, ?, 'purchase', 'Prestation intégralement payée', ?)",
          [randomUUID(), serviceId, snapshot.paidMinutes, actor],
        );
        if (paidCount === 0 && snapshot.potentialBonusMinutes > 0) {
          await conn.execute(
            "INSERT INTO hour_ledger (id, service_id, minutes, kind, reason, created_by) VALUES (?, ?, ?, 'bonus', 'Forfait payé en une fois', ?)",
            [randomUUID(), serviceId, snapshot.potentialBonusMinutes, actor],
          );
        }
      }

      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, 'payment.recorded', 'service', ?, ?)`,
        [
          randomUUID(),
          actor,
          serviceId,
          JSON.stringify({ paymentId, amountCents: x.amountCents }),
        ],
      );

      const [created] = await conn.execute("SELECT * FROM payments WHERE id = ?", [
        paymentId,
      ]);
      return (created as Record<string, unknown>[])[0];
    });
  }

  return transaction(async (c) => {
    const found = await c.query(
      "SELECT * FROM service WHERE id=$1 FOR UPDATE",
      [serviceId],
    );
    if (!found.rowCount) throw new HttpError(404, "Prestation introuvable");
    const s = found.rows[0];
    const previous = await c.query(
      "SELECT * FROM payment WHERE request_id=$1",
      [x.requestId],
    );
    if (previous.rowCount) {
      const p = previous.rows[0];
      if (
        p.service_id !== serviceId ||
        p.amount_cents !== x.amountCents ||
        p.method !== x.method
      )
        throw new HttpError(409, "Clé de paiement déjà utilisée");
      return p;
    }
    const sum = await c.query(
      "SELECT COALESCE(sum(amount_cents),0)::integer AS total,count(*)::integer AS count FROM payment WHERE service_id=$1",
      [serviceId],
    );
    const paid = sum.rows[0];
    if (paid.total + x.amountCents > s.price_snapshot.totalCents)
      throw new HttpError(422, "Le paiement dépasse le montant restant dû");
    const p = await c.query(
      "INSERT INTO payment(service_id,amount_cents,method,created_by,request_id) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [serviceId, x.amountCents, x.method, actor, x.requestId],
    );
    if (paid.total + x.amountCents === s.price_snapshot.totalCents) {
      await c.query(
        "INSERT INTO hour_ledger(service_id,minutes,kind,reason,created_by) VALUES($1,$2,'purchase','Prestation intégralement payée',$3)",
        [serviceId, s.price_snapshot.paidMinutes, actor],
      );
      if (paid.count === 0 && s.price_snapshot.potentialBonusMinutes > 0)
        await c.query(
          "INSERT INTO hour_ledger(service_id,minutes,kind,reason,created_by) VALUES($1,$2,'bonus','Forfait payé en une fois',$3)",
          [serviceId, s.price_snapshot.potentialBonusMinutes, actor],
        );
    }
    await audit(c, actor, "payment.recorded", serviceId, {
      paymentId: p.rows[0].id,
      amountCents: x.amountCents,
    });
    return p.rows[0];
  });
}

const supportEnum = z.enum(["GoPermis", "Personnel"]);
const modelIdsInput = z.array(z.string().min(1).max(80)).max(50).default([]);

const catalogInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rate"), id: z.uuid(), cents: z.number().int().min(100).max(100000) }),
  z.object({
    kind: z.literal("rateCreate"),
    model: z.string().min(1).max(80),
    support: supportEnum,
    cents: z.number().int().min(100).max(100000),
  }),
  z.object({
    kind: z.literal("model"),
    label: z.string().trim().min(2).max(150),
    rates: z
      .array(z.object({ support: supportEnum, cents: z.number().int().min(100).max(100000) }))
      .min(1, "Indiquez au moins un tarif horaire")
      .max(2),
  }),
  z.object({
    kind: z.literal("offer"),
    id: z.string().min(1).max(80),
    label: z.string().trim().min(1).max(100),
    paidMinutes: z.number().int().min(30).max(60000),
    bonusMinutes: z.number().int().min(0).max(60000),
    modelIds: modelIdsInput.optional(),
  }),
  z.object({
    kind: z.literal("offerCreate"),
    label: z.string().trim().min(1).max(100),
    paidMinutes: z.number().int().min(30).max(60000),
    bonusMinutes: z.number().int().min(0).max(60000),
    modelIds: modelIdsInput,
  }),
  z.object({ kind: z.literal("offerArchive"), id: z.string().min(1).max(80) }),
]);

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });

export async function updateCatalog(raw: unknown, actor: string) {
  const x = catalogInput.parse(raw);
  if ("rates" in x && new Set(x.rates.map((r) => r.support)).size !== x.rates.length)
    throw new HttpError(422, "Un seul tarif par type d'encadrement.");

  if (isMysqlMode()) {
    return mysqlTransaction(async (conn) => {
      const exec = async (sql: string, params: (string | number | null)[] = []) =>
        (await conn.execute(sql, params))[0] as { affectedRows?: number } & Record<string, unknown>[];
      const modelExists = async (id: string) =>
        ((await exec("SELECT id FROM vehicle_models WHERE id = ?", [id])) as unknown[]).length > 0;
      const checkModels = async (ids: string[]) => {
        for (const id of ids) if (!(await modelExists(id))) throw new HttpError(422, "Modèle de véhicule inconnu");
      };
      let entityId = "";

      if (x.kind === "rate") {
        const res = await exec("UPDATE tariff_versions SET cents = ? WHERE id = ?", [x.cents, x.id]);
        if (res.affectedRows === 0) throw new HttpError(404, "Tarif introuvable");
        entityId = x.id;
      } else if (x.kind === "rateCreate") {
        await checkModels([x.model]);
        const dup = await exec(
          "SELECT id FROM tariff_versions WHERE model = ? AND support = ? AND (valid_to IS NULL OR valid_to > ?)",
          [x.model, x.support, today()],
        );
        if ((dup as unknown[]).length) throw new HttpError(409, "Ce tarif existe déjà : modifiez-le.");
        entityId = randomUUID();
        await exec(
          "INSERT INTO tariff_versions (id, model, support, cents, valid_from) VALUES (?, ?, ?, ?, ?)",
          [entityId, x.model, x.support, x.cents, today()],
        );
      } else if (x.kind === "model") {
        let id = slugId(x.label);
        for (let n = 2; await modelExists(id); n++) id = `${slugId(x.label)}-${n}`;
        await exec("INSERT INTO vehicle_models (id, label) VALUES (?, ?)", [id, x.label]);
        for (const r of x.rates)
          await exec(
            "INSERT INTO tariff_versions (id, model, support, cents, valid_from) VALUES (?, ?, ?, ?, ?)",
            [randomUUID(), id, r.support, r.cents, today()],
          );
        entityId = id;
      } else if (x.kind === "offer" || x.kind === "offerCreate") {
        if (x.kind === "offer") {
          const res = await exec(
            "UPDATE offers SET label = ?, paid_minutes = ?, bonus_minutes = ? WHERE id = ?",
            [x.label, x.paidMinutes, x.bonusMinutes, x.id],
          );
          if (res.affectedRows === 0) throw new HttpError(404, "Offre introuvable");
          entityId = x.id;
        } else {
          let id = slugId(x.label);
          const offerExists = async (v: string) =>
            ((await exec("SELECT id FROM offers WHERE id = ?", [v])) as unknown[]).length > 0;
          for (let n = 2; await offerExists(id); n++) id = `${slugId(x.label)}-${n}`;
          await exec(
            "INSERT INTO offers (id, label, paid_minutes, bonus_minutes, single_payment, active) VALUES (?, ?, ?, ?, 1, 1)",
            [id, x.label, x.paidMinutes, x.bonusMinutes],
          );
          entityId = id;
        }
        if (x.modelIds) {
          await checkModels(x.modelIds);
          await exec("DELETE FROM offer_models WHERE offer_id = ?", [entityId]);
          for (const m of new Set(x.modelIds))
            await exec("INSERT INTO offer_models (offer_id, model_id) VALUES (?, ?)", [entityId, m]);
        }
      } else {
        const res = await exec("UPDATE offers SET active = 0 WHERE id = ?", [x.id]);
        if (res.affectedRows === 0) throw new HttpError(404, "Offre introuvable");
        entityId = x.id;
      }
      await exec(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, 'catalog.updated', 'catalog', ?, ?)`,
        [randomUUID(), actor, entityId.slice(0, 36), JSON.stringify({ kind: x.kind, id: entityId })],
      );
      return { ok: true, id: entityId };
    });
  }

  return transaction(async (c) => {
    const modelExists = async (id: string) =>
      Boolean((await c.query("SELECT id FROM vehicle_model WHERE id = $1", [id])).rowCount);
    const checkModels = async (ids: string[]) => {
      for (const id of ids) if (!(await modelExists(id))) throw new HttpError(422, "Modèle de véhicule inconnu");
    };
    let entityId = "";
    if (x.kind === "rate") {
      const updated = await c.query("UPDATE tariff_version SET cents = $1 WHERE id = $2 RETURNING id", [x.cents, x.id]);
      if (!updated.rowCount) throw new HttpError(404, "Tarif introuvable");
      entityId = x.id;
    } else if (x.kind === "rateCreate") {
      await checkModels([x.model]);
      const dup = await c.query(
        "SELECT id FROM tariff_version WHERE model = $1 AND support = $2 AND (valid_to IS NULL OR valid_to > $3::date)",
        [x.model, x.support, today()],
      );
      if (dup.rowCount) throw new HttpError(409, "Ce tarif existe déjà : modifiez-le.");
      const ins = await c.query(
        "INSERT INTO tariff_version (model, support, cents, valid_from) VALUES ($1, $2, $3, $4) RETURNING id",
        [x.model, x.support, x.cents, today()],
      );
      entityId = String(ins.rows[0].id);
    } else if (x.kind === "model") {
      let id = slugId(x.label);
      for (let n = 2; await modelExists(id); n++) id = `${slugId(x.label)}-${n}`;
      await c.query("INSERT INTO vehicle_model (id, label) VALUES ($1, $2)", [id, x.label]);
      for (const r of x.rates)
        await c.query("INSERT INTO tariff_version (model, support, cents, valid_from) VALUES ($1, $2, $3, $4)", [
          id,
          r.support,
          r.cents,
          today(),
        ]);
      entityId = id;
    } else if (x.kind === "offer" || x.kind === "offerCreate") {
      if (x.kind === "offer") {
        const updated = await c.query(
          "UPDATE offer SET label = $1, paid_minutes = $2, bonus_minutes = $3 WHERE id = $4 RETURNING id",
          [x.label, x.paidMinutes, x.bonusMinutes, x.id],
        );
        if (!updated.rowCount) throw new HttpError(404, "Offre introuvable");
        entityId = x.id;
      } else {
        let id = slugId(x.label);
        for (let n = 2; (await c.query("SELECT id FROM offer WHERE id = $1", [id])).rowCount; n++)
          id = `${slugId(x.label)}-${n}`;
        await c.query(
          "INSERT INTO offer (id, label, paid_minutes, bonus_minutes, single_payment, active) VALUES ($1, $2, $3, $4, true, true)",
          [id, x.label, x.paidMinutes, x.bonusMinutes],
        );
        entityId = id;
      }
      if (x.modelIds) {
        await checkModels(x.modelIds);
        await c.query("DELETE FROM offer_model WHERE offer_id = $1", [entityId]);
        for (const m of new Set(x.modelIds))
          await c.query("INSERT INTO offer_model (offer_id, model_id) VALUES ($1, $2)", [entityId, m]);
      }
    } else {
      const updated = await c.query("UPDATE offer SET active = false WHERE id = $1 RETURNING id", [x.id]);
      if (!updated.rowCount) throw new HttpError(404, "Offre introuvable");
      entityId = x.id;
    }
    await audit(c, actor, "catalog.updated", actor, { kind: x.kind, catalogId: entityId });
    return { ok: true, id: entityId };
  });
}

export async function deleteClient(id: string, actor: string) {
  const validId = z.string().uuid().parse(id);

  if (isMysqlMode()) {
    return mysqlTransaction(async (conn) => {
      const [res] = await conn.execute(
        "UPDATE clients SET status = 'Archivé', version = version + 1 WHERE id = ? AND status <> 'Archivé'",
        [validId],
      );
      if ((res as { affectedRows?: number }).affectedRows) {
        await conn.execute(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
           VALUES (?, ?, 'client.archived', 'client', ?, '{}')`,
          [randomUUID(), actor, validId],
        );
      }
      return { ok: true };
    });
  }

  return transaction(async (c) => {
    const result = await c.query(
      "UPDATE client SET status='Archivé',version=version+1,updated_at=now() WHERE id=$1 AND status<>'Archivé' RETURNING id",
      [validId],
    );
    if (result.rowCount) await audit(c, actor, "client.archived", validId);
    return { ok: true };
  });
}
