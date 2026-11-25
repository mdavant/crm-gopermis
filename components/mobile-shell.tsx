"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Home as HomeIcon,
  CalendarDays,
  Users,
  HardDrive,
  Database,
  ShieldCheck,
  LogOut,
  Palette,
  Search,
} from "lucide-react";
import { ACCENTS, useApp } from "./app-context";
import { openCommandPalette } from "./command-palette";

export const OPEN_MENU_EVENT = "gopermis-open-menu";

/** Bouton ☰ (haut gauche) qui ouvre le menu à icônes. */
export function MobileMenuButton() {
  return (
    <button
      type="button"
      className="mIconBtn mBurger"
      aria-label="Ouvrir le menu"
      onClick={() => window.dispatchEvent(new Event(OPEN_MENU_EVENT))}
    >
      <span />
      <span />
      <span />
    </button>
  );
}

/** Petit cercle « loupe » qui ouvre la recherche rapide. */
export function MobileSearchButton() {
  return (
    <button type="button" className="mIconBtn" aria-label="Rechercher" onClick={() => openCommandPalette()}>
      <Search size={19} />
    </button>
  );
}

/** Barre du haut collante : ☰ · titre · actions. */
export function MobileTopBar({
  title,
  subtitle,
  right,
  left,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  left?: React.ReactNode;
}) {
  return (
    <div className="mTopBar">
      {left ?? <MobileMenuButton />}
      <div className="mTopTitle">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="mTopRight">{right}</div>
    </div>
  );
}

type NavId = "Accueil" | "Planning" | "Clients" | "Drive" | "Donnees" | "Profil" | "AdminPanel";

/** Menu mobile : une colonne d'icônes, comme la barre latérale sur ordinateur. */
export function MobileMenu({
  view,
  onNavigate,
  userName,
  isAdmin,
  onLogout,
}: {
  view: NavId;
  onNavigate: (v: NavId) => void;
  userName: string;
  isAdmin: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [colors, setColors] = useState(false);
  const { accent, setAccent } = useApp();

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN_MENU_EVENT, on);
    return () => window.removeEventListener(OPEN_MENU_EVENT, on);
  }, []);
  useEffect(() => {
    if (!open) setColors(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  const go = (v: NavId) => {
    onNavigate(v);
    setOpen(false);
    window.scrollTo({ top: 0 });
  };
  const items: [NavId, React.ComponentType<{ size?: number }>, string][] = [
    ["Accueil", HomeIcon, "Accueil"],
    ["Planning", CalendarDays, "Planning"],
    ["Clients", Users, "Élèves"],
    ["Drive", HardDrive, "Drive"],
    ["Donnees", Database, "Tarifs & véhicules"],
  ];
  if (isAdmin) items.push(["AdminPanel", ShieldCheck, "Panel admin"]);

  return createPortal(
    <div className="mMenuBackdrop" onClick={() => setOpen(false)}>
      <nav className="mMenuRail" onClick={(e) => e.stopPropagation()} aria-label="Menu">
        <button type="button" className="mMenuClose" aria-label="Fermer le menu" onClick={() => setOpen(false)}>
          <span />
          <span />
        </button>
        {items.map(([v, Icon, label], i) => (
          <button
            key={v}
            type="button"
            className={`mRailBtn ${view === v ? "active" : ""}`}
            style={{ animationDelay: `${i * 28}ms` }}
            onClick={() => go(v)}
            aria-label={label}
            title={label}
          >
            <Icon size={21} />
          </button>
        ))}
        <span className="mRailSep" />
        <button
          type="button"
          className={`mRailAvatar ${view === "Profil" ? "active" : ""}`}
          onClick={() => go("Profil")}
          aria-label="Mon profil"
          title="Mon profil"
        >
          {userName.slice(0, 2).toUpperCase()}
        </button>
        <button
          type="button"
          className={`mRailBtn ${colors ? "active" : ""}`}
          onClick={() => setColors((c) => !c)}
          aria-label="Couleur de l'interface"
          aria-expanded={colors}
        >
          <Palette size={20} />
        </button>
        <button type="button" className="mRailBtn danger" onClick={onLogout} aria-label="Se déconnecter" title="Se déconnecter">
          <LogOut size={19} />
        </button>
        {colors && (
          <div className="mSwatches" role="radiogroup" aria-label="Couleur de l'interface">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={accent === a.id}
                aria-label={a.label}
                className={accent === a.id ? "active" : ""}
                style={{ ["--sw" as string]: a.value }}
                onClick={() => setAccent(a.id)}
              />
            ))}
          </div>
        )}
      </nav>
    </div>,
    document.body,
  );
}
