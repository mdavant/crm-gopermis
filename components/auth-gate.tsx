"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
      // Do not claim success until the session actually authenticates another request.
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
      <section className="card authCard">
        <div className="brandMark">G</div>
        <p className="eyebrow">GOPERMIS · ESPACE ÉQUIPE</p>
        {phase === "loading" ? (
          <>
            <h1>Ouverture du CRM…</h1>
            <p role="status">
              Vérification de la connexion et du stockage. Le premier démarrage
              peut prendre quelques secondes.
            </p>
          </>
        ) : (
          <>
            <h1>
              {phase === "blocked"
                ? "Connexion indisponible"
                : status?.setupRequired
                  ? "Créer votre accès."
                  : "Bienvenue."}
            </h1>
            <p>
              {phase === "blocked"
                ? "Le CRM n’a pas pu vérifier le serveur. Vos données et votre compte n’ont pas été réinitialisés."
                : status?.setupRequired
                  ? "Premier lancement : créez votre compte administrateur. Aucun mot de passe par défaut."
                  : "Connectez-vous avec votre identifiant et votre mot de passe."}
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
                    placeholder="Votre identifiant"
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
                  />
                </label>
                <button
                  className="passwordToggle"
                  type="button"
                  aria-pressed={show}
                  onClick={() => setShow(!show)}
                >
                  {show
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"}
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
                    />
                    <small>14 caractères minimum.</small>
                  </label>
                )}
                <button className="primary" disabled={busy}>
                  {busy
                    ? "Connexion…"
                    : status?.setupRequired
                      ? "Créer mon compte et me connecter"
                      : "Se connecter"}
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
            {status?.preview && (
              <small>
                Aperçu privé · session limitée à cet onglet · aucune donnée
                GoPermis injectée automatiquement.
              </small>
            )}
            <small>
              Mot de passe oublié ? L’administrateur peut rétablir votre accès.
              Aucun accès n’est accordé sans authentification.
            </small>
          </>
        )}
      </section>
    </div>
  );
}
