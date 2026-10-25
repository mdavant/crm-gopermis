"use client";
import { useState } from "react";
import { api, type ClientRecord } from "../lib/api-types";
import { Modal } from "./modal";
import { ClientFields } from "./client-fields";
export function ClientEditor({
  client,
  close,
  saved,
  reload,
}: {
  client: ClientRecord;
  close: () => void;
  saved: () => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title="Modifier les coordonnées"
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          const values = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await api("clients/" + client.id, {
              ...values,
              version: client.version,
            });
            await saved();
            close();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          La fiche reste liée à toutes ses prestations, séances, notes et
          paiements. Aucun historique n’est supprimé.
        </p>
        {error && (
          <div role="alert" className="error">
            {error}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void reload()
                  .then(close)
                  .catch((e) => setError(e.message))
              }
            >
              Recharger la fiche
            </button>
          </div>
        )}
        <ClientFields client={client} />
        <button className="primary" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer les coordonnées"}
        </button>
      </form>
    </Modal>
  );
}
