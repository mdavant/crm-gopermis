"use client";
import React, { useState } from "react";
import { Car, Tag, Edit2, CheckCircle2, AlertCircle } from "lucide-react";
import { api, type Catalog } from "../lib/api-types";
import { Modal } from "./modal";

const money = (n: number) =>
  (n / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

interface PricingViewProps {
  cat: Catalog;
  can: (p: string) => boolean;
  onRefresh: () => Promise<void>;
}

export function PricingView({ cat, can, onRefresh }: PricingViewProps) {
  const [editingRate, setEditingRate] = useState<{
    id: string;
    model: string;
    support: string;
    cents: number;
    euros: number;
  } | null>(null);

  const [editingOffer, setEditingOffer] = useState<{
    id: string;
    label: string;
    paidMinutes: number;
    bonusMinutes: number;
  } | null>(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const saveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRate) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("catalog/update", {
        kind: "rate",
        id: editingRate.id,
        cents: Math.round(editingRate.euros * 100),
      });
      await onRefresh();
      setMessage("Tarif mis à jour avec succès.");
      setEditingRate(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOffer) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("catalog/update", {
        kind: "offer",
        id: editingOffer.id,
        label: editingOffer.label,
        paidMinutes: editingOffer.paidMinutes,
        bonusMinutes: editingOffer.bonusMinutes,
      });
      await onRefresh();
      setMessage("Offre mise à jour avec succès.");
      setEditingOffer(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pricingWorkspace">
      <div className="pricingHeader">
        <div>
          <span className="profileEyebrow">CATALOGUE OFFICIEL</span>
          <h1 className="pricingTitle">Tarifs & Offres</h1>
          <p className="pricingSubtitle">
            Consultez et modifiez les tarifs horaires par véhicule et les formules packs avec heures offertes.
          </p>
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

      <div className="pricingSection">
        <h2 className="pricingSectionTitle">Tarifs horaires par modèle</h2>
        <div className="pricingCardsGrid">
          {cat.models.map((m) => {
            const modelRates = cat.rates.filter((r) => r.model === m.id);
            return (
              <div key={m.id} className="pricingCard">
                <div className="pricingCardHeader">
                  <div className="pricingModelIcon">
                    <Car size={20} />
                  </div>
                  <div>
                    <h3 className="pricingModelName">{m.label}</h3>
                    <span className="pricingModelId">{m.id}</span>
                  </div>
                </div>

                <div className="pricingRateList">
                  {modelRates.map((r) => (
                    <div key={r.id} className="pricingRateRow">
                      <div className="rateMeta">
                        <strong>{r.support}</strong>
                        <span className="rateDate">Depuis le {r.validFrom}</span>
                      </div>
                      <div className="ratePriceWrap">
                        <span className="ratePriceValue">{money(r.cents)}/h</span>
                        {can("clients.write") && (
                          <button
                            type="button"
                            className="btnIconTiny"
                            title="Modifier ce tarif"
                            onClick={() =>
                              setEditingRate({
                                id: r.id,
                                model: r.model,
                                support: r.support,
                                cents: r.cents,
                                euros: r.cents / 100,
                              })
                            }
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {m.id === "rs3" && (
                    <div className="specialNoticeBox">
                      <span>Accompagnement GoPermis uniquement sur RS3.</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pricingSection">
        <h2 className="pricingSectionTitle">Formules et Forfaits pack</h2>
        <div className="offersCardsGrid">
          {cat.offers.map((o) => (
            <div key={o.id} className="offerCard">
              <div className="offerCardHeader">
                <div className="offerIconBox">
                  <Tag size={18} />
                </div>
                <div className="offerTitleArea">
                  <h3 className="offerTitle">{o.label}</h3>
                  <span className="offerSummary">
                    {o.paidMinutes / 60} h payées + {o.bonusMinutes / 60} h offertes
                  </span>
                </div>
                {can("clients.write") && (
                  <button
                    type="button"
                    className="btnIconTiny"
                    title="Modifier cette offre"
                    onClick={() =>
                      setEditingOffer({
                        id: o.id,
                        label: o.label,
                        paidMinutes: o.paidMinutes,
                        bonusMinutes: o.bonusMinutes,
                      })
                    }
                  >
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
              <p className="offerFinePrint">
                Bonus attribué après paiement intégral en une fois.
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Rate Modal */}
      {editingRate && (
        <Modal title="Modifier le tarif horaire" close={() => setEditingRate(null)}>
          <form onSubmit={saveRate}>
            <p className="modalNotice">
              Modèle : <strong>{editingRate.model}</strong> · Encadrement : <strong>{editingRate.support}</strong>
            </p>

            <label>
              Tarif horaire (€ TTC)
              <input
                type="number"
                step="0.5"
                min="10"
                max="500"
                value={editingRate.euros}
                onChange={(e) =>
                  setEditingRate({
                    ...editingRate,
                    euros: parseFloat(e.target.value) || 0,
                  })
                }
                required
              />
            </label>

            <div className="modalButtonsRow">
              <button
                type="button"
                className="btnSecondary"
                onClick={() => setEditingRate(null)}
              >
                Annuler
              </button>
              <button type="submit" className="btnPrimary" disabled={busy}>
                {busy ? "Enregistrement…" : "Enregistrer le tarif"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Offer Modal */}
      {editingOffer && (
        <Modal title="Modifier l'offre / forfait" close={() => setEditingOffer(null)}>
          <form onSubmit={saveOffer}>
            <label>
              Intitulé de l&apos;offre
              <input
                type="text"
                value={editingOffer.label}
                onChange={(e) =>
                  setEditingOffer({ ...editingOffer, label: e.target.value })
                }
                required
                maxLength={100}
              />
            </label>

            <div className="formGrid">
              <label>
                Heures payées
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editingOffer.paidMinutes / 60}
                  onChange={(e) =>
                    setEditingOffer({
                      ...editingOffer,
                      paidMinutes: Math.round((parseFloat(e.target.value) || 0) * 60),
                    })
                  }
                  required
                />
              </label>

              <label>
                Heures offertes (Bonus)
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={editingOffer.bonusMinutes / 60}
                  onChange={(e) =>
                    setEditingOffer({
                      ...editingOffer,
                      bonusMinutes: Math.round((parseFloat(e.target.value) || 0) * 60),
                    })
                  }
                  required
                />
              </label>
            </div>

            <div className="modalButtonsRow">
              <button
                type="button"
                className="btnSecondary"
                onClick={() => setEditingOffer(null)}
              >
                Annuler
              </button>
              <button type="submit" className="btnPrimary" disabled={busy}>
                {busy ? "Enregistrement…" : "Enregistrer l'offre"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
