"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Calendar,
  Clock,
  Plus,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Eye,
} from "lucide-react";
import { api, type HomeStats, type Booking } from "../lib/api-types";
import { useApp } from "../components/app-context";

export default function AccueilPage() {
  const { user, can, setCreateClientOpen, setNewBookingOpen } = useApp();
  const router = useRouter();

  const [stats, setStats] = useState<HomeStats | null>(null);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const todayFormatted = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const promises: [Promise<HomeStats | null>, Promise<Booking[]>] = [
        can("clients.read") ? api<HomeStats>("stats/summary") : Promise.resolve(null),
        can("schedule.read") ? api<Booking[]>(`bookings?date=${todayStr}`) : Promise.resolve([]),
      ];
      const [s, b] = await Promise.all(promises);
      setStats(s);
      setTodayBookings(b);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [can, todayStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const changelog = [
    {
      date: "25 octobre 2026",
      badge: "Planning",
      title: "Grille calendrier interactive 08h–20h avec double volet",
      desc: "Nouvelle grille calendrier aux normes Europe/Paris, vue Semaine et Jour, mini-calendrier mensuel interactif et filtres instantanés par véhicule et moniteur.",
    },
    {
      date: "25 octobre 2026",
      badge: "Dossiers",
      title: "Fiches clients directes avec URL permanente /clients/[id]",
      desc: "Accès instantané et partageable par URL directe à l'ensemble du dossier : coordonnées, offres actives, historique des séances, paiements et relevé d'heures.",
    },
    {
      date: "24 octobre 2026",
      badge: "Réservations",
      title: "Vérification anti-conflit stricte & verrous de calendrier",
      desc: "Détection temps réel des chevauchements d'horaires sur les véhicules physiques, les moniteurs et les créneaux élèves via contraintes PostgreSQL calendar_occupancy.",
    },
    {
      date: "24 octobre 2026",
      badge: "Comptabilité",
      title: "Consommation stricte des heures à la réalisation effective",
      desc: "Planification libre sans débit immédiat ; débit d'heures irréversible et protégé contre tout découvert lors de la validation finale de la leçon.",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Top Hero Strip */}
      <div className="dashHeroStrip">
        <div>
          <p className="eyebrow">TABLEAU DE BORD OPÉRATIONNEL</p>
          <h1 style={{ fontSize: "28px", fontWeight: 800, margin: "4px 0", letterSpacing: "-0.02em" }}>
            Bonjour, {user?.name}
          </h1>
          <p style={{ color: "#64748b", fontSize: "14px", margin: 0, textTransform: "capitalize" }}>
            {todayFormatted} · Fuseau Europe/Paris
          </p>
        </div>

        {/* Quick Actions */}
        <div className="dashQuickActions">
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

          {can("schedule.write") && (
            <button
              type="button"
              style={{
                height: "38px",
                padding: "0 16px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: "13px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
              onClick={() => setNewBookingOpen(true)}
            >
              <Calendar size={15} />
              <span>Réserver une séance</span>
            </button>
          )}

          <Link href="/planning" style={{ textDecoration: "none" }}>
            <button
              type="button"
              style={{
                height: "38px",
                padding: "0 16px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#475569",
                fontSize: "13px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>Ouvrir le planning</span>
              <ArrowRight size={14} />
            </button>
          </Link>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {/* 3 Real Indicators Bento Cards */}
      <section className="bentoStats">
        {/* Card 1: Total Clients */}
        <div className="card bentoCard">
          <div className="bentoHead">
            <div>
              <span className="bentoLabel">ÉLÈVES INSCRITS</span>
              <p className="bentoDesc">Total dossiers actifs réels</p>
            </div>
            <div className="bentoIcon">
              <Users size={20} />
            </div>
          </div>
          <div className="bentoNumber">{stats ? stats.totalClients : "—"}</div>
          <div className="bentoFoot">
            <Link href="/clients" style={{ color: "#ea580c", textDecoration: "none", fontWeight: 600, fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              Consulter l&apos;annuaire complet <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Card 2: Today Sessions */}
        <div className="card bentoCard">
          <div className="bentoHead">
            <div>
              <span className="bentoLabel">SÉANCES AUJOURD&apos;HUI</span>
              <p className="bentoDesc">Leçons du {todayStr}</p>
            </div>
            <div className="bentoIcon">
              <Calendar size={20} />
            </div>
          </div>
          <div className="bentoNumber">{stats ? stats.todayBookingsCount : "—"}</div>
          <div className="bentoFoot">
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Dont {todayBookings.filter((b) => b.status === "completed").length} déjà réalisée(s)
            </span>
          </div>
        </div>

        {/* Card 3: Today Hours */}
        <div className="card bentoCard">
          <div className="bentoHead">
            <div>
              <span className="bentoLabel">VOLUME D&apos;HEURES</span>
              <p className="bentoDesc">Planifiées sur la journée</p>
            </div>
            <div className="bentoIcon">
              <Clock size={20} />
            </div>
          </div>
          <div className="bentoNumber">
            {stats ? `${stats.todayHours} h` : "—"}
          </div>
          <div className="bentoFoot">
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Amplitude 08:00 – 20:00
            </span>
          </div>
        </div>
      </section>

      {/* Daily Schedule & Changelog Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "24px" }} className="dashMainGrid">
        {/* Left Column: Today's Schedule */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
            <div>
              <span className="eyebrow">HORAIRES DU JOUR</span>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "2px 0 0" }}>
                Séances prévues aujourd&apos;hui
              </h2>
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              style={{
                height: "32px",
                padding: "0 10px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                color: "#64748b",
                fontSize: "12px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Actualiser
            </button>
          </div>

          {loading ? (
            <p style={{ color: "#64748b", fontSize: "13px" }}>Chargement du planning du jour…</p>
          ) : todayBookings.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", background: "#f8fafc", borderRadius: "14px", border: "1px dashed #cbd5e1" }}>
              <Calendar size={32} style={{ color: "#94a3b8", margin: "0 auto 10px" }} />
              <p style={{ margin: "0 0 6px", fontWeight: 600, color: "#334155" }}>
                Aucune leçon programmée aujourd&apos;hui
              </p>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>
                Utilisez le bouton ci-dessus pour planifier une séance pour un élève.
              </p>
              {can("schedule.write") && (
                <button
                  type="button"
                  className="btnPrimaryOrange"
                  style={{ marginTop: "14px" }}
                  onClick={() => setNewBookingOpen(true)}
                >
                  <Plus size={15} />
                  Réserver un créneau
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {todayBookings.map((b) => {
                const startTime = new Date(b.starts_at).toLocaleTimeString("fr-FR", {
                  timeZone: "Europe/Paris",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const endTime = new Date(b.ends_at).toLocaleTimeString("fr-FR", {
                  timeZone: "Europe/Paris",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={b.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      background: "#fafbfc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                      <div
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "6px 10px",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: "#0f172a",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {startTime} - {endTime}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#0f172a" }}>
                          {b.first_name} {b.last_name}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          {b.vehicle_label} · {b.instructor_name ?? b.companion_name ?? "Personnel"} · {b.minutes / 60}h
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: b.status === "completed" ? "#d1fae5" : "#ffedd5",
                          color: b.status === "completed" ? "#065f46" : "#9a3412",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {b.status === "completed" ? "Réalisée" : "Confirmée"}
                      </span>

                      <button
                        type="button"
                        onClick={() => router.push(`/clients/${b.client_id}`)}
                        title="Consulter le dossier élève"
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "6px",
                          border: "1px solid #e2e8f0",
                          background: "#ffffff",
                          display: "grid",
                          placeItems: "center",
                          color: "#475569",
                        }}
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Nouveautés du CRM */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Sparkles size={18} style={{ color: "#ea580c" }} />
            <div>
              <span className="eyebrow">JOURNAL DES MISES À JOUR</span>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "2px 0 0" }}>
                Nouveautés du CRM
              </h2>
            </div>
          </div>
          <p style={{ fontSize: "12.5px", color: "#64748b", margin: "0 0 16px" }}>
            Améliorations réellement livrées et actives sur l&apos;application.
          </p>

          <div className="changelogTimeline">
            {changelog.map((item, idx) => (
              <div key={idx} className="changelogItem">
                <span className="changelogBadge">{item.badge}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="changelogDate">{item.date}</div>
                  <div className="changelogTitle">{item.title}</div>
                  <div className="changelogDesc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
