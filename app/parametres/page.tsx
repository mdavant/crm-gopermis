"use client";
import React, { useState, useEffect } from "react";
import { Shield } from "lucide-react";
import { useApp } from "../../components/app-context";
import { ResourceSettings } from "../../components/resources";
import { api, type Catalog } from "../../lib/api-types";

export default function ParametresPage() {
  const { user, can, catalog: globalCat } = useApp();
  const [cat, setCat] = useState<Catalog | null>(globalCat);
  const [loading, setLoading] = useState(!globalCat);
  const [error, setError] = useState("");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (!cat) {
      setLoading(true);
      api<Catalog>("catalog")
        .then(setCat)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [cat]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwBusy(true);
    setPwError("");
    setPwSuccess("");
    try {
      await api("auth/password", {
        currentPassword,
        newPassword,
      });
      setPwSuccess("Mot de passe mis à jour avec succès.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPwError((err as Error).message);
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      <div>
        <p className="eyebrow">ADMINISTRATION & LOGISTIQUE</p>
        <h1 style={{ fontSize: "26px", fontWeight: 800, margin: "4px 0 6px", letterSpacing: "-0.02em" }}>
          Paramètres du système
        </h1>
        <p style={{ color: "#64748b", fontSize: "13.5px", margin: 0 }}>
          Gestion de la flotte automobile, des moniteurs d&apos;auto-école, des indisponibilités et de votre compte administrateur.
        </p>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {/* Account Info & Security Section */}
      <div className="card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <Shield size={20} style={{ color: "#ea580c" }} />
          <div>
            <span className="eyebrow">SÉCURITÉ DU COMPTE</span>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "2px 0 0" }}>
              Identifiants & accès
            </h2>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              UTILISATEUR ACTUEL
            </span>
            <strong style={{ fontSize: "16px", color: "#0f172a", display: "block", marginTop: "4px" }}>
              {user?.name}
            </strong>
            <span style={{ fontSize: "12px", color: "#64748b", display: "block", marginTop: "4px" }}>
              Identifiant : <code>{user?.id}</code>
            </span>
            <div style={{ marginTop: "12px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {user?.permissions.map((p) => (
                <span
                  key={p}
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "6px",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    color: "#334155",
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
              Changer mon mot de passe
            </span>

            {pwError && (
              <p className="error" style={{ padding: "8px 12px", fontSize: "12px" }}>
                {pwError}
              </p>
            )}
            {pwSuccess && (
              <p className="success" style={{ padding: "8px 12px", fontSize: "12px" }}>
                {pwSuccess}
              </p>
            )}

            <input
              type="password"
              placeholder="Mot de passe actuel"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <input
              type="password"
              placeholder="Nouveau mot de passe (min. 12 car.)"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button
              type="submit"
              disabled={pwBusy}
              style={{
                alignSelf: "flex-start",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              {pwBusy ? "Modification…" : "Mettre à jour le mot de passe"}
            </button>
          </form>
        </div>
      </div>

      {/* Fleet & Resource Management Component */}
      {loading && !cat ? (
        <p style={{ color: "#64748b", fontSize: "13.5px" }}>Chargement des données de ressources…</p>
      ) : cat ? (
        <ResourceSettings can={can} cat={cat} />
      ) : null}
    </div>
  );
}
