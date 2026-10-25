"use client";
import { useCallback, useEffect, useState } from "react";
import { api, type Resources, type Catalog } from "../lib/api-types";
import { IntervalFields, localInstant, displayDate } from "./schedule";
export function ResourceSettings({
  can,
  cat,
}: {
  can: (p: string) => boolean;
  cat: Catalog;
}) {
  const [data, setData] = useState<Resources | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const refresh = useCallback(
    async () => setData(await api<Resources>("resources")),
    [],
  );
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);
  async function save(fn: () => Promise<unknown>, form?: HTMLFormElement) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      form?.reset();
      await refresh();
      setMessage("Modification enregistrée.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">CONFIGURATION DU PLANNING</p>
          <h1>Ressources & indisponibilités</h1>
          <p>
            Aucune ressource réelle n’est créée automatiquement. Enregistrez les
            véhicules et moniteurs GoPermis.
          </p>
        </div>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {!data ? (
        <p>Chargement…</p>
      ) : (
        <div className="detailGrid resourcesGrid">
          <section className="card">
            <h2>Véhicules physiques</h2>
            {data.vehicles.length === 0 && <p>Aucun véhicule.</p>}
            {data.vehicles.map((v) => (
              <div className="resourceRow" key={v.id}>
                <p>
                  <b>{v.label}</b>
                  <br />
                  {v.model_label} · {v.active ? "Actif" : "Archivé"}
                </p>
                {v.active && can("resources.write") && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void save(() =>
                        api("resources/archive", { kind: "vehicle", id: v.id }),
                      )
                    }
                  >
                    Archiver
                  </button>
                )}
              </div>
            ))}
            {can("resources.write") && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void save(
                    () =>
                      api("resources", {
                        kind: "vehicle",
                        label: f.get("label"),
                        modelId: f.get("modelId"),
                      }),
                    e.currentTarget,
                  );
                }}
              >
                <label>
                  Identifiant du véhicule
                  <input
                    name="label"
                    required
                    maxLength={100}
                    placeholder="Libellé interne ou immatriculation"
                  />
                </label>
                <label>
                  Modèle
                  <select name="modelId">
                    {cat.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={busy}>Ajouter le véhicule</button>
              </form>
            )}
          </section>
          <section className="card">
            <h2>Moniteurs</h2>
            <p>
              Ces ressources de planning n’ouvrent aucun compte et n’accordent
              aucun droit.
            </p>
            {data.instructors.length === 0 && <p>Aucun moniteur.</p>}
            {data.instructors.map((i) => (
              <div className="resourceRow" key={i.id}>
                <p>
                  <b>{i.name}</b> · {i.active ? "Actif" : "Archivé"}
                </p>
                {i.active && can("resources.write") && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void save(() =>
                        api("resources/archive", {
                          kind: "instructor",
                          id: i.id,
                        }),
                      )
                    }
                  >
                    Archiver
                  </button>
                )}
              </div>
            ))}
            {can("resources.write") && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void save(
                    () =>
                      api("resources", {
                        kind: "instructor",
                        name: f.get("name"),
                      }),
                    e.currentTarget,
                  );
                }}
              >
                <label>
                  Nom du moniteur
                  <input name="name" required maxLength={150} />
                </label>
                <button disabled={busy}>Ajouter le moniteur</button>
              </form>
            )}
          </section>
          <section className="card span2">
            <h2>Indisponibilités explicites</h2>
            <p>
              Les créneaux déjà réservés ne peuvent pas devenir indisponibles.
              Aucune amplitude d’ouverture ou disponibilité récurrente n’est
              présumée.
            </p>
            {data.blocks.map((b) => (
              <div className="resourceRow" key={b.id}>
                <p>
                  <b>{b.vehicle_label || b.instructor_name || b.client_name}</b>
                  <br />
                  {displayDate(b.starts_at)} → {displayDate(b.ends_at)}
                  <br />
                  {b.reason}
                </p>
                {can("resources.write") && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void save(() =>
                        api("unavailability/" + b.id + "/release", {}),
                      )
                    }
                  >
                    Lever l’indisponibilité
                  </button>
                )}
              </div>
            ))}
            {data.blocks.length === 0 && <p>Aucune indisponibilité active.</p>}
            {can("resources.write") && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const [kind, resourceId] = String(f.get("resource")).split(
                    ":",
                  );
                  try {
                    const body = {
                      kind,
                      resourceId,
                      reason: f.get("reason"),
                      startsAt: localInstant(f.get("startsAt")),
                      endsAt: localInstant(f.get("endsAt")),
                    };
                    void save(
                      () => api("unavailability", body),
                      e.currentTarget,
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <label>
                  Ressource
                  <select name="resource" required defaultValue="">
                    <option value="" disabled>
                      Choisir
                    </option>
                    <optgroup label="Véhicules">
                      {data.vehicles
                        .filter((v) => v.active)
                        .map((v) => (
                          <option key={v.id} value={"vehicle:" + v.id}>
                            {v.label}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Moniteurs">
                      {data.instructors
                        .filter((i) => i.active)
                        .map((i) => (
                          <option key={i.id} value={"instructor:" + i.id}>
                            {i.name}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </label>
                <IntervalFields />
                <label>
                  Motif
                  <input name="reason" required maxLength={500} />
                </label>
                <button disabled={busy}>Enregistrer l’indisponibilité</button>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
