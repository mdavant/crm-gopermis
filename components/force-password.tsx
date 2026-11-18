"use client";
import React, { useState } from "react";
import { KeyRound, Eye, EyeOff, LogOut, Check } from "lucide-react";
import { api, type User } from "../lib/api-types";
import { clearPreviewSession, savePreviewSession } from "../lib/session";

const rules = [
  { test: (p: string) => p.length >= 14, label: "14 caractères minimum" },
  { test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p), label: "Majuscules et minuscules" },
  { test: (p: string) => /\d/.test(p), label: "Au moins un chiffre" },
];

/**
 * Première connexion : l'utilisateur remplace son mot de passe temporaire
 * avant d'accéder au CRM, puis il est reconnecté automatiquement.
 */
export function ForcePasswordChange({ user, onDone }: { user: User; onDone: (u: User) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = rules.every((r) => r.test(next)) && next === confirm && next !== current;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      await api("auth/password", { currentPassword: current, newPassword: next });
      clearPreviewSession();
      const res = await api<{ session?: { token: string; expiresAt: string } }>("auth/login", {
        identifiant: user.email,
        password: next,
      });
      savePreviewSession(res.session);
      onDone(await api<User>("me"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="forcePwWrap">
      <form className="forcePwCard" onSubmit={submit}>
        <span className="forcePwIcon">
          <KeyRound size={22} />
        </span>
        <h1>Bienvenue {user.name.split(" ")[0]}</h1>
        <p>
          Votre compte a été créé avec un mot de passe temporaire. Choisissez maintenant votre mot de passe personnel pour
          accéder au CRM.
        </p>
        {error && <div className="calendarAlert errorAlert">{error}</div>}
        <label>
          Mot de passe temporaire
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          Nouveau mot de passe
          <span className="pwField">
            <input
              type={show ? "text" : "password"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={14}
              required
            />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Masquer" : "Afficher"}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>
        <label>
          Confirmer le mot de passe
          <input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <ul className="pwRules">
          {rules.map((r) => (
            <li key={r.label} className={r.test(next) ? "ok" : ""}>
              <Check size={13} /> {r.label}
            </li>
          ))}
          <li className={next && next === confirm ? "ok" : ""}>
            <Check size={13} /> Les deux saisies sont identiques
          </li>
        </ul>
        <button type="submit" className="btnPrimary" disabled={!valid || busy}>
          {busy ? "Enregistrement…" : "Enregistrer et accéder au CRM"}
        </button>
        <button
          type="button"
          className="linkButton"
          onClick={async () => {
            await api("logout", {}).catch(() => {});
            clearPreviewSession();
            window.location.reload();
          }}
        >
          <LogOut size={14} /> Se déconnecter
        </button>
      </form>
    </div>
  );
}
