"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  api,
  type Booking,
  type Resources,
  type Detail,
} from "../lib/api-types";
import { Modal } from "./modal";
export const displayDate = (value: string) =>
  new Date(value).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });
export function localInstant(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  const date = new Date(text);
  const parts = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (
    !parts ||
    !Number.isFinite(date.getTime()) ||
    [
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
    ].some((n, i) => n !== Number(parts[i + 1]))
  )
    throw new Error("Horaire local invalide, notamment au changement d’heure.");
  return date.toISOString();
}
export function IntervalFields() {
  return (
    <>
      <p className="emptyHint">
        Saisie dans le fuseau du navigateur :{" "}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}. Affichage des
        séances : Europe/Paris.
      </p>
      <div className="formGrid">
        <label>
          Début
          <input type="datetime-local" name="startsAt" required step="60" />
        </label>
        <label>
          Fin
          <input type="datetime-local" name="endsAt" required step="60" />
        </label>
      </div>
    </>
  );
}
export function Schedule({
  can,
  detail,
  reload,
}: {
  can: (p: string) => boolean;
  detail?: Detail;
  reload?: () => Promise<void>;
}) {
  const [date, setDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }),
  );
  const latest = useRef(0);
  const [rows, setRows] = useState<Booking[]>([]),
    [resources, setResources] = useState<Resources | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [serviceId, setServiceId] = useState(""),
    [requestId, setRequestId] = useState("");
  const refresh = useCallback(async () => {
    const current = ++latest.current;
    setLoading(true);
    const [b, r] = await Promise.all([
      api<Booking[]>(
        "bookings" +
          (detail
            ? "?clientId=" + detail.client.id
            : date
              ? "?date=" + date
              : ""),
      ),
      api<Resources>("resources"),
    ]);
    if (current === latest.current) {
      setRows(b);
      setResources(r);
      setLoading(false);
    }
  }, [detail, date]);
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refresh]);
  const service = detail?.services.find((s) => s.id === serviceId);
  async function perform(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setServiceId("");
      setMessage(success);
      await refresh();
      await reload?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card schedulePanel">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">PLANNING · EUROPE/PARIS</p>
          <h2>
            {detail ? "Séances du client" : "Séances confirmées et réalisées"}
          </h2>
        </div>
        <button
          disabled={busy || loading}
          onClick={() => void perform(async () => {}, "Planning actualisé")}
        >
          Actualiser
        </button>
      </div>
      {!detail && (
        <div className="planningFilter">
          <label>
            Journée · Europe/Paris
            <input
              type="date"
              aria-label="Journée du planning"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button
            onClick={() =>
              setDate(
                new Date().toLocaleDateString("en-CA", {
                  timeZone: "Europe/Paris",
                }),
              )
            }
          >
            Aujourd’hui
          </button>
          <button onClick={() => setDate("")}>Toutes les séances</button>
        </div>
      )}
      <p>
        La planification est autorisée sans crédit. La réalisation exige un
        crédit suffisant et consomme les heures une seule fois.
      </p>
      {loading && <p role="status">Chargement du planning…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {detail && can("schedule.write") && (
        <div className="bookingActions">
          {detail.services
            .filter((s) => s.status === "Active")
            .map((s) => (
              <button
                disabled={busy || !resources}
                key={s.id}
                onClick={() => {
                  setError("");
                  setServiceId(s.id);
                  setRequestId(crypto.randomUUID());
                }}
              >
                Réserver · {s.label} · {s.id.slice(0, 8)}
              </button>
            ))}
        </div>
      )}
      {!loading && rows.length === 0 && (
        <p>
          Aucune séance enregistrée.
          {detail
            ? " Choisissez une prestation pour réserver."
            : " Les réservations se créent depuis la fiche client."}
        </p>
      )}
      {rows.length >= 500 && (
        <p>
          500 dernières séances affichées. Consultez la fiche client pour
          affiner.
        </p>
      )}
      <div className="sessionList">
        {rows.map((b) => (
          <article className="sessionRow" key={b.id}>
            <div>
              <strong>
                {displayDate(b.starts_at)} → {displayDate(b.ends_at)}
              </strong>
              <p>
                {b.first_name} {b.last_name} · {b.minutes / 60} h
              </p>
              <p>
                {b.vehicle_label} ·{" "}
                {b.instructor_name ?? "Personnel : " + b.companion_name}
              </p>
              <small>
                Prestation {b.service_id.slice(0, 8)} · Séance{" "}
                {b.id.slice(0, 8)}
              </small>
            </div>
            <div>
              <span className="statusPill">
                {b.status === "completed" ? "Réalisée" : "Confirmée"}
              </span>
              {b.completed_at && (
                <p>
                  <small>Validée le {displayDate(b.completed_at)}</small>
                </p>
              )}
              {b.status === "confirmed" && can("sessions.complete") && (
                <button
                  disabled={busy || new Date(b.ends_at).getTime() > Date.now()}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Marquer cette séance réalisée et consommer ${b.minutes / 60} h ?`,
                      )
                    )
                      void perform(
                        () => api("bookings/" + b.id + "/complete", {}),
                        "Séance réalisée. Journal des heures actualisé.",
                      );
                  }}
                >
                  Marquer réalisée · {b.minutes / 60} h
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {service && resources && (
        <Modal
          title="Confirmer une réservation"
          close={() => {
            if (!busy) setServiceId("");
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                const body = {
                  vehicleId: f.get("vehicleId"),
                  instructorId: f.get("instructorId") || null,
                  startsAt: localInstant(f.get("startsAt")),
                  endsAt: localInstant(f.get("endsAt")),
                  requestId,
                  ...(service.price_snapshot.support === "Personnel"
                    ? {
                        companionName: f.get("companionName"),
                        companionLicenseDate: f.get("companionLicenseDate"),
                      }
                    : {}),
                };
                void perform(
                  () => api("services/" + service.id + "/bookings", body),
                  "Réservation confirmée.",
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <p>
              {service.label} · Accompagnement {service.price_snapshot.support}{" "}
              · Référence {service.id.slice(0, 8)}
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <label>
              Véhicule physique
              <select name="vehicleId" required defaultValue="">
                <option value="" disabled>
                  Choisir un véhicule compatible
                </option>
                {resources.vehicles
                  .filter(
                    (v) =>
                      v.active && v.model_id === service.price_snapshot.model,
                  )
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} · {v.model_label}
                    </option>
                  ))}
              </select>
            </label>
            {service.price_snapshot.support === "GoPermis" ? (
              <label>
                Moniteur
                <select name="instructorId" required defaultValue="">
                  <option value="" disabled>
                    Choisir un moniteur
                  </option>
                  {resources.instructors
                    .filter((i) => i.active)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <>
                <label>
                  Nom de l’accompagnateur personnel
                  <input name="companionName" required maxLength={150} />
                </label>
                <label>
                  Date d’obtention de son permis
                  <input type="date" name="companionLicenseDate" required />
                </label>
                <small>
                  Cinq ans révolus à la date de la séance. Vérifier les
                  justificatifs.
                </small>
              </>
            )}
            <IntervalFields />
            <p>
              Cette action confirme la réservation et bloque les ressources.
              Elle ne consomme pas d’heures.
            </p>
            <button className="primary" disabled={busy}>
              {busy ? "Vérification…" : "Vérifier et confirmer"}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
