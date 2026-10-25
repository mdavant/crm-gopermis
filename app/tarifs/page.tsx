"use client";
import React, { useState, useEffect } from "react";
import { Calculator } from "lucide-react";
import { api, type Catalog } from "../../lib/api-types";
import { quote } from "../../domain/pricing";
import { useApp } from "../../components/app-context";

const money = (n: number) =>
  (n / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default function TarifsPage() {
  const { catalog: globalCat } = useApp();
  const [cat, setCat] = useState<Catalog | null>(globalCat);
  const [loading, setLoading] = useState(!globalCat);
  const [error, setError] = useState("");

  // Simulator state
  const [model, setModel] = useState("clio-manual");
  const [support, setSupport] = useState("GoPermis");
  const [selectedOffer, setSelectedOffer] = useState("10+1");
  const [customHours, setCustomHours] = useState(1);

  useEffect(() => {
    if (!cat) {
      setLoading(true);
      api<Catalog>("catalog")
        .then(setCat)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [cat]);

  let quoteResult: ReturnType<typeof quote> | null = null;
  if (cat) {
    try {
      const minutes = selectedOffer
        ? cat.offers.find((o) => o.id === selectedOffer)?.paidMinutes ?? 600
        : customHours * 60;

      quoteResult = quote(cat.rates, cat.offers, {
        model,
        support,
        minutes,
        offerId: selectedOffer || undefined,
        date: new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }),
      });
    } catch {}
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      <div>
        <p className="eyebrow">GRILLE TARIFAIRE OFFICIELLE</p>
        <h1 style={{ fontSize: "26px", fontWeight: 800, margin: "4px 0 6px", letterSpacing: "-0.02em" }}>
          Tarifs & offres de formation
        </h1>
        <p style={{ color: "#64748b", fontSize: "13.5px", margin: 0 }}>
          Tarification réglementée et forfaits d&apos;heures de conduite. Barèmes applicables à la création de prestation.
        </p>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading && !cat ? (
        <p style={{ color: "#64748b", fontSize: "13.5px" }}>Chargement du catalogue tarifaire…</p>
      ) : cat ? (
        <>
          {/* Offers Grid */}
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 16px", color: "#0f172a" }}>
              Forfaits et offres promotionnelles
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
              {cat.offers.map((offer) => (
                <div
                  key={offer.id}
                  className="card"
                  style={{
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    border: "1px solid #e2e8f0",
                    position: "relative",
                  }}
                >
                  {offer.bonusMinutes > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "16px",
                        right: "16px",
                        background: "#fff7ed",
                        border: "1px solid #fed7aa",
                        color: "#ea580c",
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      +{offer.bonusMinutes / 60}h offerte(s)
                    </div>
                  )}

                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
                      {offer.label}
                    </h3>
                    <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                      Volume de {offer.paidMinutes / 60} heures payées
                      {offer.bonusMinutes > 0 && ` + ${offer.bonusMinutes / 60}h de bonus potentiel`}.
                    </p>
                  </div>

                  <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                        Code offre
                      </span>
                      <code style={{ fontSize: "12px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                        {offer.id}
                      </code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Simulation Tool */}
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <Calculator size={20} style={{ color: "#ea580c" }} />
              <div>
                <span className="eyebrow">SIMULATEUR DE DEVIS</span>
                <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "2px 0 0" }}>
                  Calculateur de tarification instantané
                </h2>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <label>
                  Modèle de véhicule
                  <select value={model} onChange={(e) => setModel(e.target.value)}>
                    {cat.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} ({m.id})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Mode d&apos;accompagnement
                  <select value={support} onChange={(e) => setSupport(e.target.value)}>
                    <option value="GoPermis">Moniteur diplômé GoPermis</option>
                    <option value="Personnel">Accompagnateur personnel (Permis &gt; 5 ans)</option>
                  </select>
                </label>

                <label>
                  Formule tarifaire
                  <select value={selectedOffer} onChange={(e) => setSelectedOffer(e.target.value)}>
                    <option value="">Heures à la carte (hors forfait)</option>
                    {cat.offers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label} ({o.paidMinutes / 60}h)
                      </option>
                    ))}
                  </select>
                </label>

                {!selectedOffer && (
                  <label>
                    Nombre d&apos;heures souhaité
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={customHours}
                      onChange={(e) => setCustomHours(parseInt(e.target.value || "1", 10))}
                    />
                  </label>
                )}
              </div>

              {/* Quote result display */}
              <div
                style={{
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: "14px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#9a3412", textTransform: "uppercase" }}>
                  MONTANT TOTAL CALCULÉ
                </span>
                <div style={{ fontSize: "32px", fontWeight: 800, color: "#ea580c", margin: "4px 0" }}>
                  {quoteResult ? money(quoteResult.totalCents) : "—"}
                </div>
                {quoteResult && (
                  <div style={{ fontSize: "12.5px", color: "#9a3412", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span>
                      Taux horaire de base : {money(quoteResult.unitCents)} / heure
                    </span>
                    <span>
                      Crédit total crédité au dossier : {quoteResult.paidMinutes / 60} h
                      {quoteResult.potentialBonusMinutes > 0 && ` (+ ${quoteResult.potentialBonusMinutes / 60}h bonus)`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
