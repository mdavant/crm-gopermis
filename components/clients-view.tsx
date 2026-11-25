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
import { CLIENT_CATEGORIES, categoryOf, isOngoing } from "../lib/client-categories";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { useIsMobile } from "../lib/use-mobile";
import { MobileTopBar } from "./mobile-shell";

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
  const [filter, setFilter] = useState<"ongoing" | "completed" | "archived" | "all">("ongoing");
  const [category, setCategory] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isMobile = useIsMobile();

  const inTab = (c: ClientRecord) =>
    filter === "ongoing" ? isOngoing(c.status) : filter === "completed" ? c.status === "Terminé" : filter === "archived" ? c.status === "Archivé" : true;
  const filteredClients = clients.filter(
    (c) => inTab(c) && (category === "all" || (category === "none" ? !c.category : c.category === category)),
  );
  const countIn = (pred: (c: ClientRecord) => boolean) =>
    clients.filter((c) => inTab(c) && pred(c)).length;

  const toggleCompletion = async (e: React.MouseEvent, c: ClientRecord) => {
    e.stopPropagation();
    const completed = c.status !== "Terminé";
    if (completed && !window.confirm(`Passer ${c.first_name} ${c.last_name} dans les élèves terminés ? Vous pourrez le remettre en cours.`)) return;
    setBusy(true);
    setError("");
    try {
      await api("clients/completion", { id: c.id, completed });
      await onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClient = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Confirmer la archivage du dossier de ${name} ?`)) {
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

  if (isMobile)
    return (
      <div className="mClients">
        <MobileTopBar
          title="Élèves"
          subtitle={`${filteredClients.length} dossier${filteredClients.length > 1 ? "s" : ""}`}
          right={
            can("clients.write") && (
              <button type="button" className="mIconBtn mAccentBtn" aria-label="Nouvel élève" onClick={onNewClient}>
                <Plus size={20} />
              </button>
            )
          }
        />
        <label className="mSearchField">
          <Search size={17} />
          <input type="search" placeholder="Nom, téléphone, e-mail…" value={q} onChange={(e) => onSearchChange(e.target.value)} />
        </label>
        <div className="mSegment">
          {(
            [
              ["ongoing", "En cours"],
              ["completed", "Terminés"],
              ["archived", "Archivés"],
              ["all", "Tous"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="mChips">
          <button type="button" className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>
            Toutes <small>{countIn(() => true)}</small>
          </button>
          {CLIENT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={category === cat.id ? "active" : ""}
              onClick={() => setCategory(cat.id)}
              style={{ ["--cat" as string]: cat.color }}
            >
              <span className="catDotSm" /> {cat.label} <small>{countIn((c) => c.category === cat.id)}</small>
            </button>
          ))}
        </div>
        {error && <p className="genWarn error">{error}</p>}
        {filteredClients.length === 0 ? (
          <div className="mEmpty">
            <Users size={28} />
            <p>{q ? "Aucun élève trouvé" : "Aucun élève dans cette liste"}</p>
          </div>
        ) : (
          <ul className="mClientList">
            {filteredClients.map((c) => {
              const cat = categoryOf(c.category);
              return (
                <li key={c.id}>
                  <div className="mClientRow" role="button" tabIndex={0} onClick={() => onSelectClient(c.id)}>
                    <span className="mAvatar" style={{ ["--cat" as string]: cat?.color ?? "var(--acc)" }}>
                      {c.first_name[0]}
                      {c.last_name[0]}
                    </span>
                    <span className="mClientBody">
                      <strong>
                        {c.first_name} {c.last_name}
                      </strong>
                      <small>
                        {cat ? <span className="mCatTxt" style={{ ["--cat" as string]: cat.color }}>{cat.label}</span> : null}
                        {c.status !== "Actif" && c.status !== "En cours" ? ` · ${c.status}` : ""}
                      </small>
                    </span>
                    {c.phone && (
                      <a className="mCallBtn" href={`tel:${c.phone.replace(/\s/g, "")}`} onClick={(e) => e.stopPropagation()} aria-label={`Appeler ${c.first_name}`}>
                        <Phone size={16} />
                      </a>
                    )}
                    <ChevronRight size={18} className="mChev" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );

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
          <button
            type="button"
            className="btnPrimary"
            onClick={onNewClient}
            style={{
              background: "var(--acc)",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(37,99,235,0.35)",
            }}
          >
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
        <div className="searchBarContainer" style={{ borderColor: "#cbd5e1" }}>
          <Search size={16} className="searchIcon" style={{ color: "var(--acc)" }} />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom, téléphone ou email…"
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            className="searchInputModern"
          />
        </div>

        <div className="clientTabsRow">
          {(
            [
              ["ongoing", "En cours", clients.filter((c) => isOngoing(c.status)).length],
              ["completed", "Terminés", clients.filter((c) => c.status === "Terminé").length],
              ["archived", "Archivés", clients.filter((c) => c.status === "Archivé").length],
              ["all", "Tous", clients.length],
            ] as const
          ).map(([id, label, n]) => (
            <button key={id} type="button" className={`clientTabBtn ${filter === id ? "active" : ""}`} onClick={() => setFilter(id)}>
              {label} ({n})
            </button>
          ))}
        </div>
      </div>

      {/* Content: Table or Empty state */}
      <div className="clientsListCard">
        <div className="catChips">
          <button type="button" className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>
            Toutes catégories <small>{countIn(() => true)}</small>
          </button>
          {CLIENT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={category === cat.id ? "active" : ""}
              onClick={() => setCategory(cat.id)}
              style={{ ["--cat" as string]: cat.color }}
            >
              <span className="catDotSm" /> {cat.label} <small>{countIn((c) => c.category === cat.id)}</small>
            </button>
          ))}
          <button type="button" className={category === "none" ? "active" : ""} onClick={() => setCategory("none")}>
            Non classés <small>{countIn((c) => !c.category)}</small>
          </button>
        </div>

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
                        <div
                          className="clientAvatarCell"
                          style={{
                            background: "var(--acc-soft)",
                            color: "var(--acc)",
                            fontWeight: 800,
                            border: "1px solid var(--acc-line)",
                          }}
                        >
                          {c.first_name[0]}
                          {c.last_name[0]}
                        </div>
                        <div>
                          <strong>
                            {c.first_name} {c.last_name}
                          </strong>
                          <span className="clientSubMeta">
                            {categoryOf(c.category) && (
                              <span className="catBadge" style={{ ["--cat" as string]: categoryOf(c.category)!.color }}>
                                {categoryOf(c.category)!.label}
                              </span>
                            )}
                            Inscrit le {new Date(c.created_at).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="contactMeta">
                        <span className="contactRow">
                          <Phone size={13} style={{ color: "var(--acc)" }} /> {c.phone}
                        </span>
                        {c.email && (
                          <span className="contactRow subEmail">
                            <Mail size={13} style={{ color: "var(--acc)" }} /> {c.email}
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
                        {can("clients.write") && c.status !== "Archivé" && (
                          <button
                            type="button"
                            className="btnIconTiny"
                            title={c.status === "Terminé" ? "Remettre en cours" : "Marquer comme terminé"}
                            disabled={busy}
                            onClick={(e) => toggleCompletion(e, c)}
                          >
                            {c.status === "Terminé" ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                          </button>
                        )}
                        {can("clients.archive") && (
                          <button
                            type="button"
                            className="btnIconTiny danger"
                            title="Archiver définitivement"
                            disabled={busy}
                            onClick={(e) =>
                              handleDeleteClient(e, c.id, `${c.first_name} ${c.last_name}`)
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <span className="openFileBtn" style={{ color: "var(--acc)", fontWeight: 700 }}>
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
