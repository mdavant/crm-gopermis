"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Car, Tag, Edit2, CheckCircle2, AlertCircle, Plus, Archive, Layers } from "lucide-react";
import { api, type Catalog, type Resources } from "../lib/api-types";
import { Modal } from "./modal";

const money = (n: number) => (n / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const hours = (min: number) => `${(min / 60).toLocaleString("fr-FR")} h`;
const SUPPORTS = ["Personnel", "GoPermis"] as const;
const SUPPORT_HINT: Record<string, string> = {
  Personnel: "Avec l'accompagnateur de l'élève",
  GoPermis: "Avec un moniteur GoPermis",
};

interface PricingViewProps {
  cat: Catalog;
  can: (p: string) => boolean;
  onRefresh: () => Promise<void>;
}

type OfferDraft = {
  id?: string;
  label: string;
  paidHours: number;
  bonusHours: number;
  modelIds: string[];
};

export function PricingView({ cat, can, onRefresh }: PricingViewProps) {
  const canWrite = can("catalog.write");
  const [vehicles, setVehicles] = useState<Resources["vehicles"]>([]);
  const [editingRate, setEditingRate] = useState<{ id?: string; model: string; modelLabel: string; support: string; euros: number } | null>(null);
  const [offerDraft, setOfferDraft] = useState<OfferDraft | null>(null);
  const [modelDraft, setModelDraft] = useState<{ label: string; personnel: string; gopermis: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!can("schedule.read")) return;
    api<Resources>("resources")
      .then((r) => setVehicles(r.vehicles))
      .catch(() => setVehicles([]));
  }, [can]);

  const modelLabel = useMemo(() => new Map(cat.models.map((m) => [m.id, m.label])), [cat.models]);
  const offersFor = (modelId: string) =>
    cat.offers.filter((o) => !o.modelIds || o.modelIds.length === 0 || o.modelIds.includes(modelId));

  async function run(fn: () => Promise<unknown>, success: string, close: () => void) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await onRefresh();
      setMessage(success);
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const saveRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRate) return;
    const cents = Math.round(editingRate.euros * 100);
    void run(
      () =>
        editingRate.id
          ? api("catalog/update", { kind: "rate", id: editingRate.id, cents })
          : api("catalog/update", { kind: "rateCreate", model: editingRate.model, support: editingRate.support, cents }),
      editingRate.id ? "Tarif mis à jour." : "Tarif ajouté.",
      () => setEditingRate(null),
    );
  };

  const saveOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerDraft) return;
    const body = {
      label: offerDraft.label,
      paidMinutes: Math.round(offerDraft.paidHours * 60),
      bonusMinutes: Math.round(offerDraft.bonusHours * 60),
      modelIds: offerDraft.modelIds,
    };
    void run(
      () =>
        offerDraft.id
          ? api("catalog/update", { kind: "offer", id: offerDraft.id, ...body })
          : api("catalog/update", { kind: "offerCreate", ...body }),
      offerDraft.id ? "Offre mise à jour." : "Offre créée.",
      () => setOfferDraft(null),
    );
  };

  const saveModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelDraft) return;
    const rates = [
      { support: "Personnel", euros: modelDraft.personnel },
      { support: "GoPermis", euros: modelDraft.gopermis },
    ]
      .filter((r) => r.euros.trim() !== "")
      .map((r) => ({ support: r.support, cents: Math.round(parseFloat(r.euros.replace(",", ".")) * 100) }));
    void run(
      () => api("catalog/update", { kind: "model", label: modelDraft.label, rates }),
      "Modèle et tarifs créés. Vous pouvez maintenant y rattacher des véhicules.",
      () => setModelDraft(null),
    );
  };

  return (
    <div className="pricingWorkspace">
      <div className="pricingHeader">
        <div>
          <span className="profileEyebrow">CATALOGUE OFFICIEL</span>
          <h1 className="pricingTitle">Tarifs & Offres</h1>
          <p className="pricingSubtitle">
            Chaque véhicule hérite des tarifs de son modèle. Les offres s&apos;appliquent à tous les modèles ou à ceux que
            vous choisissez.
          </p>
        </div>
        {canWrite && (
          <div className="pricingHeaderActions">
            <button type="button" className="btnSecondary" onClick={() => setModelDraft({ label: "", personnel: "", gopermis: "" })}>
              <Layers size={15} /> Nouveau modèle
            </button>
            <button
              type="button"
              className="btnPrimary"
              onClick={() => setOfferDraft({ label: "", paidHours: 10, bonusHours: 1, modelIds: [] })}
            >
              <Plus size={15} /> Nouvelle offre
            </button>
          </div>
        )}
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

      <div className="pricingSection">
        <h2 className="pricingSectionTitle">Tarifs horaires par modèle</h2>
        <div className="pricingCardsGrid">
          {cat.models.map((m) => {
            const modelRates = cat.rates.filter((r) => r.model === m.id && !r.validTo);
            const missing = SUPPORTS.filter((s) => !modelRates.some((r) => r.support === s) && !(m.id === "rs3" && s === "Personnel"));
            const fleet = vehicles.filter((v) => v.model_id === m.id && v.active);
            const offers = offersFor(m.id);
            return (
              <div key={m.id} className="pricingCard">
                <div className="pricingCardHeader">
                  <div className="pricingModelIcon">
                    <Car size={20} />
                  </div>
                  <div>
                    <h3 className="pricingModelName">{m.label}</h3>
                    <span className="pricingModelId">
                      {fleet.length} véhicule{fleet.length > 1 ? "s" : ""} en service
                    </span>
                  </div>
                </div>

                <div className="pricingRateList">
                  {modelRates.map((r) => (
                    <div key={r.id} className="pricingRateRow">
                      <div className="rateMeta">
                        <strong>{r.support}</strong>
                        <span className="rateDate">{SUPPORT_HINT[r.support] ?? ""}</span>
                      </div>
                      <div className="ratePriceWrap">
                        <span className="ratePriceValue">{money(r.cents)}/h</span>
                        {canWrite && (
                          <button
                            type="button"
                            className="btnIconTiny"
                            title="Modifier ce tarif"
                            onClick={() =>
                              setEditingRate({ id: r.id, model: r.model, modelLabel: m.label, support: r.support, euros: r.cents / 100 })
                            }
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {canWrite &&
                    missing.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="addRateRow"
                        onClick={() => setEditingRate({ model: m.id, modelLabel: m.label, support: s, euros: 30 })}
                      >
                        <Plus size={14} /> Ajouter le tarif {s}
                      </button>
                    ))}
                  {m.id === "rs3" && (
                    <div className="specialNoticeBox">
                      <span>Accompagnement GoPermis uniquement sur RS3.</span>
                    </div>
                  )}
                </div>

                <div className="pricingLinks">
                  <span className="pricingLinksLabel">Véhicules</span>
                  <div className="chipRow">
                    {fleet.length === 0 ? (
                      <span className="chip muted">Aucun véhicule rattaché</span>
                    ) : (
                      fleet.map((v) => (
                        <span key={v.id} className="chip">
                          {v.label}
                        </span>
                      ))
                    )}
                  </div>
                  <span className="pricingLinksLabel">Offres applicables</span>
                  <div className="chipRow">
                    {offers.length === 0 ? (
                      <span className="chip muted">Aucune offre</span>
                    ) : (
                      offers.map((o) => (
                        <span key={o.id} className="chip accent">
                          {o.label}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pricingSection">
        <h2 className="pricingSectionTitle">Formules et forfaits</h2>
        {cat.offers.length === 0 && <p className="emptyHelp">Aucune offre active. Créez-en une avec « Nouvelle offre ».</p>}
        <div className="offersCardsGrid">
          {cat.offers.map((o) => {
            const ids = o.modelIds ?? [];
            return (
              <div key={o.id} className="offerCard">
                <div className="offerCardHeader">
                  <div className="offerIconBox">
                    <Tag size={18} />
                  </div>
                  <div className="offerTitleArea">
                    <h3 className="offerTitle">{o.label}</h3>
                    <span className="offerSummary">
                      {hours(o.paidMinutes)} payées + {hours(o.bonusMinutes)} offertes
                    </span>
                  </div>
                  {canWrite && (
                    <div className="offerActions">
                      <button
                        type="button"
                        className="btnIconTiny"
                        title="Modifier cette offre"
                        onClick={() =>
                          setOfferDraft({
                            id: o.id,
                            label: o.label,
                            paidHours: o.paidMinutes / 60,
                            bonusHours: o.bonusMinutes / 60,
                            modelIds: [...ids],
                          })
                        }
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="btnIconTiny danger"
                        title="Archiver cette offre"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Archiver l'offre « ${o.label} » ? Les prestations déjà vendues ne changent pas.`))
                            void run(() => api("catalog/update", { kind: "offerArchive", id: o.id }), "Offre archivée.", () => {});
                        }}
                      >
                        <Archive size={13} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="chipRow">
                  {ids.length === 0 ? (
                    <span className="chip">Tous les modèles</span>
                  ) : (
                    ids.map((id) => (
                      <span key={id} className="chip">
                        {modelLabel.get(id) ?? id}
                      </span>
                    ))
                  )}
                </div>
                <p className="offerFinePrint">Bonus attribué après paiement intégral en une fois.</p>
              </div>
            );
          })}
        </div>
      </div>

      {editingRate && (
        <Modal title={editingRate.id ? "Modifier le tarif horaire" : "Ajouter un tarif"} close={() => setEditingRate(null)}>
          <form onSubmit={saveRate}>
            <p className="modalNotice">
              Modèle : <strong>{editingRate.modelLabel}</strong> · Encadrement : <strong>{editingRate.support}</strong>
            </p>
            <label>
              Tarif horaire (€ TTC)
              <input
                type="number"
                step="0.5"
                min="1"
                max="1000"
                value={editingRate.euros}
                onChange={(e) => setEditingRate({ ...editingRate, euros: parseFloat(e.target.value) || 0 })}
                required
              />
            </label>
            <div className="modalButtonsRow">
              <button type="button" className="btnSecondary" onClick={() => setEditingRate(null)}>
                Annuler
              </button>
              <button type="submit" className="btnPrimary" disabled={busy}>
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modelDraft && (
        <Modal title="Nouveau modèle de véhicule" close={() => setModelDraft(null)}>
          <form onSubmit={saveModel}>
            <label>
              Nom du modèle
              <input
                value={modelDraft.label}
                onChange={(e) => setModelDraft({ ...modelDraft, label: e.target.value })}
                placeholder="ex : Peugeot 208 automatique"
                required
                minLength={2}
                maxLength={150}
              />
            </label>
            <div className="formGrid">
              <label>
                Tarif Personnel (€/h)
                <input
                  inputMode="decimal"
                  value={modelDraft.personnel}
                  onChange={(e) => setModelDraft({ ...modelDraft, personnel: e.target.value })}
                  placeholder="ex : 30"
                />
              </label>
              <label>
                Tarif GoPermis (€/h)
                <input
                  inputMode="decimal"
                  value={modelDraft.gopermis}
                  onChange={(e) => setModelDraft({ ...modelDraft, gopermis: e.target.value })}
                  placeholder="ex : 45"
                />
              </label>
            </div>
            <p className="helperText">Laissez vide un encadrement non proposé sur ce modèle. Au moins un tarif est requis.</p>
            <div className="modalButtonsRow">
              <button type="button" className="btnSecondary" onClick={() => setModelDraft(null)}>
                Annuler
              </button>
              <button type="submit" className="btnPrimary" disabled={busy}>
                {busy ? "Création…" : "Créer le modèle"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {offerDraft && (
        <Modal title={offerDraft.id ? "Modifier l'offre" : "Nouvelle offre"} close={() => setOfferDraft(null)}>
          <form onSubmit={saveOffer}>
            <label>
              Intitulé de l&apos;offre
              <input
                value={offerDraft.label}
                onChange={(e) => setOfferDraft({ ...offerDraft, label: e.target.value })}
                placeholder="ex : 20 h + 2 h offertes"
                required
                maxLength={100}
              />
            </label>
            <div className="formGrid">
              <label>
                Heures payées
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  max="1000"
                  value={offerDraft.paidHours}
                  onChange={(e) => setOfferDraft({ ...offerDraft, paidHours: parseFloat(e.target.value) || 0 })}
                  required
                />
              </label>
              <label>
                Heures offertes
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  max="1000"
                  value={offerDraft.bonusHours}
                  onChange={(e) => setOfferDraft({ ...offerDraft, bonusHours: parseFloat(e.target.value) || 0 })}
                  required
                />
              </label>
            </div>
            <fieldset className="modelPicker">
              <legend>Modèles concernés</legend>
              <label className="checkLine">
                <input
                  type="checkbox"
                  checked={offerDraft.modelIds.length === 0}
                  onChange={() => setOfferDraft({ ...offerDraft, modelIds: [] })}
                />
                <span>Tous les modèles</span>
              </label>
              {cat.models.map((m) => {
                const checked = offerDraft.modelIds.includes(m.id);
                return (
                  <label key={m.id} className="checkLine">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setOfferDraft({
                          ...offerDraft,
                          modelIds: checked ? offerDraft.modelIds.filter((x) => x !== m.id) : [...offerDraft.modelIds, m.id],
                        })
                      }
                    />
                    <span>{m.label}</span>
                    <small>{vehicles.filter((v) => v.model_id === m.id && v.active).length} véhicule(s)</small>
                  </label>
                );
              })}
            </fieldset>
            <div className="modalButtonsRow">
              <button type="button" className="btnSecondary" onClick={() => setOfferDraft(null)}>
                Annuler
              </button>
              <button type="submit" className="btnPrimary" disabled={busy}>
                {busy ? "Enregistrement…" : offerDraft.id ? "Enregistrer l'offre" : "Créer l'offre"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
