"use client";
import React, { useState } from "react";
import {
  Users,
  Plus,
  Search,
  ChevronRight,
  Trash2,
  Phone,
  Mail,
} from "lucide-react";
import { api, type ClientRecord } from "../lib/api-types";

interface ClientsViewProps {
  clients: ClientRecord[];
  q: string;
  onSearchChange: (val: string) => void;
  onSelectClient: (id: string) => void;
  onNewClient: () => void;
  onRefresh: () => Promise<void>;
  can: (p: string) => boolean;
}

export function ClientsView({
  clients,
  q,
  onSearchChange,
  onSelectClient,
  onNewClient,
  onRefresh,
  can,
}: ClientsViewProps) {
  const [filter, setFilter] = useState<"all" | "active" | "archived">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const filteredClients = clients.filter((c) => {
    if (filter === "active") return c.status !== "Archivé";
    if (filter === "archived") return c.status === "Archivé";
    return true;
  });

  const handleDeleteClient = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Confirmer la suppression définitive du dossier de ${name} ?`)) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("clients/delete", { id });
      await onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="clientsWorkspace">
      {/* Top Header */}
      <div className="clientsHeader">
        <div>
          <span className="profileEyebrow">RELATIONS ÉLÈVES</span>
          <h1 className="clientsMainTitle">Clients & Dossiers</h1>
          <p className="clientsSubtitle">
            Gérez chaque fiche élève, les pièces du dossier NEPH et l&apos;affectation des prestations.
          </p>
        </div>

        {can("clients.write") && (
          <button type="button" className="btnPrimary" onClick={onNewClient}>
            <Plus size={16} />
            <span>Nouveau client</span>
          </button>
        )}
      </div>

      {error && (
        <div className="calendarAlert errorAlert">
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="clientsToolbar">
        <div className="searchBarContainer">
          <Search size={16} className="searchIcon" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom, téléphone ou email…"
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            className="searchInputModern"
          />
        </div>

        <div className="clientTabsRow">
          <button
            type="button"
            className={`clientTabBtn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Tous ({clients.length})
          </button>
          <button
            type="button"
            className={`clientTabBtn ${filter === "active" ? "active" : ""}`}
            onClick={() => setFilter("active")}
          >
            Actifs ({clients.filter((c) => c.status !== "Archivé").length})
          </button>
          <button
            type="button"
            className={`clientTabBtn ${filter === "archived" ? "active" : ""}`}
            onClick={() => setFilter("archived")}
          >
            Archivés ({clients.filter((c) => c.status === "Archivé").length})
          </button>
        </div>
      </div>

      {/* Content: Table or Empty state */}
      <div className="clientsListCard">
        {filteredClients.length === 0 ? (
          <div className="emptyClientsView">
            <div className="emptyIconCircle">
              <Users size={32} />
            </div>
            <h3>{q ? "Aucun élève trouvé" : "Aucun élève enregistré"}</h3>
            <p>
              {q
                ? "Modifiez vos critères de recherche ou réinitialisez le filtre."
                : "Commencez par ajouter un premier élève pour gérer ses leçons et son dossier."}
            </p>
            {!q && can("clients.write") && (
              <button
                type="button"
                className="btnPrimarySmall"
                onClick={onNewClient}
              >
                <Plus size={15} /> Créer une fiche élève
              </button>
            )}
          </div>
        ) : (
          <div className="clientsTableWrapper">
            <table className="clientsTable">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Contact</th>
                  <th>Origine</th>
                  <th>Statut</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((c) => (
                  <tr
                    key={c.id}
                    className="clientRowItem"
                    onClick={() => onSelectClient(c.id)}
                  >
                    <td>
                      <div className="clientInfoCell">
                        <div className="clientAvatarCell">
                          {c.first_name[0]}
                          {c.last_name[0]}
                        </div>
                        <div>
                          <strong>
                            {c.first_name} {c.last_name}
                          </strong>
                          <span className="clientSubMeta">Inscrit le {new Date(c.created_at).toLocaleDateString("fr-FR")}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="contactMeta">
                        <span className="contactRow">
                          <Phone size={13} /> {c.phone}
                        </span>
                        {c.email && (
                          <span className="contactRow subEmail">
                            <Mail size={13} /> {c.email}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="sourceTag">{c.source || "Saisie manuelle"}</span>
                    </td>

                    <td>
                      <span className={`clientStatusTag ${c.status.toLowerCase()}`}>
                        {c.status}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div className="clientRowActions">
                        {can("clients.write") && (
                          <button
                            type="button"
                            className="btnIconTiny danger"
                            title="Supprimer définitivement"
                            disabled={busy}
                            onClick={(e) =>
                              handleDeleteClient(e, c.id, `${c.first_name} ${c.last_name}`)
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <span className="openFileBtn">
                          Ouvrir <ChevronRight size={14} />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
