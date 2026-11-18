"use client";
import { useCallback, useEffect, useState } from "react";
import { api, type Resources, type Catalog } from "../lib/api-types";
import { IntervalFields, localInstant, displayDate } from "./schedule";
import { Car, UserCheck, Plus, Edit2, Archive, CheckCircle2, AlertCircle } from "lucide-react";
import { Modal } from "./modal";

export const PLAN_SWATCHES = ["#e5484d", "#8e4ec6", "#12a594", "#3e7bfa", "#d6409f", "#e8833a", "#65a30d", "#0ea5e9", "#f59e0b", "#64748b"];

function ColorPicker({ value, onChange, disabled }: { value: string; onChange: (c: string) => void; disabled?: boolean }) {
  return (
    <div className="colorPicker" role="radiogroup">
      {PLAN_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === c}
          aria-label={c}
          disabled={disabled}
          className={value.toLowerCase() === c ? "active" : ""}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
      <label className="colorCustom" title="Couleur personnalisée">
        <input type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

/** « Clio manuelle — Personnel 25 €/h · GoPermis 35 €/h » */
function modelOptionLabel(cat: Catalog, m: { id: string; label: string }) {
  const rates = cat.rates
    .filter((r) => r.model === m.id && !r.validTo)
    .map((r) => `${r.support} ${(r.cents / 100).toLocaleString("fr-FR")} €/h`);
  return rates.length ? `${m.label} — ${rates.join(" · ")}` : `${m.label} (aucun tarif)`;
}

export function ResourceSettings({
  can,
  cat,
}: {
  can: (p: string) => boolean;
  cat: Catalog;
}) {
  const [data, setData] = useState<Resources | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // Edit Modals
  const [editingVehicle, setEditingVehicle] = useState<{ id: string; label: string; model_id: string; active: boolean } | null>(null);
  const [editingInstructor, setEditingInstructor] = useState<{ id: string; name: string; active: boolean; color: string } | null>(null);
  const [colors, setColors] = useState<{ companion: string; exam: string } | null>(null);
  const [newVehicleModal, setNewVehicleModal] = useState(false);
  const [newInstructorModal, setNewInstructorModal] = useState(false);

  const refresh = useCallback(
    async () => setData(await api<Resources>("resources")),
    [],
  );

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);

  async function save(fn: () => Promise<unknown>, successMsg = "Modification enregistrée.") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await refresh();
      setMessage(successMsg);
      setEditingVehicle(null);
      setEditingInstructor(null);
      setNewVehicleModal(false);
      setNewInstructorModal(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="resourcesWorkspace">
      <div className="resourcesHeader">
        <div>
          <span className="profileEyebrow">FLOTTE & ÉQUIPE</span>
          <h1 className="resourcesTitle">Véhicules & Moniteurs</h1>
          <p className="resourcesSubtitle">
            Gérez les ressources de conduite et planifiez les indisponibilités matérielles ou d&apos;équipe.
          </p>
        </div>

        <div className="resourcesHeaderActions">
          {can("resources.write") && (
            <>
              <button
                type="button"
                className="btnSmallGray"
                onClick={() => setNewInstructorModal(true)}
              >
                <Plus size={14} /> Nouveau moniteur
              </button>
              <button
                type="button"
                className="btnPrimary"
                onClick={() => setNewVehicleModal(true)}
              >
                <Plus size={14} /> Ajouter un véhicule
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="calendarAlert errorAlert">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {message && (
        <div className="calendarAlert successAlert">
          <CheckCircle2 size={16} />
          <span>{message}</span>
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}

      {!data ? (
        <p className="loadingText">Chargement des ressources…</p>
      ) : (
        <div className="resourcesGridCompact">
          {/* 1. Véhicules de la flotte (Compact Cards) */}
          <div className="resourceSectionCard">
            <div className="sectionCardHeader">
              <div className="sectionTitleWithBadge">
                <Car size={18} />
                <h3 className="sectionCardTitle">Véhicules de la flotte</h3>
                <span className="badgeNeutral">{data.vehicles.length}</span>
              </div>
            </div>

            <div className="resourceCompactList">
              {data.vehicles.length === 0 ? (
                <p className="emptyHelp">Aucun véhicule enregistré pour le moment.</p>
              ) : (
                data.vehicles.map((v) => (
                  <div key={v.id} className="resourceCompactItem">
                    <div className="resourceItemIcon car">
                      <Car size={18} />
                    </div>
                    <div className="resourceItemMeta">
                      <strong>{v.label}</strong>
                      <span className="resourceSubText">
                        {v.model_label} · {v.active ? "En service" : "Archivé"}
                      </span>
                      <span className="vehicleTariffs">
                        {cat.rates
                          .filter((r) => r.model === v.model_id && !r.validTo)
                          .map((r) => (
                            <span key={r.id} className="chip">
                              {r.support} {(r.cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}/h
                            </span>
                          ))}
                        {(() => {
                          const n = cat.offers.filter(
                            (o) => !o.modelIds || o.modelIds.length === 0 || o.modelIds.includes(v.model_id),
                          ).length;
                          return (
                            <span className="chip accent">
                              {n} offre{n > 1 ? "s" : ""}
                            </span>
                          );
                        })()}
                        {!cat.rates.some((r) => r.model === v.model_id) && (
                          <span className="chip warn">Aucun tarif pour ce modèle</span>
                        )}
                      </span>
                    </div>

                    <div className="resourceItemActions">
                      {can("resources.write") && (
                        <button
                          type="button"
                          className="btnIconTiny"
                          title="Modifier"
                          onClick={() =>
                            setEditingVehicle({
                              id: v.id,
                              label: v.label,
                              model_id: v.model_id,
                              active: v.active,
                            })
                          }
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      {v.active && can("resources.write") && (
                        <button
                          type="button"
                          className="btnIconTiny danger"
                          title="Archiver"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Archiver le véhicule ${v.label} ?`)) {
                              void save(
                                () =>
                                  api("resources/archive", {
                                    kind: "vehicle",
                                    id: v.id,
                                  }),
                                "Véhicule archivé."
                              );
                            }
                          }}
                        >
                          <Archive size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Moniteurs de l'équipe (Compact Cards) */}
          <div className="resourceSectionCard">
            <div className="sectionCardHeader">
              <div className="sectionTitleWithBadge">
                <UserCheck size={18} />
                <h3 className="sectionCardTitle">Moniteurs de l&apos;équipe</h3>
                <span className="badgeNeutral">{data.instructors.length}</span>
              </div>
            </div>

            <div className="resourceCompactList">
              {data.instructors.length === 0 ? (
                <p className="emptyHelp">Aucun moniteur enregistré pour le moment.</p>
              ) : (
                data.instructors.map((i) => (
                  <div key={i.id} className="resourceCompactItem">
                    <div
                      className="resourceItemIcon user"
                      style={{ background: i.color || PLAN_SWATCHES[data.instructors.indexOf(i) % PLAN_SWATCHES.length], color: "#fff" }}
                      title="Couleur dans le planning"
                    >
                      <UserCheck size={18} />
                    </div>
                    <div className="resourceItemMeta">
                      <strong>{i.name}</strong>
                      <span className="resourceSubText">{i.active ? "Actif" : "Archivé"}</span>
                    </div>

                    <div className="resourceItemActions">
                      {can("resources.write") && (
                        <button
                          type="button"
                          className="btnIconTiny"
                          title="Modifier"
                          onClick={() =>
                            setEditingInstructor({
                              id: i.id,
                              name: i.name,
                              active: i.active,
                              color: i.color || PLAN_SWATCHES[data.instructors.indexOf(i) % PLAN_SWATCHES.length],
                            })
                          }
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      {i.active && can("resources.write") && (
                        <button
                          type="button"
                          className="btnIconTiny danger"
                          title="Archiver"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Archiver le moniteur ${i.name} ?`)) {
                              void save(
                                () =>
                                  api("resources/archive", {
                                    kind: "instructor",
                                    id: i.id,
                                  }),
                                "Moniteur archivé."
                              );
                            }
                          }}
                        >
                          <Archive size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Couleurs du planning */}
          <div className="resourceSectionCard fullWidthCard planColorsCard">
            <div className="sectionCardHeader">
              <h3 className="sectionCardTitle">Couleurs du planning</h3>
              <span className="subHeadingHint">
                Chaque moniteur a sa couleur (bouton modifier). Réglez ici les séances sans moniteur GoPermis.
              </span>
            </div>
            <div className="planColorsGrid">
              {(["companion", "exam"] as const).map((k) => {
                const current = colors ?? data.planningColors ?? { companion: "#0ea5e9", exam: "#f59e0b" };
                return (
                  <div key={k} className="planColorItem">
                    <strong>{k === "companion" ? "Accompagnateur personnel" : "Examen pratique"}</strong>
                    <small>
                      {k === "companion"
                        ? "Séances supervisées par un proche de l'élève, sans moniteur GoPermis."
                        : "Passages d'examen, sans accompagnateur GoPermis."}
                    </small>
                    <ColorPicker
                      value={current[k]}
                      disabled={!can("resources.write")}
                      onChange={(c) => setColors({ ...current, [k]: c })}
                    />
                  </div>
                );
              })}
            </div>
            {colors && can("resources.write") && (
              <div className="modalButtonsRow">
                <button type="button" className="btnSecondary" onClick={() => setColors(null)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btnPrimary"
                  disabled={busy}
                  onClick={() => void save(() => api("planning/colors", colors), "Couleurs du planning enregistrées.").then(() => setColors(null))}
                >
                  Enregistrer les couleurs
                </button>
              </div>
            )}
          </div>

          {/* 3. Indisponibilités explicites */}
          <div className="resourceSectionCard fullWidthCard">
            <div className="sectionCardHeader">
              <h3 className="sectionCardTitle">Indisponibilités explicites</h3>
              <span className="subHeadingHint">
                Bloquez des créneaux pour maintenance ou absences.
              </span>
            </div>

            <div className="unavailContentGrid">
              <div className="unavailList">
                {data.blocks.length === 0 ? (
                  <p className="emptyHelp">Aucune indisponibilité active.</p>
                ) : (
                  data.blocks.map((b) => (
                    <div className="unavailItem" key={b.id}>
                      <div>
                        <strong>{b.vehicle_label || b.instructor_name || b.client_name}</strong>
                        <p className="unavailDates">
                          {displayDate(b.starts_at)} → {displayDate(b.ends_at)}
                        </p>
                        <p className="unavailReason">Motif : {b.reason}</p>
                      </div>
                      {can("resources.write") && (
                        <button
                          type="button"
                          className="btnSmallGray"
                          disabled={busy}
                          onClick={() =>
                            void save(
                              () => api("unavailability/" + b.id + "/release", {}),
                              "Indisponibilité levée."
                            )
                          }
                        >
                          Lever
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {can("resources.write") && (
                <form
                  className="unavailForm"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const [kind, resourceId] = String(f.get("resource")).split(":");
                    try {
                      const body = {
                        kind,
                        resourceId,
                        reason: f.get("reason"),
                        startsAt: localInstant(f.get("startsAt")),
                        endsAt: localInstant(f.get("endsAt")),
                      };
                      void save(() => api("unavailability", body), "Indisponibilité enregistrée.");
                      e.currentTarget.reset();
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  <label>
                    Ressource concernée
                    <select name="resource" required defaultValue="">
                      <option value="" disabled>
                        Choisir une ressource
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
                    <input name="reason" required maxLength={500} placeholder="ex: Révision mécanique, congés..." />
                  </label>
                  <button type="submit" className="btnPrimary" disabled={busy}>
                    {busy ? "Enregistrement…" : "Enregistrer l'indisponibilité"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Modifier un véhicule */}
      {editingVehicle && (
        <Modal title="Modifier le véhicule" close={() => setEditingVehicle(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                () =>
                  api("resources/update", {
                    kind: "vehicle",
                    id: editingVehicle.id,
                    label: editingVehicle.label,
                    modelId: editingVehicle.model_id,
                    active: editingVehicle.active,
                  }),
                "Véhicule mis à jour avec succès."
              );
            }}
          >
            <label>
              Identifiant / Immatriculation
              <input
                type="text"
                value={editingVehicle.label}
                onChange={(e) =>
                  setEditingVehicle({ ...editingVehicle, label: e.target.value })
                }
                required
                maxLength={100}
              />
            </label>

            <label>
              Modèle
              <select
                value={editingVehicle.model_id}
                onChange={(e) =>
                  setEditingVehicle({ ...editingVehicle, model_id: e.target.value })
                }
              >
                {cat.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {modelOptionLabel(cat, m)}
                  </option>
                ))}
              </select>
            </label>

            <label className="checkboxInline">
              <input
                type="checkbox"
                checked={editingVehicle.active}
                onChange={(e) =>
                  setEditingVehicle({ ...editingVehicle, active: e.target.checked })
                }
              />
              <span>Véhicule actif (disponible pour réservation)</span>
            </label>

            <div className="modalButtonsRow">
              <button
                type="button"
                className="btnSecondary"
                onClick={() => setEditingVehicle(null)}
              >
                Annuler
              </button>
              <button type="submit" className="btnPrimary" disabled={busy}>
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Modifier un moniteur */}
      {editingInstructor && (
        <Modal title="Modifier le moniteur" close={() => setEditingInstructor(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                () =>
                  api("resources/update", {
                    kind: "instructor",
                    id: editingInstructor.id,
                    name: editingInstructor.name,
                    active: editingInstructor.active,
                    color: editingInstructor.color,
                  }),
                "Moniteur mis à jour avec succès."
              );
            }}
          >
            <label>
              Nom complet du moniteur
              <input
                type="text"
                value={editingInstructor.name}
                onChange={(e) =>
                  setEditingInstructor({ ...editingInstructor, name: e.target.value })
                }
                required
                maxLength={150}
              />
            </label>

            <span className="formLabel">Couleur dans le planning</span>
            <ColorPicker value={editingInstructor.color} onChange={(c) => setEditingInstructor({ ...editingInstructor, color: c })} />

            <label className="checkboxInline">
              <input
                type="checkbox"
                checked={editingInstructor.active}
                onChange={(e) =>
                  setEditingInstructor({ ...editingInstructor, active: e.target.checked })
                }
              />
              <span>Moniteur actif</span>
            </label>

            <div className="modalButtonsRow">
              <button
                type="button"
                className="btnSecondary"
                onClick={() => setEditingInstructor(null)}
              >
                Annuler
              </button>
              <button type="submit" className="btnPrimary" disabled={busy}>
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Nouveau véhicule */}
      {newVehicleModal && (
        <Modal title="Ajouter un véhicule" close={() => setNewVehicleModal(false)}>
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
                "Véhicule ajouté."
              );
            }}
          >
            <label>
              Libellé / Immatriculation
              <input
                name="label"
                required
                maxLength={100}
                placeholder="ex: Clio V Manuelle (04)"
              />
            </label>
            <label>
              Modèle
              <select name="modelId">
                {cat.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {modelOptionLabel(cat, m)}
                  </option>
                ))}
              </select>
            </label>
            <div className="modalButtonsRow">
              <button
                type="button"
                className="btnSecondary"
                onClick={() => setNewVehicleModal(false)}
              >
                Annuler
              </button>
              <button type="submit" className="btnPrimary" disabled={busy}>
                Ajouter
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Nouveau moniteur */}
      {newInstructorModal && (
        <Modal title="Ajouter un moniteur" close={() => setNewInstructorModal(false)}>
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
                "Moniteur ajouté."
              );
            }}
          >
            <label>
              Nom du moniteur
              <input name="name" required maxLength={150} placeholder="ex: Jean Dupont" />
            </label>
            <div className="modalButtonsRow">
              <button
                type="button"
                className="btnSecondary"
                onClick={() => setNewInstructorModal(false)}
              >
                Annuler
              </button>
              <button type="submit" className="btnPrimary" disabled={busy}>
                Ajouter
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
