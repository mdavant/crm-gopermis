"use client";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { api, type Detail, type Catalog } from "../lib/api-types";
import { quote } from "../domain/pricing";
import { Schedule } from "./schedule";
import { Modal } from "./modal";
const money = (n: number) =>
  (n / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const date = (s: string) =>
  new Date(s).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
const actionLabels: Record<string, string> = {
  "client.created": "Client créé",
  "service.created": "Prestation créée",
  "payment.recorded": "Paiement enregistré",
  "note.created": "Note ajoutée",
  "booking.confirmed": "Réservation confirmée",
  "session.completed": "Séance réalisée · heures consommées",
};
export function ClientDetail({
  detail: d,
  cat,
  can,
  back,
  reload,
  onError,
}: {
  detail: Detail;
  cat: Catalog;
  can: (p: string) => boolean;
  back: () => void;
  reload: () => Promise<void>;
  onError: (e: string) => void;
}) {
  const [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [model, setModel] = useState("clio-manual"),
    [support, setSupport] = useState("GoPermis"),
    [offer, setOffer] = useState("10+1"),
    [hours, setHours] = useState(1),
    [type, setType] = useState("extra"),
    [payment, setPayment] = useState<string | null>(null),
    [requestId, setRequestId] = useState("");
  const minutes = offer
    ? cat.offers.find((o) => o.id === offer)!.paidMinutes
    : hours * 60;
  let price: ReturnType<typeof quote> | null = null;
  try {
    price = quote(cat.rates, cat.offers, {
      model,
      support,
      minutes,
      offerId: offer || undefined,
      date: new Date().toLocaleDateString("en-CA", {
        timeZone: "Europe/Paris",
      }),
    });
  } catch {}
  async function perform(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    onError("");
    try {
      await fn();
      after?.();
      await reload();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="backBtn" onClick={back}>
        <ArrowLeft size={17} /> Clients
      </button>
      <div className="clientHero">
        <div className="bigAvatar">
          {d.client.first_name[0]}
          {d.client.last_name[0]}
        </div>
        <div>
          <p className="eyebrow">FICHE CLIENT</p>
          <h1>
            {d.client.first_name} {d.client.last_name}
          </h1>
          <p>
            {d.client.phone} · {d.client.email || "Email non renseigné"}
          </p>
        </div>
        {can("services.write") && (
          <button className="primary" onClick={() => setAdding(true)}>
            <Plus size={17} /> Nouvelle prestation
          </button>
        )}
      </div>
      {can("schedule.read") && (
        <Schedule can={can} detail={d} reload={reload} />
      )}
      <div className="detailGrid">
        <section className="card">
          <h2>Coordonnées & origine</h2>
          <p>
            {d.client.phone}
            <br />
            {d.client.email}
          </p>
          <p>
            {d.client.source} · {d.client.status}
          </p>
          <small>
            Créé le {date(d.client.created_at)}
            <br />
            Référence : {d.client.id}
          </small>
        </section>
        <section className="card span2">
          <h2>
            Prestations <span className="statusPill">{d.services.length}</span>
          </h2>
          {d.services.length === 0 && (
            <p>Aucune prestation. Créez le premier besoin de ce client.</p>
          )}
          {d.services.map((s) => {
            const p = s.price_snapshot;
            const ledger = d.ledger.filter((l) => l.service_id === s.id);
            const balance = ledger.reduce((a, l) => a + l.minutes, 0);
            const paid = d.payments
              .filter((x) => x.service_id === s.id)
              .reduce((a, x) => a + x.amount_cents, 0);
            return (
              <article className="serviceBlock" key={s.id}>
                <div className="sectionHead">
                  <div>
                    <h2>
                      {s.label} <small>· {s.id.slice(0, 8)}</small>
                    </h2>
                    <p>
                      {cat.models.find((m) => m.id === p.model)?.label} ·{" "}
                      {p.support}
                    </p>
                  </div>
                  <span className="statusPill">{s.status}</span>
                </div>
                <div className="serviceFacts">
                  <div>
                    <span>Tarif accepté</span>
                    <b>{money(p.unitCents)}/h</b>
                  </div>
                  <div>
                    <span>Prestation</span>
                    <b>{money(p.totalCents)}</b>
                  </div>
                  <div>
                    <span>Crédit actuel</span>
                    <b>{balance / 60} h</b>
                  </div>
                  <div>
                    <span>Forfait prévu</span>
                    <b>
                      {p.paidMinutes / 60} h + {p.potentialBonusMinutes / 60} h
                      bonus
                    </b>
                  </div>
                </div>
                {can("payments.read") && (
                  <p>
                    Reçu : {money(paid)} · Reste à payer :{" "}
                    {money(p.totalCents - paid)}
                  </p>
                )}
                {can("payments.write") && paid < p.totalCents && (
                  <button
                    onClick={() => {
                      setPayment(s.id);
                      setRequestId(crypto.randomUUID());
                    }}
                  >
                    Enregistrer un paiement
                  </button>
                )}
                <small>
                  Règle provisoire : heures créditées à paiement intégral. Bonus
                  uniquement si réglé en une fois.
                </small>
                {ledger.map((l) => (
                  <p key={l.id} className="ledger">
                    {l.minutes > 0 ? "+" : ""}
                    {l.minutes / 60} h · {l.reason}
                  </p>
                ))}
              </article>
            );
          })}
        </section>
        <section className="card span2">
          <h2>Notes</h2>
          {can("clients.write") && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const body = new FormData(form).get("body");
                void perform(
                  () => api("clients/" + d.client.id + "/notes", { body }),
                  () => form.reset(),
                );
              }}
            >
              <label>
                Ajouter une note
                <textarea name="body" required maxLength={5000} />
              </label>
              <button disabled={busy}>Enregistrer la note</button>
            </form>
          )}
          {d.notes.map((n) => (
            <div className="note" key={n.id}>
              <p>{n.body}</p>
              <small>
                {n.author} · {date(n.created_at)}
              </small>
            </div>
          ))}
        </section>
        {can("payments.read") && (
          <section className="card">
            <h2>Paiements reçus</h2>
            {!d.payments.length && <p>Aucun règlement enregistré.</p>}
            {d.payments.map((p) => (
              <div className="rowItem" key={p.id}>
                <div>
                  <b>
                    {money(p.amount_cents)} · {p.method}
                  </b>
                  <p>{date(p.created_at)}</p>
                </div>
              </div>
            ))}
          </section>
        )}
        {can("audit.read") && (
          <section className="card span2">
            <h2>Historique</h2>
            {d.history.map((h, i) => (
              <p key={i}>
                {actionLabels[h.action] ?? h.action} · {h.actor}
                <br />
                <small>{date(h.created_at)}</small>
              </p>
            ))}
          </section>
        )}
      </div>
      {adding && (
        <Modal title="Nouvelle prestation" close={() => setAdding(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void perform(
                () =>
                  api("clients/" + d.client.id + "/services", {
                    typeId: type,
                    model,
                    support,
                    minutes,
                    offerId: offer || undefined,
                  }),
                () => setAdding(false),
              );
            }}
          >
            <label>
              Besoin
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {cat.types.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    disabled={t.pricing_mode === "quote"}
                  >
                    {t.label}
                    {t.pricing_mode === "quote" ? " · devis requis" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Modèle de véhicule
              <select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  if (e.target.value === "rs3") setSupport("GoPermis");
                }}
              >
                {cat.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Accompagnement
              <select
                value={support}
                onChange={(e) => setSupport(e.target.value)}
              >
                <option>GoPermis</option>
                <option disabled={model === "rs3"}>Personnel</option>
              </select>
            </label>
            <label>
              Forfait
              <select value={offer} onChange={(e) => setOffer(e.target.value)}>
                <option value="">À l’heure</option>
                {cat.offers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {!offer && (
              <label>
                Heures payantes
                <input
                  type="number"
                  min="0.5"
                  max="1000"
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                />
              </label>
            )}
            <div className="quote">
              <span>Total de la prestation</span>
              <strong>
                {price ? money(price.totalCents) : "Combinaison indisponible"}
              </strong>
              <p>Le bonus éventuel sera attribué après paiement en une fois.</p>
            </div>
            <button className="primary" disabled={busy || !price}>
              Créer la prestation
            </button>
          </form>
        </Modal>
      )}
      {payment && (
        <Modal
          title="Enregistrer un paiement reçu"
          close={() => setPayment(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void perform(
                () =>
                  api("services/" + payment + "/payments", {
                    amountCents: Math.round(Number(f.get("amount")) * 100),
                    method: f.get("method"),
                    requestId,
                  }),
                () => setPayment(null),
              );
            }}
          >
            <p>
              Cette action enregistre un règlement déjà reçu. Elle ne débite
              aucune carte.
            </p>
            <label>
              Montant reçu (€)
              <input
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                required
                autoFocus
              />
            </label>
            <label>
              Mode de paiement
              <select name="method">
                <option>Carte</option>
                <option>Virement</option>
                <option>Espèces</option>
              </select>
            </label>
            <button className="primary" disabled={busy}>
              Confirmer le paiement reçu
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
