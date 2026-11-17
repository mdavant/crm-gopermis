"use client";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  User as UserIcon,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { api, type User } from "../lib/api-types";
import { savePreviewSession, clearPreviewSession } from "../lib/session";
import { ApiError } from "../lib/http";
import { useApp } from "./app-context";
import { ThemeToggle } from "./theme-toggle";

type Status = { user: User | null; preview: boolean; setupRequired: boolean };
type Result = { ok: boolean; session?: { token: string; expiresAt: string } };

export function AuthGate({
  onAuthenticated,
}: {
  onAuthenticated: (user: User) => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "blocked">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const ready = useRef(onAuthenticated);
  ready.current = onAuthenticated;

  const { theme } = useApp();
  const isDark = theme === "dark";

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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: isDark ? "#090d16" : "#f1f3f9",
        color: isDark ? "#f8fafc" : "#0f172a",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        position: "relative",
      }}
    >
      <style>{`
        .authContainer {
          width: 100%;
          max-width: 440px;
          background: ${isDark ? "#0f172a" : "#ffffff"};
          border-radius: 24px;
          overflow: hidden;
          box-shadow: ${
            isDark
              ? "0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px #1e293b"
              : "0 20px 50px -10px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(226, 232, 240, 0.9)"
          };
          display: flex;
          flex-direction: column;
          transition: all 0.3s ease;
        }

        .authMobileBanner {
          display: block;
        }

        .authDesktopPanel {
          display: none;
        }

        .authDesktopHeader {
          display: none;
        }

        .authFormPanel {
          padding: 24px 22px 28px;
          display: flex;
          flex-direction: column;
          justifyContent: center;
        }

        @media (min-width: 768px) {
          .authContainer {
            max-width: 940px;
            min-height: 570px;
            border-radius: 28px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            padding: 14px;
            gap: 14px;
          }

          .authMobileBanner {
            display: none;
          }

          .authDesktopPanel {
            display: flex;
          }

          .authDesktopHeader {
            display: block;
          }

          .authFormPanel {
            padding: 36px 38px;
          }
        }
      `}</style>

      {/* Floating Theme Switcher at Top Right */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <ThemeToggle compact />
      </div>

      {/* Main Responsive Card */}
      <div className="authContainer">
        {/* MOBILE BANNER: Visible on mobile devices */}
        <div
          className="authMobileBanner"
          style={{
            background:
              "linear-gradient(135deg, #1d4ed8 0%, #2563eb 45%, #3b82f6 80%, #4f46e5 100%)",
            padding: "32px 24px 28px",
            position: "relative",
            overflow: "hidden",
            color: "#ffffff",
            textAlign: "center",
          }}
        >
          {/* Subtle ambient light rings */}
          <div
            style={{
              position: "absolute",
              top: "-40%",
              right: "-20%",
              width: "220px",
              height: "220px",
              background:
                "radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 70%)",
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-30%",
              left: "-15%",
              width: "200px",
              height: "200px",
              background:
                "radial-gradient(circle, rgba(59,130,246,0.6) 0%, rgba(29,78,216,0) 70%)",
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          />

          {/* Top Glossy Emblem */}
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "16px",
              background: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              display: "grid",
              placeItems: "center",
              fontSize: "22px",
              fontWeight: 900,
              color: "#ffffff",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
              margin: "0 auto 14px",
              position: "relative",
              zIndex: 2,
            }}
          >
            ✦
          </div>

          <span
            style={{
              fontSize: "11px",
              fontWeight: 750,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "rgba(255, 255, 255, 0.8)",
              display: "block",
              marginBottom: "6px",
              position: "relative",
              zIndex: 2,
            }}
          >
            GOPERMIS · PLATEFORME
          </span>

          <h1
            style={{
              fontSize: "22px",
              fontWeight: 800,
              margin: "0 0 6px",
              color: "#ffffff",
              letterSpacing: "-0.02em",
              lineHeight: 1.25,
              position: "relative",
              zIndex: 2,
            }}
          >
            Piloter GoPermis
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: "12.5px",
              color: "rgba(255, 255, 255, 0.85)",
              lineHeight: 1.4,
              position: "relative",
              zIndex: 2,
            }}
          >
            Connectez-vous pour accéder à votre espace de travail.
          </p>
        </div>

        {/* DESKTOP PANEL: Visible on desktop (width >= 768px) */}
        <div
          className="authDesktopPanel"
          style={{
            borderRadius: "22px",
            background:
              "linear-gradient(135deg, #1d4ed8 0%, #2563eb 40%, #3b82f6 75%, #4f46e5 100%)",
            position: "relative",
            overflow: "hidden",
            padding: "44px 38px",
            flexDirection: "column",
            justifyContent: "space-between",
            color: "#ffffff",
          }}
        >
          {/* Subtle Ambient Radial Highlights */}
          <div
            style={{
              position: "absolute",
              top: "-20%",
              right: "-20%",
              width: "320px",
              height: "320px",
              background:
                "radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 70%)",
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "10%",
              left: "-15%",
              width: "280px",
              height: "280px",
              background:
                "radial-gradient(circle, rgba(59,130,246,0.5) 0%, rgba(29,78,216,0) 70%)",
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          />

          {/* Top Brand Emblem */}
          <div style={{ position: "relative", zIndex: 2 }}>
            <div
              style={{
                width: "46px",
                height: "46px",
                borderRadius: "15px",
                background: "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.35)",
                display: "grid",
                placeItems: "center",
                fontSize: "22px",
                fontWeight: 900,
                color: "#ffffff",
                boxShadow: "0 8px 16px rgba(0, 0, 0, 0.15)",
              }}
            >
              ✦
            </div>
          </div>

          {/* Bottom Captions */}
          <div style={{ position: "relative", zIndex: 2 }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "rgba(255, 255, 255, 0.8)",
                display: "block",
                marginBottom: "8px",
              }}
            >
              GOPERMIS · PLATEFORME
            </span>
            <h2
              style={{
                fontSize: "26px",
                fontWeight: 800,
                lineHeight: "1.25",
                margin: "0 0 12px",
                letterSpacing: "-0.02em",
                color: "#ffffff",
              }}
            >
              Piloter GoPermis en toute clarté et efficacité.
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "13.5px",
                lineHeight: "1.5",
                color: "rgba(255, 255, 255, 0.85)",
              }}
            >
              Planning live des moniteurs, suivi des heures d&apos;examen, fiches élèves et documents centralisés.
            </p>
          </div>
        </div>

        {/* FORM PANEL: Responsive container */}
        <div className="authFormPanel">
          {/* Desktop Star Emblem (hidden on mobile) */}
          <div className="authDesktopHeader" style={{ marginBottom: "16px" }}>
            <span
              style={{
                fontSize: "28px",
                fontWeight: 900,
                color: "#2563eb",
                display: "inline-block",
                lineHeight: 1,
              }}
            >
              ✦
            </span>
          </div>

          {phase === "loading" ? (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  margin: "0 0 8px",
                  color: isDark ? "#f8fafc" : "#0f172a",
                }}
              >
                Ouverture de GoPermis…
              </h2>
              <p
                style={{
                  color: isDark ? "#94a3b8" : "#64748b",
                  fontSize: "13px",
                  margin: 0,
                }}
              >
                Vérification de la session et initialisation sécurisée.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Title & Subtitle */}
              <div className="authDesktopHeader" style={{ marginBottom: "24px" }}>
                <h1
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    margin: "0 0 6px",
                    color: isDark ? "#f8fafc" : "#0f172a",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {status?.setupRequired
                    ? "Initialiser l'accès administrateur"
                    : "Piloter GoPermis"}
                </h1>
                <p
                  style={{
                    margin: 0,
                    color: isDark ? "#94a3b8" : "#64748b",
                    fontSize: "13px",
                    lineHeight: "1.4",
                  }}
                >
                  {status?.setupRequired
                    ? "Premier lancement : définissez les identifiants du compte administrateur principal."
                    : "Connectez-vous à votre espace de travail pour continuer."}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div
                  style={{
                    padding: "11px 14px",
                    borderRadius: "12px",
                    background: isDark
                      ? "rgba(239, 68, 68, 0.15)"
                      : "#fef2f2",
                    border: isDark
                      ? "1px solid rgba(239, 68, 68, 0.3)"
                      : "1px solid #fee2e2",
                    color: isDark ? "#fca5a5" : "#b91c1c",
                    fontSize: "12.5px",
                    marginBottom: "18px",
                    fontWeight: 550,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>{error}</span>
                </div>
              )}

              {phase === "ready" && (
                <form
                  onSubmit={submit}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {/* Name field (Initial Setup only) */}
                  {status?.setupRequired && (
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          color: isDark ? "#cbd5e1" : "#334155",
                          marginBottom: "6px",
                        }}
                      >
                        Nom de l&apos;administrateur
                      </label>
                      <div style={{ position: "relative" }}>
                        <div
                          style={{
                            position: "absolute",
                            left: "14px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            pointerEvents: "none",
                            color: isDark ? "#94a3b8" : "#64748b",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <UserIcon size={17} />
                        </div>
                        <input
                          name="name"
                          required
                          maxLength={150}
                          autoComplete="name"
                          defaultValue="Administrateur GoPermis"
                          placeholder="Ex. Sarah Martin"
                          style={{
                            width: "100%",
                            height: "46px",
                            padding: "0 14px 0 42px",
                            borderRadius: "14px",
                            border: isDark
                              ? "1px solid #334155"
                              : "1px solid #e2e8f0",
                            background: isDark ? "#1e293b" : "#f8fafc",
                            color: isDark ? "#f8fafc" : "#0f172a",
                            fontSize: "13.5px",
                            outline: "none",
                            transition:
                              "border-color 0.15s ease, box-shadow 0.15s ease",
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = "#2563eb";
                            e.currentTarget.style.boxShadow =
                              "0 0 0 3px rgba(37, 99, 235, 0.15)";
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = isDark
                              ? "#334155"
                              : "#e2e8f0";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Username / Email field with leading UserIcon */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        color: isDark ? "#cbd5e1" : "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      Identifiant ou email
                    </label>
                    <div style={{ position: "relative" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: "14px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                          color: isDark ? "#94a3b8" : "#64748b",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <UserIcon size={17} />
                      </div>
                      <input
                        name="identifiant"
                        required
                        minLength={1}
                        maxLength={254}
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        autoFocus
                        placeholder="admin ou identifiant"
                        style={{
                          width: "100%",
                          height: "46px",
                          padding: "0 14px 0 42px",
                          borderRadius: "14px",
                          border: isDark
                            ? "1px solid #334155"
                            : "1px solid #e2e8f0",
                          background: isDark ? "#1e293b" : "#f8fafc",
                          color: isDark ? "#f8fafc" : "#0f172a",
                          fontSize: "13.5px",
                          outline: "none",
                          transition:
                            "border-color 0.15s ease, box-shadow 0.15s ease",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#2563eb";
                          e.currentTarget.style.boxShadow =
                            "0 0 0 3px rgba(37, 99, 235, 0.15)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = isDark
                            ? "#334155"
                            : "#e2e8f0";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                    </div>
                  </div>

                  {/* Password field with leading Lock and trailing Eye toggle */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        color: isDark ? "#cbd5e1" : "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      Mot de passe
                    </label>
                    <div style={{ position: "relative" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: "14px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                          color: isDark ? "#94a3b8" : "#64748b",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Lock size={17} />
                      </div>
                      <input
                        name="password"
                        type={showPassword ? "text" : "password"}
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
                            : "••••••••••••"
                        }
                        style={{
                          width: "100%",
                          height: "46px",
                          padding: "0 42px 0 42px",
                          borderRadius: "14px",
                          border: isDark
                            ? "1px solid #334155"
                            : "1px solid #e2e8f0",
                          background: isDark ? "#1e293b" : "#f8fafc",
                          color: isDark ? "#f8fafc" : "#0f172a",
                          fontSize: "13.5px",
                          outline: "none",
                          transition:
                            "border-color 0.15s ease, box-shadow 0.15s ease",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#2563eb";
                          e.currentTarget.style.boxShadow =
                            "0 0 0 3px rgba(37, 99, 235, 0.15)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = isDark
                            ? "#334155"
                            : "#e2e8f0";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: "absolute",
                          right: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "transparent",
                          border: "none",
                          color: isDark ? "#94a3b8" : "#64748b",
                          cursor: "pointer",
                          display: "grid",
                          placeItems: "center",
                          padding: "4px",
                        }}
                        title={showPassword ? "Masquer" : "Afficher"}
                      >
                        {showPassword ? (
                          <EyeOff size={17} />
                        ) : (
                          <Eye size={17} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Password confirmation (Initial Setup only) */}
                  {status?.setupRequired && (
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          color: isDark ? "#cbd5e1" : "#334155",
                          marginBottom: "6px",
                        }}
                      >
                        Confirmer le mot de passe
                      </label>
                      <div style={{ position: "relative" }}>
                        <div
                          style={{
                            position: "absolute",
                            left: "14px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            pointerEvents: "none",
                            color: isDark ? "#94a3b8" : "#64748b",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <Lock size={17} />
                        </div>
                        <input
                          name="confirmPassword"
                          type="password"
                          required
                          minLength={14}
                          maxLength={256}
                          autoComplete="new-password"
                          placeholder="Répétez le mot de passe"
                          style={{
                            width: "100%",
                            height: "46px",
                            padding: "0 14px 0 42px",
                            borderRadius: "14px",
                            border: isDark
                              ? "1px solid #334155"
                              : "1px solid #e2e8f0",
                            background: isDark ? "#1e293b" : "#f8fafc",
                            color: isDark ? "#f8fafc" : "#0f172a",
                            fontSize: "13.5px",
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* High-Tactile Electric Blue Login Button */}
                  <button
                    type="submit"
                    disabled={busy}
                    style={{
                      height: "48px",
                      borderRadius: "14px",
                      border: "none",
                      background: "#2563eb",
                      color: "#ffffff",
                      fontSize: "14.5px",
                      fontWeight: 700,
                      cursor: busy ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      boxShadow: "0 8px 22px -4px rgba(37, 99, 235, 0.45)",
                      transition: "all 0.15s ease",
                      marginTop: "6px",
                    }}
                    onMouseEnter={(e) => {
                      if (!busy) e.currentTarget.style.background = "#1d4ed8";
                    }}
                    onMouseLeave={(e) => {
                      if (!busy) e.currentTarget.style.background = "#2563eb";
                    }}
                  >
                    <span>
                      {busy
                        ? "Connexion en cours…"
                        : status?.setupRequired
                        ? "Créer le compte administrateur"
                        : "Se connecter"}
                    </span>
                    <ArrowRight size={17} />
                  </button>
                </form>
              )}

              {/* Informative Note: Admin-managed accounts only, no open signup */}
              <div
                style={{
                  marginTop: "22px",
                  paddingTop: "16px",
                  borderTop: isDark
                    ? "1px solid #1e293b"
                    : "1px solid #f1f5f9",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    color: isDark ? "#64748b" : "#94a3b8",
                    fontSize: "11.5px",
                    marginBottom: "4px",
                  }}
                >
                  <ShieldCheck size={14} color="#2563eb" />
                  <span style={{ fontWeight: 600 }}>Espace collaborateur sécurisé</span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "11.5px",
                    color: isDark ? "#64748b" : "#94a3b8",
                    lineHeight: "1.45",
                  }}
                >
                  Accès réservé aux collaborateurs GoPermis.
                  <br />
                  Les comptes sont créés et administrés par le responsable.
                </p>

                {status?.preview && !status?.setupRequired && (
                  <button
                    type="button"
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
                    style={{
                      marginTop: "12px",
                      background: "transparent",
                      border: "none",
                      color: isDark ? "#94a3b8" : "#64748b",
                      fontSize: "11.5px",
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                  >
                    Réinitialiser pour créer un nouveau compte administrateur
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
