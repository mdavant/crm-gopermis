"use client";
import { useState } from "react";
import { Modal } from "./modal";
import { api } from "../lib/api-types";
import { clearPreviewSession } from "../lib/session";
export function AccountSettings({
  close,
  done,
}: {
  close: () => void;
  done: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Changer mon mot de passe"
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setError("");
          if (f.get("newPassword") !== f.get("confirm")) {
            setError("Les mots de passe doivent être identiques.");
            return;
          }
          setBusy(true);
          try {
            await api("auth/password", {
              currentPassword: f.get("currentPassword"),
              newPassword: f.get("newPassword"),
            });
            clearPreviewSession();
            done();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Ce changement déconnecte toutes vos sessions. Vous devrez vous
          reconnecter avec le nouveau mot de passe.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <label>
          Mot de passe actuel
          <input
            name="currentPassword"
            type="password"
            required
            maxLength={256}
            autoComplete="current-password"
          />
        </label>
        <label>
          Nouveau mot de passe
          <input
            name="newPassword"
            type="password"
            required
            minLength={14}
            maxLength={256}
            autoComplete="new-password"
          />
        </label>
        <label>
          Confirmer le nouveau mot de passe
          <input
            name="confirm"
            type="password"
            required
            minLength={14}
            maxLength={256}
            autoComplete="new-password"
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy
            ? "Enregistrement…"
            : "Changer le mot de passe et me déconnecter"}
        </button>
      </form>
    </Modal>
  );
}
