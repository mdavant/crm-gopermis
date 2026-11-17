"use client";
import React, { useState } from "react";
import { Database, WalletCards, Car } from "lucide-react";
import { PricingView } from "./pricing-view";
import { ResourceSettings } from "./resources";
import type { Catalog } from "../lib/api-types";

import { useApp } from "./app-context";

interface DonneesViewProps {
  cat: Catalog | null;
  can: (permission: string) => boolean;
  onRefresh: () => Promise<void>;
  defaultTab?: "tarifs" | "ressources";
}

export function DonneesView({
  cat,
  can,
  onRefresh,
  defaultTab = "tarifs",
}: DonneesViewProps) {
  const [activeTab, setActiveTab] = useState<"tarifs" | "ressources">(defaultTab);
  const { theme } = useApp();
  const isDark = theme === "dark";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }} className="donneesWorkspaceInner">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <p className="eyebrow" style={{ color: isDark ? "#94a3b8" : "#64748b" }}>RÉFÉRENTIEL & PARAMÈTRES MÉTIER</p>
          <h1
            style={{
              fontSize: "26px",
              fontWeight: 800,
              margin: "4px 0 6px",
              letterSpacing: "-0.02em",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: isDark ? "#f8fafc" : "#0f172a",
            }}
          >
            <Database size={26} style={{ color: "#2563eb" }} />
            <span>Données GoPermis</span>
          </h1>
          <p style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "13.5px", margin: 0 }}>
            Gestion centralisée des forfaits tarifaires, de la flotte automobile et des moniteurs diplômés.
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div
          style={{
            display: "inline-flex",
            background: isDark ? "#1e293b" : "#e2e8f0",
            padding: "3px",
            borderRadius: "12px",
            gap: "4px",
            border: isDark ? "1px solid #334155" : "none",
          }}
          className="donneesTabGroup"
        >
          <button
            type="button"
            onClick={() => setActiveTab("tarifs")}
            style={{
              padding: "8px 16px",
              borderRadius: "9px",
              border: "none",
              background: activeTab === "tarifs" ? (isDark ? "#0f172a" : "#ffffff") : "transparent",
              color: activeTab === "tarifs" ? (isDark ? "#f8fafc" : "#0f172a") : (isDark ? "#94a3b8" : "#64748b"),
              fontWeight: activeTab === "tarifs" ? 700 : 600,
              fontSize: "13px",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              cursor: "pointer",
              boxShadow: activeTab === "tarifs" ? (isDark ? "0 2px 6px rgba(0,0,0,0.4)" : "0 2px 5px rgba(0,0,0,0.06)") : "none",
              transition: "all 0.15s ease",
            }}
          >
            <WalletCards size={16} style={{ color: activeTab === "tarifs" ? "#2563eb" : "inherit" }} />
            <span>Tarifs & offres</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ressources")}
            style={{
              padding: "8px 16px",
              borderRadius: "9px",
              border: "none",
              background: activeTab === "ressources" ? (isDark ? "#0f172a" : "#ffffff") : "transparent",
              color: activeTab === "ressources" ? (isDark ? "#f8fafc" : "#0f172a") : (isDark ? "#94a3b8" : "#64748b"),
              fontWeight: activeTab === "ressources" ? 700 : 600,
              fontSize: "13px",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              cursor: "pointer",
              boxShadow: activeTab === "ressources" ? (isDark ? "0 2px 6px rgba(0,0,0,0.4)" : "0 2px 5px rgba(0,0,0,0.06)") : "none",
              transition: "all 0.15s ease",
            }}
          >
            <Car size={16} style={{ color: activeTab === "ressources" ? "#2563eb" : "inherit" }} />
            <span>Véhicules & moniteurs</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {!cat ? (
        <div className="card" style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
          Chargement des données du catalogue…
        </div>
      ) : activeTab === "tarifs" ? (
        <PricingView cat={cat} can={can} onRefresh={onRefresh} />
      ) : (
        <ResourceSettings can={can} cat={cat} />
      )}
    </div>
  );
}
