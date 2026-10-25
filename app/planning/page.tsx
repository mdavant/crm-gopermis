"use client";
import React from "react";
import { CalendarGrid } from "../../components/calendar-grid";

export default function PlanningPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <p className="eyebrow">AGENDA DES FORMATIONS · EUROPE/PARIS</p>
        <h1 style={{ fontSize: "26px", fontWeight: 800, margin: "4px 0 6px", letterSpacing: "-0.02em" }}>
          Planning des leçons de conduite
        </h1>
        <p style={{ color: "#64748b", fontSize: "13.5px", margin: 0 }}>
          Plage opérationnelle 08h00 – 20h00. Gestion en temps réel des créneaux véhicules et moniteurs avec contrôle anti-conflit.
        </p>
      </div>

      <CalendarGrid />
    </div>
  );
}
