"use client";
import React, { useState } from "react";
import { Shield, KeyRound, CheckCircle2, AlertCircle, LogOut } from "lucide-react";
import { api, type User } from "../lib/api-types";

interface ProfileViewProps {
  user: User;
  onUserUpdate: (updated: User) => void;
  onLogout: () => void;
}

export function ProfileView({ user, onUserUpdate, onLogout }: ProfileViewProps) {
  const [name, setName] = useState(user.name);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword && newPassword.length < 8) {
      setError("Le nouveau mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);
    try {
      const res = await api<{ ok: boolean; name: string }>("me/update", {
        name,
        ...(newPassword ? { password: newPassword } : {}),
      });
      setMessage("Votre profil a été mis à jour avec succès.");
      onUserUpdate({ ...user, name: res.name || name });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profileWorkspace">
      <div className="profileHeader">
        <div>
          <span className="profileEyebrow">COMPTE & SÉCURITÉ</span>
          <h1 className="profileMainTitle">Mon Profil</h1>
          <p className="profileSubtitle">Gérez vos informations de compte, identifiants et mot de passe.</p>
        </div>
      </div>

      {error && (
        <div className="calendarAlert errorAlert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="calendarAlert successAlert">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}

      <div className="profileGrid">
        {/* Main form */}
        <div className="profileCard mainProfileCard">
          <div className="profileAvatarLarge">
            <span>{name.slice(0, 2).toUpperCase()}</span>
          </div>

          <form onSubmit={handleSubmit} className="profileForm">
            <label className="profileInputLabel">
              Nom complet affiché
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={150}
                className="profileTextInput"
              />
            </label>

            <div className="dividerSoft" />

            <h3 className="sectionSubHeading">
              <KeyRound size={16} /> Modification du mot de passe
            </h3>
            <p className="helperText">Laissez vide si vous ne souhaitez pas modifier votre mot de passe actuel.</p>

            <label className="profileInputLabel">
              Nouveau mot de passe
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Au moins 8 caractères"
                className="profileTextInput"
              />
            </label>

            <label className="profileInputLabel">
              Confirmer le mot de passe
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                className="profileTextInput"
              />
            </label>

            <div className="formActionsRow">
              <button type="submit" className="btnPrimary" disabled={busy}>
                {busy ? "Enregistrement…" : "Enregistrer les modifications"}
              </button>
            </div>
          </form>
        </div>

        {/* Account Info Sidebar */}
        <div className="profileCard sideProfileCard">
          <h3 className="sectionSubHeading">
            <Shield size={16} /> Informations de compte
          </h3>

          <div className="infoList">
            <div className="infoItem">
              <span className="infoLabel">Rôle administrateur</span>
              <strong className="infoVal">Administrateur Technique</strong>
            </div>

            <div className="infoItem">
              <span className="infoLabel">Auto-école</span>
              <strong className="infoVal">GoPermis 31</strong>
            </div>

            <div className="infoItem">
              <span className="infoLabel">Droits d&apos;accès</span>
              <span className="badgeNeutral">Accès complet</span>
            </div>
          </div>

          <div className="dividerSoft" />

          <button type="button" className="btnDanger" onClick={onLogout}>
            <LogOut size={16} />
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>
    </div>
  );
}
