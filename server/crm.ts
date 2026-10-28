import { z } from "zod";
import type { PoolClient } from "pg";
import { db } from "./db";
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
export async function catalog() {
  const [rates, offers, types, models] = await Promise.all([
    db().query(
      `SELECT id,model,support,cents,to_char(valid_from,'YYYY-MM-DD') AS "validFrom",to_char(valid_to,'YYYY-MM-DD') AS "validTo" FROM tariff_version`,
    ),
    db().query(
      'SELECT id,label,paid_minutes AS "paidMinutes",bonus_minutes AS "bonusMinutes",single_payment AS "singlePayment" FROM offer WHERE active',
    ),
    db().query("SELECT id,label,pricing_mode FROM service_type WHERE active"),
    db().query("SELECT * FROM vehicle_model"),
  ]);
  return {
    rates: rates.rows as Rate[],
    offers: offers.rows as (Offer & { label: string })[],
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

export async function updateCatalog(raw: unknown, actor: string) {
  const x = z
    .discriminatedUnion("kind", [
      z.object({
        kind: z.literal("rate"),
        id: z.uuid(),
        cents: z.number().int().min(100),
      }),
      z.object({
        kind: z.literal("offer"),
        id: z.string(),
        label: z.string().trim().min(1).max(100),
        paidMinutes: z.number().int().min(1),
        bonusMinutes: z.number().int().min(0),
      }),
    ])
    .parse(raw);

  return transaction(async (c) => {
    if (x.kind === "rate") {
      const updated=await c.query("UPDATE tariff_version SET cents = $1 WHERE id = $2 RETURNING id", [
        x.cents,
        x.id,
      ]);
      if(!updated.rowCount) throw new HttpError(404,"Tarif introuvable");
    } else {
      const updated=await c.query(
        "UPDATE offer SET label = $1, paid_minutes = $2, bonus_minutes = $3 WHERE id = $4 RETURNING id",
        [x.label, x.paidMinutes, x.bonusMinutes, x.id],
      );
      if(!updated.rowCount) throw new HttpError(404,"Offre introuvable");
    }
    await audit(c, actor, "catalog.updated", actor, { kind: x.kind, catalogId:x.id });
    return { ok: true };
  });
}

export async function deleteClient(id: string, actor: string) {
  const validId = z.string().uuid().parse(id);
  return transaction(async (c) => {
    const result=await c.query("UPDATE client SET status='Archivé',version=version+1,updated_at=now() WHERE id=$1 AND status<>'Archivé' RETURNING id",[validId]);
    if(result.rowCount) await audit(c,actor,"client.archived",validId);
    return { ok: true };
  });
}

