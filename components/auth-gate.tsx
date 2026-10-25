"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Car,
  Calendar,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { api, type User } from "../lib/api-types";
import { savePreviewSession, clearPreviewSession } from "../lib/session";
import { ApiError } from "../lib/http";

type Status = { user: User | null; preview: boolean; setupRequired: boolean };
type Result = { ok: boolean; session?: { token: string; expiresAt: string } };

export function AuthGate({
  onAuthenticated,
}: {
  onAuthenticated: (user: User) => void;
}) {
  const [status, setStatus] = useState<Status | null>(null),
    [phase, setPhase] = useState<"loading" | "ready" | "blocked">("loading"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  const ready = useRef(onAuthenticated);
  ready.current = onAuthenticated;

  const check = useCallback(async () => {
    setPhase("loading");
    setError("");
    try {
      const value = await api<Status>("auth/status");
      setStatus(value);
      if (value.user) ready.current(value.user);
      else setPhase("ready");
    } catch (e) {
      setError((e as Error).message);
      setPhase("blocked");
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError("");
    if (
      status?.setupRequired &&
      form.get("password") !== form.get("confirmPassword")
    ) {
      setError("Les deux mots de passe doivent être identiques.");
      return;
    }
    setBusy(true);
    try {
      clearPreviewSession();
      const result = await api<Result>(
        status?.setupRequired ? "auth/register" : "auth/login",
        Object.fromEntries(form),
      );
      savePreviewSession(result.session);
      const user = await api<User>("me");
      ready.current(user);
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) {
        const next = await api<Status>("auth/status").catch(() => null);
        if (next) setStatus(next);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="authDecorWrapper">
        {/* Decorative Floating Badges (inspired by Image 1 & Image 2) */}
        <div className="authFloatingTile tileTopRight">
          <div className="authTileIcon">
            <Calendar size={18} />
          </div>
          <div className="authTileText">
            <strong>Planning Live</strong>
            <span>Séances & Moniteurs</span>
          </div>
        </div>

        <div className="authFloatingTile tileBottomLeft">
          <div className="authTileIcon">
            <Car size={18} />
          </div>
          <div className="authTileText">
            <strong>Flotte Auto-école</strong>
            <span>Clio V & 208 Manuelle/Auto</span>
          </div>
        </div>

        {/* Central Modern Glass Card */}
        <section className="card authCard">
          <div className="brandMark">G</div>
          <p className="eyebrow">GOPERMIS · ESPACE ÉQUIPE</p>

          {phase === "loading" ? (
            <>
              <h1>Ouverture du CRM…</h1>
              <p role="status">
                Vérification de la connexion et synchronisation de la base
                sécurisée.
              </p>
            </>
          ) : (
            <>
              <h1>
                {phase === "blocked"
                  ? "Connexion indisponible"
                  : status?.setupRequired
                    ? "Créer votre accès"
                    : "Bienvenue sur GoPermis"}
              </h1>
              <p>
                {phase === "blocked"
                  ? "Le CRM n’a pas pu vérifier le serveur. Vos données et votre compte sont préservés."
                  : status?.setupRequired
                    ? "Premier lancement : créez votre compte administrateur. Aucun mot de passe par défaut."
                    : "Connectez-vous pour piloter les dossiers élèves, plannings et véhicules."}
              </p>

              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}

              {phase === "ready" && (
                <form onSubmit={submit}>
                  {status?.setupRequired && (
                    <label>
                      Nom affiché
                      <input
                        name="name"
                        required
                        maxLength={150}
                        autoComplete="name"
                        defaultValue="Administrateur GoPermis"
                        placeholder="Ex. Sarah Martin"
                      />
                    </label>
                  )}
                  <label>
                    Identifiant
                    <input
                      name="identifiant"
                      required
                      minLength={1}
                      maxLength={254}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      autoFocus
                      placeholder="Identifiant ou email"
                    />
                  </label>
                  <label>
                    Mot de passe
                    <input
                      name="password"
                      type={show ? "text" : "password"}
                      required
                      minLength={status?.setupRequired ? 14 : 1}
                      maxLength={256}
                      autoComplete={
                        status?.setupRequired
                          ? "new-password"
                          : "current-password"
                      }
                      placeholder={
                        status?.setupRequired
                          ? "14 caractères minimum"
                          : "Votre mot de passe"
                      }
                    />
                  </label>
                  <button
                    className="passwordToggle"
                    type="button"
                    aria-pressed={show}
                    onClick={() => setShow(!show)}
                  >
                    {show ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <EyeOff size={14} /> Masquer
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Eye size={14} /> Afficher
                      </span>
                    )}
                  </button>

                  {status?.setupRequired && (
                    <label>
                      Confirmer le mot de passe
                      <input
                        name="confirmPassword"
                        type="password"
                        required
                        minLength={14}
                        maxLength={256}
                        autoComplete="new-password"
                        placeholder="Répétez le mot de passe"
                      />
                      <small style={{ color: "#94a3b8", fontSize: 11 }}>
                        14 caractères minimum recommandés pour la sécurité.
                      </small>
                    </label>
                  )}

                  <button className="primary" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
                    {busy
                      ? "Connexion en cours…"
                      : status?.setupRequired
                        ? "Créer mon compte et me connecter"
                        : "Se connecter"}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}

              <button
                className="authRetry"
                type="button"
                disabled={busy}
                onClick={() => void check()}
              >
                Actualiser la connexion
              </button>

              {status?.preview && !status?.setupRequired && (
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "#94a3b8",
                    fontSize: 12,
                    textDecoration: "underline",
                    cursor: "pointer",
                    marginTop: 8,
                    textAlign: "center",
                    width: "100%",
                  }}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api("auth/preview-reset", {});
                      await check();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Réinitialiser pour créer un nouveau compte administrateur
                </button>
              )}

              <small>
                {status?.preview
                  ? "Aperçu sécurisé · Stockage PGlite actif · Session protégée"
                  : "Espace sécurisé GoPermis · Chiffrement AES-256"}
              </small>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
