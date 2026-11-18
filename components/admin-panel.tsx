"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  UserPlus,
  RefreshCw,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Edit2,
  Power,
  AlertTriangle,
  Clock3,
  CalendarDays,
  Users,
  Wallet,
  FolderOpen,
  Car,
  Settings2,
} from "lucide-react";
import { api, type AdminUser, type User } from "../lib/api-types";
import {
  ALL_PERMISSIONS,
  PERMISSION_MODULES,
  ROLE_PRESETS,
  presetPermissions,
  withRequirements,
  withoutDependents,
  type RolePresetId,
} from "../lib/permissions";
import { Modal } from "./modal";

const MODULE_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  planning: CalendarDays,
  clients: Users,
  payments: Wallet,
  documents: FolderOpen,
  catalog: Car,
  admin: Settings2,
};
const TOTAL = ALL_PERMISSIONS.filter((p) => !p.restriction && p.key !== "admin.full").length;

interface AdminPanelProps {
  currentUser: User;
  onBackToDashboard: () => void;
}

type Draft = {
  id?: string;
  name: string;
  email: string;
  rolePreset: RolePresetId;
  permissions: Set<string>;
  active: boolean;
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "Jamais";

function presetLabel(id: string) {
  return ROLE_PRESETS.find((p) => p.id === id)?.label ?? "Personnalisé";
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btnIconTiny"
      title={`Copier ${label}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export function CredentialsCard({ identifier, password, name }: { identifier: string; password: string; name?: string }) {
  return (
    <div className="credCard">
      {name && <strong className="credName">{name}</strong>}
      <div className="credRow">
        <span>Identifiant</span>
        <code>{identifier}</code>
        <CopyButton value={identifier} label="l'identifiant" />
      </div>
      <div className="credRow">
        <span>Mot de passe temporaire</span>
        <code>{password}</code>
        <CopyButton value={password} label="le mot de passe" />
      </div>
    </div>
  );
}

export function AdminPanel({ currentUser, onBackToDashboard }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [issued, setIssued] = useState<{ name: string; identifier: string; password: string } | null>(null);
  const isFullAdmin = currentUser.permissions.includes("admin.full");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await api<AdminUser[]>("admin/users"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(() => users.filter((u) => u.active && u.mustChangePassword && u.temporaryPassword), [users]);

  const openCreate = () =>
    setDraft({
      name: "",
      email: "",
      rolePreset: "instructor",
      permissions: new Set(presetPermissions("instructor")),
      active: true,
    });

  const openEdit = (u: AdminUser) =>
    setDraft({
      id: u.id,
      name: u.name,
      email: u.email,
      rolePreset: (u.rolePreset as RolePresetId) || "custom",
      permissions: new Set(u.permissions.includes("admin.full") ? ["admin.full"] : u.permissions),
      active: u.active,
    });

  const toggle = (key: string) => {
    if (!draft) return;
    const has = draft.permissions.has(key);
    const next = has ? withoutDependents(draft.permissions, key) : withRequirements([...draft.permissions, key]);
    setDraft({ ...draft, permissions: next, rolePreset: "custom" });
  };

  const toggleModule = (moduleId: string, on: boolean) => {
    if (!draft) return;
    const mod = PERMISSION_MODULES.find((m) => m.id === moduleId)!;
    let next = new Set(draft.permissions);
    for (const p of mod.permissions) {
      if (p.restriction || p.sensitive) continue;
      next = on ? withRequirements([...next, p.key]) : withoutDependents(next, p.key);
    }
    setDraft({ ...draft, permissions: next, rolePreset: "custom" });
  };

  async function act(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(success);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const permissions = [...draft.permissions];
    if (draft.id) {
      const ok = await act(
        () => api("admin/users/update", { id: draft.id, name: draft.name, rolePreset: draft.rolePreset, permissions }),
        "Profil mis à jour.",
      );
      if (ok) setDraft(null);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api<{ identifier: string; temporaryPassword: string }>("admin/users", {
        name: draft.name,
        email: draft.email,
        rolePreset: draft.rolePreset,
        permissions,
      });
      setIssued({ name: draft.name, identifier: res.identifier, password: res.temporaryPassword });
      setDraft(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (u: AdminUser) => {
    if (!window.confirm(`Générer un nouveau mot de passe temporaire pour ${u.name} ? Ses sessions seront fermées.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ temporaryPassword: string }>("admin/users/update", { id: u.id, resetPassword: true });
      setIssued({ name: u.name, identifier: u.email, password: res.temporaryPassword });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setActive = (u: AdminUser, active: boolean) => {
    if (!active && !window.confirm(`Désactiver le compte de ${u.name} ? Il sera immédiatement déconnecté.`)) return;
    void act(() => api("admin/users/update", { id: u.id, active }), active ? "Compte réactivé." : "Compte désactivé.");
  };

  const draftIsAdmin = draft?.permissions.has("admin.full") ?? false;

  return (
    <div className="adminWorkspace">
      <div className="adminTopRow">
        <button type="button" className="linkButton" onClick={onBackToDashboard}>
          <ArrowLeft size={15} /> Retour au tableau de bord
        </button>
        <div className="adminTopActions">
          <button type="button" className="btnSecondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} /> Actualiser
          </button>
          <button type="button" className="btnPrimary" onClick={openCreate}>
            <UserPlus size={15} /> Nouveau membre
          </button>
        </div>
      </div>

      <div>
        <p className="eyebrow">ÉQUIPE & SÉCURITÉ</p>
        <h1 className="adminTitle">
          <ShieldCheck size={28} /> Panel d&apos;administration
        </h1>
        <p className="dashSubtitle">
          Créez les comptes de l&apos;équipe, transmettez leurs identifiants temporaires et réglez précisément leurs accès.
        </p>
      </div>

      {error && (
        <div className="calendarAlert errorAlert">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {message && (
        <div className="calendarAlert successAlert">
          <Check size={16} />
          <span>{message}</span>
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}

      {pending.length > 0 && (
        <section className="card pendingCreds">
          <div className="sectionCardHeader">
            <div className="sectionTitleWithBadge">
              <KeyRound size={18} />
              <h3 className="sectionCardTitle">Identifiants temporaires à transmettre</h3>
              <span className="badgeNeutral">{pending.length}</span>
            </div>
          </div>
          <p className="helperText">
            Chaque personne devra choisir son propre mot de passe à sa première connexion ; le code temporaire disparaît
            alors de cette liste.
          </p>
          <div className="credGrid">
            {pending.map((u) => (
              <CredentialsCard key={u.id} name={u.name} identifier={u.email} password={u.temporaryPassword!} />
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="sectionCardHeader">
          <div className="sectionTitleWithBadge">
            <Users size={18} />
            <h3 className="sectionCardTitle">Membres de l&apos;équipe</h3>
            <span className="badgeNeutral">{users.length}</span>
          </div>
        </div>
        {loading && users.length === 0 ? (
          <p className="emptyHelp">Chargement…</p>
        ) : (
          <div className="memberList">
            {users.map((u) => {
              const admin = u.permissions.includes("admin.full");
              const count = admin ? TOTAL : u.permissions.filter((p) => p !== "planning.own_only" && p !== "admin.full").length;
              const status = !u.active ? "off" : u.mustChangePassword ? "pending" : "on";
              return (
                <div key={u.id} className={`memberRow ${u.active ? "" : "inactive"}`}>
                  <div className="memberAvatar">{u.name.slice(0, 2).toUpperCase()}</div>
                  <div className="memberMain">
                    <strong>
                      {u.name}
                      {u.id === currentUser.id && <span className="memberYou"> · vous</span>}
                    </strong>
                    <span>{u.email}</span>
                  </div>
                  <span className={`chip ${admin ? "accent" : ""}`}>{admin ? "Administrateur" : presetLabel(u.rolePreset)}</span>
                  <div className="memberPerms" title="Accès accordés">
                    <div className="permMeter">
                      <span style={{ width: `${Math.round((count / TOTAL) * 100)}%` }} />
                    </div>
                    <small>
                      {count}/{TOTAL} accès
                    </small>
                  </div>
                  <span className={`statusPill ${status}`}>
                    {status === "on" ? "Actif" : status === "pending" ? "1re connexion en attente" : "Désactivé"}
                  </span>
                  <span className="memberLogin">
                    <Clock3 size={12} /> {fmtDate(u.lastLoginAt)}
                  </span>
                  <div className="memberActions">
                    <button type="button" className="btnIconTiny" title="Modifier les accès" onClick={() => openEdit(u)}>
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="btnIconTiny"
                      title="Réinitialiser le mot de passe"
                      disabled={busy || !u.active}
                      onClick={() => void resetPassword(u)}
                    >
                      <KeyRound size={13} />
                    </button>
                    {u.id !== currentUser.id && (
                      <button
                        type="button"
                        className={`btnIconTiny ${u.active ? "danger" : ""}`}
                        title={u.active ? "Désactiver le compte" : "Réactiver le compte"}
                        disabled={busy}
                        onClick={() => setActive(u, !u.active)}
                      >
                        <Power size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {draft && (
        <Modal wide title={draft.id ? `Accès de ${draft.name}` : "Nouveau membre de l'équipe"} close={() => setDraft(null)}>
          <form onSubmit={save} className="memberForm">
            <div className="formGrid">
              <label>
                Nom complet
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="ex : Lucas Martin"
                  required
                  minLength={2}
                  maxLength={150}
                  autoComplete="off"
                />
              </label>
              <label>
                Identifiant de connexion
                <input
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="ex : lucas.martin ou lucas@gopermis.fr"
                  required
                  minLength={3}
                  maxLength={254}
                  disabled={Boolean(draft.id)}
                  autoComplete="off"
                />
              </label>
            </div>
            {!draft.id && (
              <p className="helperText">
                <KeyRound size={13} /> Un mot de passe temporaire est généré automatiquement et affiché après la création. Le
                membre choisira le sien à sa première connexion.
              </p>
            )}

            <span className="formLabel">Profil de départ</span>
            <div className="presetRow">
              {ROLE_PRESETS.filter((p) => isFullAdmin || p.id !== "admin").map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`presetChip ${draft.rolePreset === p.id ? "active" : ""}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      rolePreset: p.id,
                      permissions: p.id === "custom" ? draft.permissions : new Set(presetPermissions(p.id)),
                    })
                  }
                >
                  <strong>{p.label}</strong>
                  <small>{p.hint}</small>
                </button>
              ))}
            </div>

            <div className="permHeader">
              <span className="formLabel">Accès détaillés</span>
              <small>
                {draftIsAdmin ? "Tous les droits" : `${[...draft.permissions].filter((k) => k !== "planning.own_only").length} accès cochés`}
              </small>
            </div>

            {draftIsAdmin ? (
              <div className="adminAllNotice">
                <ShieldCheck size={18} />
                <div>
                  <strong>Administrateur complet</strong>
                  <p>Ce compte a tous les accès, y compris ceux ajoutés plus tard.</p>
                </div>
                {isFullAdmin && (
                  <button
                    type="button"
                    className="btnSecondary"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        rolePreset: "custom",
                        permissions: withRequirements(
                          ALL_PERMISSIONS.filter((p) => !p.sensitive && !p.restriction).map((p) => p.key),
                        ),
                      })
                    }
                  >
                    Personnaliser
                  </button>
                )}
              </div>
            ) : (
              <div className="permModules">
                {PERMISSION_MODULES.map((m) => {
                  const Icon = MODULE_ICONS[m.id] ?? Settings2;
                  const regular = m.permissions.filter((p) => !p.restriction && !p.sensitive);
                  const onCount = regular.filter((p) => draft.permissions.has(p.key)).length;
                  const all = regular.length > 0 && onCount === regular.length;
                  return (
                    <div key={m.id} className={`permModule ${onCount ? "on" : ""}`}>
                      <div className="permModuleHead">
                        <span className="permModuleIcon">
                          <Icon size={16} />
                        </span>
                        <div>
                          <strong>{m.label}</strong>
                          <small>{m.description}</small>
                        </div>
                        {regular.length > 0 && (
                          <button type="button" className="permModuleAll" onClick={() => toggleModule(m.id, !all)}>
                            {all ? "Tout retirer" : "Tout autoriser"}
                          </button>
                        )}
                      </div>
                      <div className="permList">
                        {m.permissions.map((p) => {
                          if (p.sensitive && !isFullAdmin) return null;
                          const checked = draft.permissions.has(p.key);
                          const isChild = Boolean(p.requires?.some((r) => m.permissions.some((x) => x.key === r)));
                          return (
                            <label
                              key={p.key}
                              className={`permItem ${isChild ? "child" : ""} ${p.restriction ? "restriction" : ""} ${p.sensitive ? "sensitive" : ""}`}
                            >
                              <input type="checkbox" checked={checked} onChange={() => toggle(p.key)} />
                              <span className="permText">
                                <strong>{p.label}</strong>
                                <small>{p.description}</small>
                              </span>
                              {p.restriction && <span className="chip warn">Restriction</span>}
                              {p.sensitive && <span className="chip accent">Sensible</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="modalButtonsRow">
              <button type="button" className="btnSecondary" onClick={() => setDraft(null)}>
                Annuler
              </button>
              <button type="submit" className="btnPrimary" disabled={busy}>
                {busy ? "Enregistrement…" : draft.id ? "Enregistrer les accès" : "Créer le compte"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {issued && (
        <Modal title="Identifiants temporaires" close={() => setIssued(null)}>
          <p className="modalNotice">
            Transmettez ces identifiants à <strong>{issued.name}</strong>. À sa première connexion, il devra choisir son propre
            mot de passe. Ils restent visibles dans ce panel jusque-là.
          </p>
          <CredentialsCard identifier={issued.identifier} password={issued.password} />
          <div className="modalButtonsRow">
            <button type="button" className="btnPrimary" onClick={() => setIssued(null)}>
              C&apos;est noté
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
