"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import { ClientFields } from "./client-fields";
import { api, type ClientRecord } from "../lib/api-types";
import { useApp } from "./app-context";

export function CreateClientModal({
  onCreated,
}: {
  onCreated?: (client: ClientRecord) => void;
}) {
  const { createClientOpen, setCreateClientOpen } = useApp();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!createClientOpen) return null;

  return (
    <Modal
      title="Nouveau dossier élève"
      close={() => {
        if (!busy) {
          setError("");
          setCreateClientOpen(false);
        }
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const payload = {
              firstName: f.get("firstName"),
              lastName: f.get("lastName"),
              phone: f.get("phone"),
              email: f.get("email") || null,
              status: f.get("status"),
              source: f.get("source"),
            };
            const client = await api<ClientRecord>("clients", payload);
            setCreateClientOpen(false);
            if (onCreated) {
              onCreated(client);
            }
            router.push(`/clients/${client.id}`);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <ClientFields />
        <button className="primary" disabled={busy}>
          {busy ? "Enregistrement…" : "Créer et ouvrir la fiche client"}
        </button>
      </form>
    </Modal>
  );
}
