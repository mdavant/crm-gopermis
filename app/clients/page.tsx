"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Phone,
  Mail,
} from "lucide-react";
import { api, type ClientPage, type ClientRecord } from "../../lib/api-types";
import { useApp } from "../../components/app-context";

export default function ClientsDirectoryPage() {
  const { can, setCreateClientOpen } = useApp();
  const router = useRouter();

  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ClientPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams({
        q,
        page: String(page),
        pageSize: "25",
        ...(filterStatus ? { status: filterStatus } : {}),
      });
      const res = await api<ClientPage>(`clients/search?${sp.toString()}`);
      setData(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, filterStatus, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadClients]);

  const handleRowClick = (client: ClientRecord) => {
    router.push(`/clients/${client.id}`);
  };

  const statuses = [
    { label: "Tous les statuts", value: "" },
    { label: "Inscrit", value: "Inscrit" },
    { label: "En formation", value: "En formation" },
    { label: "Permis obtenu", value: "Permis obtenu" },
    { label: "Archivé", value: "Archivé" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <p className="eyebrow">ANNUAIRE ADMINISTRATIF</p>
          <h1 style={{ fontSize: "26px", fontWeight: 800, margin: "4px 0 6px", letterSpacing: "-0.02em" }}>
            Dossiers élèves & clients
          </h1>
          <p style={{ color: "#64748b", fontSize: "13.5px", margin: 0 }}>
            {data ? `${data.total} élève(s) enregistré(s) au total` : "Chargement de l'annuaire…"}
          </p>
        </div>

        {can("clients.write") && (
          <button
            type="button"
            className="btnPrimaryOrange"
            onClick={() => setCreateClientOpen(true)}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Nouveau client</span>
          </button>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {/* Search and Filters Bar */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8",
            }}
          />
          <input
            type="search"
            placeholder="Rechercher par nom, prénom, téléphone ou email…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            style={{
              width: "100%",
              height: "42px",
              paddingLeft: "40px",
              paddingRight: "14px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              fontSize: "13.5px",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Filter size={15} style={{ color: "#64748b" }} />
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            style={{
              height: "42px",
              padding: "0 14px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              fontSize: "13px",
              color: "#334155",
              fontWeight: 600,
            }}
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clients Table / List */}
      <div className="card" style={{ padding: "8px 0", overflow: "hidden" }}>
        {loading && !data ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
            Chargement des données élèves…
          </div>
        ) : data && data.items.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <Users size={36} style={{ color: "#cbd5e1", margin: "0 auto 12px" }} />
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#334155" }}>
              Aucun élève trouvé
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              {q || filterStatus
                ? "Essayez d'ajuster vos critères de recherche ou de réinitialiser le filtre."
                : "Commencez par ajouter votre premier dossier client."}
            </p>
            {can("clients.write") && !q && !filterStatus && (
              <button
                type="button"
                className="btnPrimaryOrange"
                style={{ marginTop: "16px" }}
                onClick={() => setCreateClientOpen(true)}
              >
                <Plus size={15} />
                Créer un dossier élève
              </button>
            )}
          </div>
        ) : (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "48px 1.5fr 1.2fr 1fr 1fr",
                padding: "10px 20px",
                borderBottom: "1px solid #f1f5f9",
                fontSize: "11px",
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <span />
              <span>Nom & Prénom</span>
              <span>Coordonnées</span>
              <span>Statut</span>
              <span>Créé le</span>
            </div>

            {data?.items.map((client) => {
              const createdDate = new Date(client.created_at).toLocaleDateString("fr-FR", {
                timeZone: "Europe/Paris",
                day: "2-digit",
                month: "short",
                year: "numeric",
              });

              return (
                <div
                  key={client.id}
                  onClick={() => handleRowClick(client)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1.5fr 1.2fr 1fr 1fr",
                    padding: "14px 20px",
                    alignItems: "center",
                    borderBottom: "1px solid #f8fafc",
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "#fff7ed",
                      color: "#ea580c",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 700,
                      fontSize: "13px",
                    }}
                  >
                    {client.first_name[0]}
                    {client.last_name[0]}
                  </div>

                  <div>
                    <strong style={{ fontSize: "14px", color: "#0f172a", display: "block" }}>
                      {client.first_name} {client.last_name}
                    </strong>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Origine : {client.source}
                    </span>
                  </div>

                  <div style={{ fontSize: "12.5px", color: "#334155" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Phone size={12} style={{ color: "#94a3b8" }} />
                      <span>{client.phone}</span>
                    </div>
                    {client.email && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", color: "#64748b" }}>
                        <Mail size={12} style={{ color: "#94a3b8" }} />
                        <span>{client.email}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        padding: "3px 9px",
                        borderRadius: "6px",
                        background:
                          client.status === "Permis obtenu"
                            ? "#ecfdf5"
                            : client.status === "En formation"
                            ? "#eff6ff"
                            : client.status === "Archivé"
                            ? "#f1f5f9"
                            : "#fff7ed",
                        color:
                          client.status === "Permis obtenu"
                            ? "#059669"
                            : client.status === "En formation"
                            ? "#2563eb"
                            : client.status === "Archivé"
                            ? "#64748b"
                            : "#ea580c",
                      }}
                    >
                      {client.status}
                    </span>
                  </div>

                  <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                    {createdDate}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Server Pagination */}
        {data && data.pages > 1 && (
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <span style={{ fontSize: "13px", color: "#64748b" }}>
              Page {data.page} sur {data.pages} ({data.total} élèves)
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                disabled={data.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  height: "34px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <ChevronLeft size={14} />
                Précédent
              </button>
              <button
                type="button"
                disabled={data.page >= data.pages || loading}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  height: "34px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                Suivant
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
