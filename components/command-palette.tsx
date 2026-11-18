"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft, User as UserIcon, Palette } from "lucide-react";
import { api, type ClientRecord } from "../lib/api-types";
import { ACCENTS, useApp } from "./app-context";

export type PaletteAction = {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ComponentType<{ size?: number }>;
  keywords?: string;
  run: () => void;
};

/** Mac → « ⌘ », Windows / Linux → « Ctrl ». */
export function useShortcutLabel() {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent;
    setMac(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);
  return mac ? "⌘K" : "Ctrl K";
}

/** Ouvre la palette : ⌘K (macOS) ou Ctrl+K (Windows / Linux), « / » hors champ de saisie. */
export function openCommandPalette() {
  window.dispatchEvent(new Event("gopermis-open-palette"));
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CommandPalette({
  actions,
  onOpenClient,
  canSearchClients = false,
}: {
  actions: PaletteAction[];
  onOpenClient?: (id: string) => void;
  canSearchClients?: boolean;
}) {
  const { setAccent, accent } = useApp();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const shortcut = useShortcutLabel();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && k === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));
      if (k === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("gopermis-open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("gopermis-open-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSel(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Recherche d'élèves (si autorisé), avec un léger délai.
  useEffect(() => {
    if (!open || !onOpenClient || !canSearchClients || q.trim().length < 2) {
      setClients([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api<ClientRecord[]>("clients?q=" + encodeURIComponent(q.trim()))
        .then((rows) => !cancelled && setClients(rows.slice(0, 6)))
        .catch(() => !cancelled && setClients([]));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open, onOpenClient, canSearchClients]);

  const close = useCallback(() => setOpen(false), []);

  const items = useMemo(() => {
    const base: PaletteAction[] = [
      ...actions,
      ...ACCENTS.map((a) => ({
        id: "accent-" + a.id,
        label: `Couleur : ${a.label}`,
        hint: a.id === accent ? "Active" : undefined,
        icon: Palette,
        keywords: "couleur theme accent " + a.label,
        run: () => setAccent(a.id),
      })),
    ];
    const n = norm(q.trim());
    const filtered = n
      ? base.filter((a) => norm(`${a.label} ${a.keywords ?? ""}`).includes(n))
      : base.filter((a) => !a.id.startsWith("accent-"));
    const clientItems: PaletteAction[] = clients.map((c) => ({
      id: "client-" + c.id,
      label: `${c.first_name} ${c.last_name}`,
      hint: c.phone || c.email || "Élève",
      icon: UserIcon,
      run: () => onOpenClient?.(c.id),
    }));
    return [...clientItems, ...filtered];
  }, [actions, clients, q, accent, setAccent, onOpenClient]);

  useEffect(() => setSel(0), [q, clients.length]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!open) return null;

  const run = (a?: PaletteAction) => {
    if (!a) return;
    close();
    a.run();
  };

  return (
    <div className="cmdBackdrop" onMouseDown={close} role="presentation">
      <div
        className="cmdPanel"
        role="dialog"
        aria-modal="true"
        aria-label="Recherche rapide"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setSel((s) => Math.min(items.length - 1, s + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSel((s) => Math.max(0, s - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            run(items[sel]);
          }
        }}
      >
        <div className="cmdInputRow">
          <Search size={18} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un élève, une page, une action…"
            aria-label="Rechercher"
          />
          <kbd>Échap</kbd>
        </div>
        <div className="cmdList" ref={listRef} role="listbox">
          {items.length === 0 && <div className="cmdEmpty">Aucun résultat pour « {q} »</div>}
          {items.map((a, i) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                type="button"
                data-idx={i}
                role="option"
                aria-selected={i === sel}
                className={`cmdItem ${i === sel ? "active" : ""}`}
                onMouseEnter={() => setSel(i)}
                onClick={() => run(a)}
                style={{ ["--i" as string]: Math.min(i, 8) }}
              >
                <span className="cmdIcon">{Icon ? <Icon size={16} /> : null}</span>
                <span className="cmdLabel">{a.label}</span>
                {a.hint && <span className="cmdHint">{a.hint}</span>}
                {i === sel && <CornerDownLeft size={14} className="cmdEnter" />}
              </button>
            );
          })}
        </div>
        <div className="cmdFooter">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> naviguer
          </span>
          <span>
            <kbd>Entrée</kbd> ouvrir
          </span>
          <span className="cmdFooterRight">
            <kbd>{shortcut}</kbd> ouvrir / fermer
          </span>
        </div>
      </div>
    </div>
  );
}

/** Bouton « Rechercher… ⌘K / Ctrl K » pour ouvrir la palette à la souris. */
export function CommandPaletteTrigger() {
  const shortcut = useShortcutLabel();
  return (
    <button type="button" className="cmdTrigger" onClick={openCommandPalette} title={`Recherche rapide (${shortcut})`}>
      <Search size={15} />
      <span>Rechercher…</span>
      <kbd>{shortcut}</kbd>
    </button>
  );
}

/** Sélecteur de couleur d'accent (un clic, une couleur). */
export function AccentPicker() {
  const { accent, setAccent } = useApp();
  return (
    <div className="accentPicker" role="radiogroup" aria-label="Couleur d'accent">
      {ACCENTS.map((a) => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={accent === a.id}
          className={`accentSwatch ${accent === a.id ? "active" : ""}`}
          style={{ ["--sw" as string]: a.value }}
          onClick={() => setAccent(a.id)}
          title={a.label}
        >
          <span className="accentDot" />
          <span className="accentName">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
