"use client";
import React from "react";
import { Palette } from "lucide-react";
import { ACCENTS, useApp } from "./app-context";

/** Bouton couleur : chaque clic passe à la teinte d'accent suivante. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { accent, setAccent } = useApp();
  const i = Math.max(0, ACCENTS.findIndex((a) => a.id === accent));
  const current = ACCENTS[i];
  const next = ACCENTS[(i + 1) % ACCENTS.length];
  return (
    <button
      type="button"
      className={`accentCycle ${compact ? "compact" : ""}`}
      onClick={() => setAccent(next.id)}
      title={`Couleur : ${current.label} — cliquer pour ${next.label}`}
      aria-label={`Changer la couleur (actuelle : ${current.label})`}
    >
      <span className="accentCycleDot" />
      {compact ? null : (
        <>
          <Palette size={14} />
          <span>{current.label}</span>
        </>
      )}
    </button>
  );
}
