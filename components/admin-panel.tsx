"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  UserPlus,
  ArrowLeft,
  Key,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Calendar,
  Users,
  HardDrive,
  Database,
  RefreshCw,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { api, type AdminUser, type User } from "../lib/api-types";
import { useApp } from "./app-context";

interface AdminPanelProps {
  currentUser: User;
  onBackToDashboard: () => void;
}

const PRESET_TEMPLATES: Record<
  "admin" | "instructor" | "secretary" | "custom",
  { label: string; desc: string; permissions: string[] }
> = {
  admin: {
    label: "Administrateur",
    desc: "Accès complet à tous les modules, au panel admin et à tous les dossiers",
    permissions: [
      "admin.full",
      "planning.create",
      "clients.view",
      "clients.create",
      "clients.edit",
      "drive.all",
      "catalog.edit",
    ],
  },
  instructor: {
    label: "Moniteur",
    desc: "Planning limité à son nom ou sans accompagnateur, consultation des dossiers",
    permissions: ["planning.create", "planning.own_only", "clients.view"],
  },
  secretary: {
    label: "Secrétaire / Accueil",
    desc: "Gestion complète du planning, création et modification des dossiers élèves",
    permissions: [
      "planning.create",
      "clients.view",
      "clients.create",
      "clients.edit",
    ],
  },
  custom: {
    label: "Personnalisé",
    desc: "Configuration sur-mesure case par case",
    permissions: [],
  },
};

const PERMISSION_GROUPS = [
  {
    category: "Planning & Calendrier",
    icon: Calendar,
    items: [
      {
        id: "planning.create",
        label: "Créer des séances et réservations au planning",
        hint: "Permet de programmer des cours de conduite, examens et remises à niveau",
      },
      {
        id: "planning.own_only",
        label: "Limiter l'accompagnateur à son propre nom ou sans accompagnateur",
        hint: "Spécifique moniteur : ne peut pas inscrire d'autres moniteurs à sa place",
      },
    ],
  },
  {
    category: "Clients & Dossiers Élèves",
    icon: Users,
    items: [
      {
        id: "clients.view",
        label: "Consulter la liste et les fiches des élèves",
        hint: "Accès en lecture aux coordonnées, forfaits et historique d'heures",
      },
      {
        id: "clients.create",
        label: "Créer de nouveaux dossiers élèves",
        hint: "Permet d'ajouter une fiche élève avec téléphone, statut et origine",
      },
      {
        id: "clients.edit",
        label: "Modifier les dossiers et informations élèves",
        hint: "Permet d'éditer les coordonnées, statuts et pièces justificatives",
      },
    ],
  },
  {
    category: "Explorateur de fichiers / Drive",
    icon: HardDrive,
    items: [
      {
        id: "drive.all",
        label: "Accès étendu à tous les dossiers du Drive (Réservé admin)",
        hint: "Permet de voir et gérer l'ensemble des répertoires et documents de l'auto-école",
      },
    ],
  },
  {
    category: "Données de l'auto-école",
    icon: Database,
    items: [
      {
        id: "catalog.edit",
        label: "Modifier les tarifs, offres, véhicules et moniteurs",
        hint: "Autorise la modification du catalogue officiel et de la flotte",
      },
    ],
  },
  {
    category: "Super-Administration",
    icon: ShieldCheck,
    items: [
      {
        id: "admin.full",
        label: "Accès Super-Administrateur (Panel Admin & Gestion des rôles)",
        hint: "Donne le plein pouvoir sur le CRM et la création des profils équipe",
      },
    ],
  },
];

export function AdminPanel({ currentUser, onBackToDashboard }: AdminPanelProps) {
  const { theme } = useApp();
  const isDark = theme === "dark";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal / Drawer state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRolePreset, setFormRolePreset] = useState<
    "admin" | "instructor" | "secretary" | "custom"
  >("instructor");
  const [formPermissions, setFormPermissions] = useState<Set<string>>(
    new Set(PRESET_TEMPLATES.instructor.permissions)
  );
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<AdminUser[]>("admin/users");
      setUsers(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRolePreset("instructor");
    setFormPermissions(new Set(PRESET_TEMPLATES.instructor.permissions));
    setShowPassword(false);
    setModalOpen(true);
    setError("");
  };

  const openEditModal = (u: AdminUser) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword("");
    setFormRolePreset(u.rolePreset);
    setFormPermissions(new Set(u.permissions));
    setShowPassword(false);
    setModalOpen(true);
    setError("");
  };

  const handlePresetSelect = (presetKey: "admin" | "instructor" | "secretary" | "custom") => {
    setFormRolePreset(presetKey);
    if (presetKey !== "custom") {
      setFormPermissions(new Set(PRESET_TEMPLATES[presetKey].permissions));
    }
  };

  const togglePermission = (permId: string) => {
    setFormPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });
    setFormRolePreset("custom");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setSubmitting(true);

    try {
      if (editingUser) {
        await api("admin/users/update", {
          id: editingUser.id,
          name: formName.trim(),
          rolePreset: formRolePreset,
          permissions: Array.from(formPermissions),
          ...(formPassword.trim() ? { newPassword: formPassword.trim() } : {}),
        });
        setSuccessMsg(`Profil de ${formName} mis à jour avec succès.`);
      } else {
        if (!formPassword.trim()) {
          setError("Veuillez renseigner un mot de passe initial.");
          setSubmitting(false);
          return;
        }
        await api("admin/users", {
          email: formEmail.trim(),
          name: formName.trim(),
          password: formPassword.trim(),
          rolePreset: formRolePreset,
          permissions: Array.from(formPermissions),
        });
        setSuccessMsg(`Nouveau profil pour ${formName} créé avec succès.`);
      }
      setModalOpen(false);
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (u: AdminUser) => {
    if (u.id === currentUser.id) {
      alert("Vous ne pouvez pas supprimer votre propre compte administrateur.");
      return;
    }
    if (!window.confirm(`Supprimer définitivement le profil de "${u.name}" (${u.email}) ?`)) {
      return;
    }
    setError("");
    try {
      await api("admin/users/delete", { id: u.id });
      setSuccessMsg(`Profil de ${u.name} supprimé.`);
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const c = {
    surface: isDark ? "#0b101b" : "transparent",
    cardBg: isDark ? "#111827" : "rgba(255, 255, 255, 0.5)",
    subtleBg: isDark ? "#1e293b" : "rgba(255, 255, 255, 0.38)",
    border: isDark ? "#1e293b" : "rgba(255, 255, 255, 0.75)",
    textHeading: isDark ? "#f8fafc" : "var(--ink)",
    textBody: isDark ? "#cbd5e1" : "var(--ink-2)",
    textMuted: isDark ? "#94a3b8" : "var(--ink-3)",
    blueBrand: "var(--acc)",
    blueSoft: isDark ? "color-mix(in oklab, var(--acc) 20%, transparent)" : "var(--acc-soft)",
  };

  return (
    <div
      style={{
        padding: "32px 40px 60px",
        background: c.surface,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      {/* Top Breadcrumb & Return to Dashboard (matching Image 2) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={onBackToDashboard}
          style={{
            background: "transparent",
            border: "none",
            color: c.blueBrand,
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: 0,
          }}
        >
          <ArrowLeft size={16} />
          <span>Retour au tableau de bord</span>
        </button>

        <button
          type="button"
          onClick={openCreateModal}
          style={{
            height: "38px",
            padding: "0 18px",
            borderRadius: "10px",
            border: "none",
            background: c.blueBrand,
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(37, 99, 235, 0.35)",
            transition: "all 0.15s ease",
          }}
        >
          <UserPlus size={16} />
          <span>Créer un profil</span>
        </button>
      </div>

      {/* Main Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: c.blueSoft,
              color: c.blueBrand,
              display: "grid",
              placeItems: "center",
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: c.textHeading,
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Panel Administration & Rôles
            </h1>
            <p style={{ margin: "3px 0 0", fontSize: "13px", color: c.textMuted }}>
              Gérez les accès équipe, définissez les permissions granulaires et configurez les profils moniteurs.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback alerts */}
      {error && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: "12px",
            padding: "12px 16px",
            color: "#991b1b",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError("")}
            style={{ background: "transparent", border: "none", color: "#991b1b", cursor: "pointer", fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #6ee7b7",
            borderRadius: "12px",
            padding: "12px 16px",
            color: "#065f46",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg("")}
            style={{ background: "transparent", border: "none", color: "#065f46", cursor: "pointer", fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Team Members List Card (matching Image 2 Settings table) */}
      <div
        style={{
          background: c.cardBg,
          border: `1px solid ${c.border}`,
          borderRadius: "18px",
          overflow: "hidden",
          boxShadow: isDark ? "0 2px 6px rgba(0,0,0,0.3)" : "0 2px 6px rgba(0,0,0,0.03)",
        }}
      >
        <div
          style={{
            padding: "18px 24px",
            borderBottom: `1px solid ${c.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: c.textHeading }}>
              Membres de l&apos;équipe ({users.length})
            </h3>
            <span style={{ fontSize: "12px", color: c.textMuted }}>
              Chaque membre se connecte avec son identifiant et ses autorisations dédiées.
            </span>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            title="Actualiser la liste"
            style={{
              background: "transparent",
              border: `1px solid ${c.border}`,
              borderRadius: "8px",
              padding: "6px 10px",
              color: c.textMuted,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
            }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Actualiser</span>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: c.textMuted }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 8px", color: c.blueBrand }} />
            <p style={{ fontSize: "13px" }}>Chargement des profils…</p>
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <Users size={36} style={{ color: c.textMuted, margin: "0 auto 10px" }} />
            <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: c.textHeading }}>
              Aucun profil créé
            </h4>
            <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: c.textMuted }}>
              Créez le premier compte moniteur ou administrateur.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              style={{
                background: c.blueBrand,
                color: "#fff",
                border: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 650,
                fontSize: "12.5px",
              }}
            >
              Créer un profil
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    background: c.subtleBg,
                    borderBottom: `1px solid ${c.border}`,
                    fontSize: "11px",
                    fontWeight: 700,
                    color: c.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  <th style={{ padding: "12px 24px", textAlign: "left" }}>Utilisateur</th>
                  <th style={{ padding: "12px 18px", textAlign: "left" }}>Identifiant / Email</th>
                  <th style={{ padding: "12px 18px", textAlign: "left" }}>Rôle</th>
                  <th style={{ padding: "12px 18px", textAlign: "left" }}>Permissions</th>
                  <th style={{ padding: "12px 18px", textAlign: "left" }}>Statut</th>
                  <th style={{ padding: "12px 24px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const initial = u.name.slice(0, 1).toUpperCase();
                  const isAdmin = u.rolePreset === "admin" || u.permissions.includes("admin.full");
                  const isInstructor = u.rolePreset === "instructor" || u.permissions.includes("planning.own_only");

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: `1px solid ${c.border}`,
                        fontSize: "13px",
                        color: c.textBody,
                        transition: "background 0.12s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = c.subtleBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "14px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "50%",
                              background: isAdmin ? c.blueBrand : (isDark ? "#334155" : "#e2e8f0"),
                              color: isAdmin ? "#ffffff" : c.textHeading,
                              fontWeight: 800,
                              fontSize: "12px",
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            {initial}
                          </div>
                          <div>
                            <strong style={{ color: c.textHeading, display: "block" }}>{u.name}</strong>
                            {u.id === currentUser.id && (
                              <span style={{ fontSize: "11px", color: c.blueBrand, fontWeight: 700 }}>
                                (Votre compte actuel)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "14px 18px", color: c.textMuted }}>{u.email}</td>

                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: "12px",
                            background: isAdmin
                              ? c.blueSoft
                              : isInstructor
                              ? (isDark ? "#1e293b" : "#f1f5f9")
                              : (isDark ? "#334155" : "#e2e8f0"),
                            color: isAdmin ? c.blueBrand : c.textHeading,
                            border: isAdmin ? `1px solid ${c.blueBrand}` : "none",
                          }}
                        >
                          {isAdmin
                            ? "Administrateur"
                            : isInstructor
                            ? "Moniteur"
                            : u.rolePreset === "secretary"
                            ? "Secrétariat"
                            : "Personnalisé"}
                        </span>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            color: c.textMuted,
                            fontWeight: 600,
                          }}
                        >
                          {isAdmin ? "Toutes autorisations (7/7)" : `${u.permissions.length} activée(s)`}
                        </span>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: u.active ? "#059669" : "#dc2626",
                            background: u.active ? "#ecfdf5" : "#fee2e2",
                            padding: "2px 8px",
                            borderRadius: "10px",
                          }}
                        >
                          {u.active ? "Actif" : "Désactivé"}
                        </span>
                      </td>

                      <td style={{ padding: "14px 24px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            title="Modifier le profil & permissions"
                            style={{
                              background: "transparent",
                              border: `1px solid ${c.border}`,
                              borderRadius: "7px",
                              padding: "6px 10px",
                              color: c.blueBrand,
                              fontSize: "12px",
                              fontWeight: 650,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Edit2 size={13} />
                            <span>Gérer</span>
                          </button>

                          {u.id !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => handleDelete(u)}
                              title="Supprimer ce compte"
                              style={{
                                background: "transparent",
                                border: "none",
                                borderRadius: "7px",
                                padding: "6px 8px",
                                color: "#dc2626",
                                cursor: "pointer",
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT PROFILE MODAL */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(5px)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: "22px",
              padding: "26px 28px",
              boxShadow: isDark ? "0 25px 60px rgba(0,0,0,0.6)" : "0 25px 60px rgba(15,23,42,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: c.blueSoft,
                    color: c.blueBrand,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Key size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: "17px", fontWeight: 800, margin: 0, color: c.textHeading }}>
                    {editingUser ? `Modifier les accès de ${editingUser.name}` : "Créer un nouveau profil utilisateur"}
                  </h3>
                  <span style={{ fontSize: "12px", color: c.textMuted }}>
                    Définissez les identifiants et cochez les permissions autorisées.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: "transparent", border: "none", color: c.textMuted, cursor: "pointer", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Identity & Credentials */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", fontWeight: 700, color: c.textHeading }}>
                  Nom complet
                  <input
                    type="text"
                    required
                    placeholder="ex: Lucas Martin"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    style={{
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "9px",
                      border: `1px solid ${c.border}`,
                      background: c.subtleBg,
                      color: c.textHeading,
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", fontWeight: 700, color: c.textHeading }}>
                  Identifiant ou Email
                  <input
                    type="text"
                    required
                    disabled={!!editingUser}
                    placeholder="ex: moniteur.lucas"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    style={{
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "9px",
                      border: `1px solid ${c.border}`,
                      background: editingUser ? (isDark ? "#1e293b" : "#f1f5f9") : c.subtleBg,
                      color: editingUser ? c.textMuted : c.textHeading,
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </label>
              </div>

              {/* Password field */}
              <div>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", fontWeight: 700, color: c.textHeading }}>
                  {editingUser ? "Nouveau mot de passe (laisser vide pour ne pas modifier)" : "Mot de passe initial"}
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      required={!editingUser}
                      placeholder={editingUser ? "••••••••••••" : "Au moins 4 caractères"}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      style={{
                        width: "100%",
                        height: "38px",
                        paddingLeft: "12px",
                        paddingRight: "36px",
                        borderRadius: "9px",
                        border: `1px solid ${c.border}`,
                        background: c.subtleBg,
                        color: c.textHeading,
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        color: c.textMuted,
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
              </div>

              {/* Role Presets (Cards / Radio) */}
              <div>
                <span style={{ display: "block", fontSize: "13px", fontWeight: 700, color: c.textHeading, marginBottom: "8px" }}>
                  Profil préconfiguré
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                  {(["admin", "instructor", "secretary", "custom"] as const).map((key) => {
                    const item = PRESET_TEMPLATES[key];
                    const isSelected = formRolePreset === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handlePresetSelect(key)}
                        style={{
                          padding: "10px",
                          borderRadius: "11px",
                          border: isSelected ? `2px solid ${c.blueBrand}` : `1px solid ${c.border}`,
                          background: isSelected ? c.blueSoft : c.subtleBg,
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <strong
                          style={{
                            display: "block",
                            fontSize: "12.5px",
                            color: isSelected ? c.blueBrand : c.textHeading,
                            fontWeight: 700,
                          }}
                        >
                          {item.label}
                        </strong>
                        <span style={{ fontSize: "10.5px", color: c.textMuted, marginTop: "2px", display: "block", lineHeight: 1.25 }}>
                          {key === "admin"
                            ? "Tout pouvoir"
                            : key === "instructor"
                            ? "Moniteur auto"
                            : key === "secretary"
                            ? "Secrétariat"
                            : "Sur-mesure"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Granular Permissions Section */}
              <div
                style={{
                  borderTop: `1px solid ${c.border}`,
                  paddingTop: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div>
                  <h4 style={{ fontSize: "13.5px", fontWeight: 800, margin: "0 0 4px", color: c.textHeading }}>
                    Permissions granulaires
                  </h4>
                  <p style={{ margin: 0, fontSize: "11.5px", color: c.textMuted }}>
                    Cochez ou décochez les autorisations spécifiques attribuées à cet utilisateur.
                  </p>
                </div>

                {PERMISSION_GROUPS.map((group) => {
                  const GroupIcon = group.icon;
                  return (
                    <div
                      key={group.category}
                      style={{
                        background: c.subtleBg,
                        border: `1px solid ${c.border}`,
                        borderRadius: "12px",
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                        <GroupIcon size={15} style={{ color: c.blueBrand }} />
                        <strong style={{ fontSize: "12.5px", color: c.textHeading }}>{group.category}</strong>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {group.items.map((perm) => {
                          const isChecked = formPermissions.has(perm.id) || formPermissions.has("admin.full");
                          const isLockedByAdmin = formPermissions.has("admin.full") && perm.id !== "admin.full";

                          return (
                            <label
                              key={perm.id}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "10px",
                                cursor: isLockedByAdmin ? "default" : "pointer",
                                opacity: isLockedByAdmin ? 0.75 : 1,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isLockedByAdmin}
                                onChange={() => togglePermission(perm.id)}
                                style={{
                                  marginTop: "3px",
                                  width: "16px",
                                  height: "16px",
                                  accentColor: c.blueBrand,
                                  cursor: "pointer",
                                }}
                              />
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: "12px", fontWeight: 700, color: c.textHeading, display: "block" }}>
                                  {perm.label}
                                </span>
                                <span style={{ fontSize: "11px", color: c.textMuted, display: "block" }}>
                                  {perm.hint}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Submit Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  borderTop: `1px solid ${c.border}`,
                  paddingTop: "14px",
                  marginTop: "6px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "9px",
                    border: `1px solid ${c.border}`,
                    background: "transparent",
                    color: c.textBody,
                    fontSize: "13px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "9px",
                    border: "none",
                    background: c.blueBrand,
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(37,99,235,0.35)",
                  }}
                >
                  {submitting
                    ? "Enregistrement…"
                    : editingUser
                    ? "Enregistrer les modifications"
                    : "Créer le profil"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
