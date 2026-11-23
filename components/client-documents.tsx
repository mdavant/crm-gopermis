"use client";
import React, { useEffect, useMemo, useState } from "react";
import { FileSignature, ShieldCheck, Download, Eye, Clock3, CalendarCheck2, Hourglass, Gift, X } from "lucide-react";
import { api, type Booking, type Catalog, type Detail, type Resources } from "../lib/api-types";
import { Modal } from "./modal";

type GeneratedDoc = {
  id: string;
  kind: "rental" | "insurance";
  documentId: string | null;
  url: string | null;
  fileName: string | null;
  size: number;
  signatureDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  totalCents: number | null;
  vehicleLabel: string | null;
  createdAt: string;
  createdBy: string | null;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const frDay = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
/** Les périodes sont enregistrées en heure locale : on lit la date ISO sans décalage. */
const frPeriod = (a: string | null, b: string | null) =>
  a && b ? `${frDay(a)} ${a.slice(11, 16).replace(":", "h")} → ${a.slice(0, 10) === b.slice(0, 10) ? "" : frDay(b) + " "}${b.slice(11, 16).replace(":", "h")}` : "";
const money = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const localParts = (iso: string) => {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
};
const hoursLabel = (min: number) => {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${min < 0 ? "-" : ""}${h} h${m ? String(m).padStart(2, "0") : ""}`;
};

/** Suivi des heures de l'élève (achetées, offertes, réalisées, restantes, à venir). */
export function ClientHoursSummary({ d, bookings }: { d: Detail; bookings: Booking[] }) {
  const s = useMemo(() => {
    const bought = d.ledger.filter((l) => l.kind === "purchase").reduce((a, l) => a + l.minutes, 0);
    const bonus = d.ledger.filter((l) => l.kind === "bonus").reduce((a, l) => a + l.minutes, 0);
    const balance = d.ledger.reduce((a, l) => a + l.minutes, 0);
    const done = bookings.filter((b) => b.status === "completed").reduce((a, b) => a + (b.minutes || 0), 0);
    const now = Date.now();
    const upcoming = bookings.filter((b) => b.status === "confirmed" && new Date(b.starts_at).getTime() > now);
    return { bought, bonus, balance, done, upcoming, upcomingMin: upcoming.reduce((a, b) => a + (b.minutes || 0), 0) };
  }, [d.ledger, bookings]);
  const next = s.upcoming.sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  return (
    <section className="card span3 hoursStrip">
      <div className="hoursItem">
        <Clock3 size={18} />
        <div>
          <strong>{hoursLabel(s.done)}</strong>
          <span>Heures réalisées</span>
        </div>
      </div>
      <div className="hoursItem">
        <Hourglass size={18} />
        <div>
          <strong>{hoursLabel(s.balance)}</strong>
          <span>Solde d&apos;heures</span>
        </div>
      </div>
      <div className="hoursItem">
        <Gift size={18} />
        <div>
          <strong>
            {hoursLabel(s.bought)}
            {s.bonus ? ` + ${hoursLabel(s.bonus)}` : ""}
          </strong>
          <span>Achetées{s.bonus ? " + offertes" : ""}</span>
        </div>
      </div>
      <div className="hoursItem">
        <CalendarCheck2 size={18} />
        <div>
          <strong>
            {s.upcoming.length} séance{s.upcoming.length > 1 ? "s" : ""} · {hoursLabel(s.upcomingMin)}
          </strong>
          <span>
            À venir
            {next ? ` · prochaine le ${new Date(next.starts_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}` : ""}
          </span>
        </div>
      </div>
    </section>
  );
}

type Draft = {
  kind: "rental" | "insurance";
  vehicleId: string;
  bookingId: string;
  signatureDate: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  hourly: string;
  total: string;
  totalTouched: boolean;
};

export function ClientDocuments({
  d,
  cat,
  can,
  bookings,
}: {
  d: Detail;
  cat: Catalog;
  can: (p: string) => boolean;
  bookings: Booking[];
}) {
  const [docs, setDocs] = useState<GeneratedDoc[]>([]);
  const [resources, setResources] = useState<Resources | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<GeneratedDoc | null>(null);
  const canWrite = can("documents.write");

  const load = () =>
    api<GeneratedDoc[]>(`clients/${d.client.id}/generated`)
      .then(setDocs)
      .catch(() => setDocs([]));

  useEffect(() => {
    void load();
    if (can("schedule.read")) api<Resources>("resources").then(setResources).catch(() => setResources(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.client.id]);

  const vehicles = useMemo(() => (resources?.vehicles ?? []).filter((v) => v.active), [resources]);
  const personalRate = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    const r = cat.rates.find((x) => x.model === v?.model_id && x.support === "Personnel" && !x.validTo);
    return r ? r.cents / 100 : 0;
  };
  const minutesOf = (x: Draft) => {
    const a = new Date(`${x.startDate}T${x.startTime}:00`).getTime();
    const b = new Date(`${x.endDate}T${x.endTime}:00`).getTime();
    return Math.max(0, Math.round((b - a) / 60000));
  };
  const autoTotal = (x: Draft) => {
    const h = parseFloat(x.hourly.replace(",", ".")) || 0;
    return String(Math.round(h * (minutesOf(x) / 60) * 100) / 100);
  };
  const update = (patch: Partial<Draft>) => {
    if (!draft) return;
    const next = { ...draft, ...patch };
    if (!next.totalTouched) next.total = autoTotal(next);
    setDraft(next);
  };

  const missing = (kind: Draft["kind"]) => {
    const c = d.client;
    const list: string[] = [];
    if (kind === "rental") {
      if (!c.birth_date) list.push("date de naissance");
      if (!c.address) list.push("adresse");
    }
    return list;
  };

  const start = (kind: Draft["kind"]) => {
    setError("");
    const upcoming = bookings
      .filter((b) => b.status !== "completed" || kind === "rental")
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    const b = upcoming.find((x) => new Date(x.starts_at).getTime() > Date.now()) ?? upcoming[0];
    const vehicleId = b?.vehicle_id && vehicles.some((v) => v.id === b.vehicle_id) ? b.vehicle_id : vehicles[0]?.id ?? "";
    const s = b ? localParts(b.starts_at) : { date: today(), time: "09:00" };
    const e = b ? localParts(b.ends_at) : { date: today(), time: "10:00" };
    const base: Draft = {
      kind,
      vehicleId,
      bookingId: b?.id ?? "",
      signatureDate: kind === "rental" ? s.date : today(),
      startDate: s.date,
      startTime: s.time,
      endDate: e.date,
      endTime: e.time,
      hourly: String(personalRate(vehicleId) || ""),
      total: "",
      totalTouched: false,
    };
    base.total = autoTotal(base);
    setDraft(base);
  };

  const applyBooking = (id: string) => {
    const b = bookings.find((x) => x.id === id);
    if (!b || !draft) return update({ bookingId: "" });
    const s = localParts(b.starts_at);
    const e = localParts(b.ends_at);
    const vehicleId = vehicles.some((v) => v.id === b.vehicle_id) ? b.vehicle_id : draft.vehicleId;
    update({ bookingId: id, vehicleId, startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time, hourly: String(personalRate(vehicleId) || draft.hourly) });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const body =
        draft.kind === "rental"
          ? {
              kind: "rental",
              vehicleId: draft.vehicleId,
              bookingId: draft.bookingId || undefined,
              signatureDate: draft.signatureDate,
              startDate: draft.startDate,
              startTime: draft.startTime,
              endDate: draft.endDate,
              endTime: draft.endTime,
              hourlyCents: draft.hourly ? Math.round((parseFloat(draft.hourly.replace(",", ".")) || 0) * 100) : null,
              totalCents: Math.round((parseFloat(draft.total.replace(",", ".")) || 0) * 100),
            }
          : { kind: "insurance", vehicleId: draft.vehicleId, bookingId: draft.bookingId || undefined, signatureDate: draft.signatureDate };
      const res = await api<{ url: string; fileName: string }>(`clients/${d.client.id}/generate`, body);
      setDraft(null);
      await load();
      const a = document.createElement("a");
      a.href = res.url;
      a.download = res.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const vehicleOf = (id: string) => vehicles.find((v) => v.id === id);
  const v = draft ? vehicleOf(draft.vehicleId) : undefined;
  const vehicleProblem =
    draft && v
      ? !v.registration_number
        ? "Immatriculation manquante pour ce véhicule."
        : draft.kind === "insurance" && !v.insurance_signatory
          ? "Signataire de l'attestation manquant pour ce véhicule."
          : ""
      : "";

  return (
    <section className="card span3 clientDocs">
      <div className="clientDocsHead">
        <div>
          <h2>Documents</h2>
          <small>Fiches de location et attestations d&apos;assurance générées pour cet élève.</small>
        </div>
        {canWrite && (
          <div className="clientDocsActions">
            <button type="button" className="btnSecondary" onClick={() => start("insurance")} disabled={!vehicles.length}>
              <ShieldCheck size={15} /> Générer l&apos;attestation d&apos;assurance
            </button>
            <button type="button" className="btnPrimary" onClick={() => start("rental")} disabled={!vehicles.length}>
              <FileSignature size={15} /> Générer la fiche de location
            </button>
          </div>
        )}
      </div>

      {docs.length === 0 ? (
        <p className="emptyHelp">Aucun document généré pour le moment.</p>
      ) : (
        <div className="genDocList">
          {docs.map((g) => (
            <div key={g.id} className="genDoc">
              <span className={`genDocIcon ${g.kind}`}>{g.kind === "rental" ? <FileSignature size={17} /> : <ShieldCheck size={17} />}</span>
              <div className="genDocMain">
                <strong>{g.kind === "rental" ? "Fiche de location" : "Attestation d'assurance"}</strong>
                <span>
                  {g.vehicleLabel ?? "Véhicule"} · signée le {frDay(g.signatureDate)}
                  {g.kind === "rental" && g.periodStart ? ` · ${frPeriod(g.periodStart, g.periodEnd)}` : ""}
                  {g.totalCents !== null ? ` · ${money(g.totalCents)}` : ""}
                </span>
                <small>
                  Générée le {new Date(g.createdAt).toLocaleDateString("fr-FR")} {g.createdBy ? `par ${g.createdBy}` : ""}
                </small>
              </div>
              {g.url && (
                <div className="genDocBtns">
                  <button type="button" className="btnIconTiny" title="Aperçu" onClick={() => setPreview(g)}>
                    <Eye size={14} />
                  </button>
                  <a className="btnIconTiny" title="Télécharger" href={g.url} download={g.fileName ?? undefined}>
                    <Download size={14} />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {draft && (
        <Modal
          wide
          title={draft.kind === "rental" ? "Générer la fiche de location" : "Générer l'attestation d'assurance"}
          close={() => setDraft(null)}
        >
          <form onSubmit={submit} className="genForm">
            {missing(draft.kind).length > 0 && (
              <p className="genWarn">
                À compléter dans la fiche de l&apos;élève : {missing(draft.kind).join(", ")}. Le document sera généré avec ces champs
                vides.
              </p>
            )}
            {bookings.length > 0 && (
              <label>
                Reprendre une séance
                <select value={draft.bookingId} onChange={(e) => applyBooking(e.target.value)}>
                  <option value="">— Saisie libre —</option>
                  {[...bookings]
                    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {new Date(b.starts_at).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{" "}
                        · {b.vehicle_label}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              Véhicule
              <select value={draft.vehicleId} onChange={(e) => update({ vehicleId: e.target.value, hourly: String(personalRate(e.target.value) || draft.hourly) })} required>
                {vehicles.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                    {x.registration_number ? ` — ${x.registration_number}` : " — immatriculation manquante"}
                  </option>
                ))}
              </select>
            </label>
            {vehicleProblem && <p className="genWarn">{vehicleProblem} À compléter dans Données → Véhicules & moniteurs.</p>}

            {draft.kind === "rental" && (
              <>
                <span className="formLabel">Période de location</span>
                <div className="genGrid4">
                  <label>
                    Début
                    <input type="date" value={draft.startDate} onChange={(e) => update({ startDate: e.target.value, endDate: draft.endDate < e.target.value ? e.target.value : draft.endDate })} required />
                  </label>
                  <label>
                    Heure
                    <input type="time" value={draft.startTime} onChange={(e) => update({ startTime: e.target.value })} required />
                  </label>
                  <label>
                    Fin
                    <input type="date" value={draft.endDate} min={draft.startDate} onChange={(e) => update({ endDate: e.target.value })} required />
                  </label>
                  <label>
                    Heure
                    <input type="time" value={draft.endTime} onChange={(e) => update({ endTime: e.target.value })} required />
                  </label>
                </div>
                <div className="formGrid">
                  <label>
                    Prix de l&apos;heure (€)
                    <input inputMode="decimal" value={draft.hourly} onChange={(e) => update({ hourly: e.target.value })} placeholder="ex : 30" />
                  </label>
                  <label>
                    Prix total (€) {minutesOf(draft) > 0 && <small>pour {hoursLabel(minutesOf(draft))}</small>}
                    <input
                      inputMode="decimal"
                      value={draft.total}
                      onChange={(e) => setDraft({ ...draft, total: e.target.value, totalTouched: true })}
                      required
                    />
                  </label>
                </div>
              </>
            )}

            <label>
              Date de signature
              <input type="date" value={draft.signatureDate} onChange={(e) => update({ signatureDate: e.target.value })} required />
            </label>
            {error && <p className="genWarn error">{error}</p>}
            <div className="modalButtonsRow">
              <button type="button" className="btnSecondary" onClick={() => setDraft(null)}>
                Annuler
              </button>
              <button type="submit" className="btnPrimary" disabled={busy || !draft.vehicleId || !!vehicleProblem}>
                {busy ? "Génération…" : "Générer le PDF"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {preview?.url && (
        <div className="dPreview" onClick={() => setPreview(null)} role="dialog" aria-modal="true">
          <div className="dPreviewBar" onClick={(e) => e.stopPropagation()}>
            <strong>{preview.fileName}</strong>
            <small />
            <a className="btnSecondary" href={preview.url} download={preview.fileName ?? undefined}>
              <Download size={15} /> Télécharger
            </a>
            <button type="button" className="dPreviewClose" onClick={() => setPreview(null)} aria-label="Fermer">
              <X size={18} />
            </button>
          </div>
          <div className="dPreviewBody" onClick={(e) => e.stopPropagation()}>
            <iframe src={`${preview.url}?inline=1`} title={preview.fileName ?? "Document"} className="dPreviewFrame" />
          </div>
        </div>
      )}
    </section>
  );
}
