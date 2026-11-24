"use client";
import React from "react";
import {
  Users,
  CalendarDays,
  Car,
  Clock,
  ArrowRight,
  Plus,
  FileCheck2,
  AlertTriangle,
  UserCheck,
  Sparkles,
  HardDrive,
  ShieldCheck,
} from "lucide-react";
import type { Booking, ClientRecord, Resources, User, HomeStats } from "../lib/api-types";

import { DashboardHero, Sparkline, dailyCounts } from "./dashboard-hero";
import { CommandPaletteTrigger } from "./command-palette";

interface DashboardProps {
  user: User;
  summary:HomeStats|null;
  clients: ClientRecord[];
  bookings: Booking[];
  resources: Resources | null;
  onNavigate: (view: string) => void;
  onNewClient: () => void;
  onNewBooking: () => void;
}

export function Dashboard({
  user,
  summary,
  clients,
  bookings,
  resources,
  onNavigate,
  onNewClient,
  onNewBooking,
}: DashboardProps) {
  const isAdmin =
    user.permissions?.includes("admin.full") ||
    user.permissions?.includes("technical_admin") ||
    user.roles?.includes("technical_admin") ||
    user.roles?.includes("admin");

  const todayStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const capitalizedToday = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

  // Filter today's bookings
  const todayBookings = bookings.filter((b) => {
    const bDate = new Date(b.starts_at);
    const now = new Date();
    return (
      bDate.getDate() === now.getDate() &&
      bDate.getMonth() === now.getMonth() &&
      bDate.getFullYear() === now.getFullYear()
    );
  });

  const activeVehicles = resources?.vehicles.filter((v) => v.active).length ?? 0;
  const activeInstructors = resources?.instructors.filter((i) => i.active).length ?? 0;

  return (
    <div className="dashboardWorkspace">
      {/* Top Header */}
      <div className="dashboardHeader">
        <div>
          <span className="dashGreeting">Bonjour, {user.name}</span>
          <h1 className="dashTitle">Tableau de bord</h1>
          <p className="dashSubtitle">{capitalizedToday} · Vue d&apos;ensemble de l&apos;auto-école</p>
        </div>

        <div className="dashHeaderActions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <CommandPaletteTrigger />
          {isAdmin && (
            <button
              type="button"
              className="btnAdminPanel"
              onClick={() => onNavigate("AdminPanel")}
              style={{
                height: "38px",
                padding: "0 15px",
                borderRadius: "10px",
                border: "1px solid var(--acc)",
                background: "var(--acc-soft)",
                color: "var(--acc)",
                fontSize: "12.5px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                cursor: "pointer",

                transition: "all 0.15s ease",
              }}
            >
              <ShieldCheck size={16} />
              <span>Panel Admin</span>
            </button>
          )}
          <button type="button" className="btnSecondary" onClick={() => onNavigate("Drive")}>
            <HardDrive size={16} />
            <span>Drive</span>
          </button>
          <button type="button" className="btnSecondary" onClick={onNewClient}>
            <Plus size={16} />
            <span>Nouveau client</span>
          </button>
          <button
            type="button"
            className="btnPrimary"
            onClick={onNewBooking}

          >
            <CalendarDays size={16} />
            <span>Planifier</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 2 columns (Left Metrics & Alerts, Right Today Schedule) */}
      <div className="dashMainGrid">
        {/* Left Column: KPI cards & Priorities */}
        <div className="dashLeftColumn">
          <DashboardHero
            bookings={bookings}
            resources={resources}
            onPlan={() => onNavigate("Planning")}
            onNewClient={onNewClient}
          />

          {/* 4 Quick Stat Cards */}
          <div className="kpiGrid">
            <div className="kpiCard" onClick={() => onNavigate("Clients")}>
              <div className="kpiIconWrap blue" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
                <Users size={20} />
              </div>
              <div className="kpiContent">
                <span className="kpiLabel">Élèves enregistrés</span>
                <strong className="kpiValue">{summary?.totalClients ?? "—"}</strong>
                <span className="kpiHint" style={{ color: "var(--acc)", fontWeight: 700 }}>Gérer les dossiers &gt;</span>
              </div>
            </div>

            <div className="kpiCard kpiFeatured" onClick={() => onNavigate("Planning")}>
              <div className="kpiIconWrap">
                <CalendarDays size={20} />
              </div>
              <div className="kpiContent">
                <span className="kpiLabel">Séances aujourd&apos;hui</span>
                <strong className="kpiValue">{summary?.todayBookingsCount ?? todayBookings.length}</strong>
                <span className="kpiHint">7 derniers jours</span>
              </div>
              <Sparkline values={dailyCounts(bookings)} color="#ffffff" />
            </div>

            <div className="kpiCard" onClick={() => onNavigate("Donnees")}>
              <div className="kpiIconWrap">
                <Car size={20} />
              </div>
              <div className="kpiContent">
                <span className="kpiLabel">Véhicules actifs</span>
                <strong className="kpiValue">{activeVehicles}</strong>
                <span className="kpiHint">Clio & RS3 disponibles</span>
              </div>
            </div>

            <div className="kpiCard" onClick={() => onNavigate("Donnees")}>
              <div className="kpiIconWrap" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
                <UserCheck size={20} />
              </div>
              <div className="kpiContent">
                <span className="kpiLabel">Moniteurs équipe</span>
                <strong className="kpiValue">{activeInstructors}</strong>
                <span className="kpiHint" style={{ color: "var(--acc)", fontWeight: 700 }}>Planning disponible</span>
              </div>
            </div>
          </div>

          {/* Dossiers & Actions Requises */}
          <div className="dashSectionCard">
            <div className="sectionCardHeader">
              <div className="sectionTitleWithBadge">
                <h3 className="sectionCardTitle">Actions & Alertes prioritaires</h3>
                <span className="badgeNeutral">Raccourcis</span>
              </div>
            </div>

            <div className="priorityActionsList">
              <div className="priorityActionItem">
                <div className="priorityIconBox" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
                  <AlertTriangle size={18} />
                </div>
                <div className="priorityContent">
                  <strong>Compléter les dossiers élèves</strong>
                  <p>Consultez les fiches clients et leurs prestations.</p>
                </div>
                <button
                  type="button"
                  className="btnSmallGray"
                  style={{ color: "var(--acc)", fontWeight: 700 }}
                  onClick={() => onNavigate("Clients")}
                >
                  Voir
                </button>
              </div>

              <div className="priorityActionItem">
                <div className="priorityIconBox" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
                  <FileCheck2 size={18} />
                </div>
                <div className="priorityContent">
                  <strong>Validation des heures conduites</strong>
                  <p>Pensez à marquer réalisées les séances terminées pour actualiser le journal d&apos;heures.</p>
                </div>
                <button
                  type="button"
                  className="btnSmallGray"
                  style={{ color: "var(--acc)", fontWeight: 700 }}
                  onClick={() => onNavigate("Planning")}
                >
                  Ouvrir
                </button>
              </div>

              <div className="priorityActionItem">
                <div className="priorityIconBox" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
                  <Sparkles size={18} />
                </div>
                <div className="priorityContent">
                  <strong>Contrôle de disponibilité flotte</strong>
                  <p>Consultez les véhicules et leurs indisponibilités avant de réserver.</p>
                </div>
                <button
                  type="button"
                  className="btnSmallGray"
                  style={{ color: "var(--acc)", fontWeight: 700 }}
                  onClick={() => onNavigate("Donnees")}
                >
                  Gérer
                </button>
              </div>
            </div>
          </div>

          {/* Derniers élèves ou accès rapide */}
          <div className="dashSectionCard">
            <div className="sectionCardHeader">
              <h3 className="sectionCardTitle">Derniers élèves enregistrés</h3>
              <button
                type="button"
                className="linkButton"
                onClick={() => onNavigate("Clients")}
              >
                Tous les élèves <ArrowRight size={14} />
              </button>
            </div>

            {clients.length === 0 ? (
              <div className="emptyDashBox">
                <Users size={32} />
                <p>Aucun élève enregistré pour le moment.</p>
                <button type="button" className="btnSmallGray" onClick={onNewClient}>
                  + Créer le premier élève
                </button>
              </div>
            ) : (
              <div className="recentClientsList">
                {clients.slice(0, 4).map((c) => (
                  <div key={c.id} className="recentClientRow">
                    <div className="clientMiniAvatar">
                      {c.first_name[0]}
                      {c.last_name[0]}
                    </div>
                    <div className="clientMiniMeta">
                      <strong>
                        {c.first_name} {c.last_name}
                      </strong>
                      <span>{c.phone}</span>
                    </div>
                    <span className="clientMiniStatus">{c.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Planning Aujourd'hui matching the aesthetic */}
        <div className="dashRightColumn">
          <div className="todayScheduleCard">
            <div className="todayScheduleHeader">
              <div>
                <h3 className="scheduleCardTitle">Planning d&apos;aujourd&apos;hui</h3>
                <span className="scheduleCardSubtitle">
                  {todayBookings.length} séance{todayBookings.length > 1 ? "s" : ""} programmée{todayBookings.length > 1 ? "s" : ""}
                </span>
              </div>
              <button
                type="button"
                className="btnSmallGray"
                onClick={() => onNavigate("Planning")}
              >
                Vue calendrier
              </button>
            </div>

            <div className="todayBookingsList">
              {todayBookings.length === 0 ? (
                <div className="emptyTodaySchedule">
                  <div className="emptyCalIcon">
                    <CalendarDays size={28} />
                  </div>
                  <strong>Aucune séance aujourd&apos;hui</strong>
                  <p>Votre emploi du temps est libre pour cette journée.</p>
                  <button
                    type="button"
                    className="btnPrimarySmall"
                    onClick={onNewBooking}
                  >
                    + Programmer un cours
                  </button>
                </div>
              ) : (
                todayBookings.map((b) => {
                  const startH = new Date(b.starts_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const endH = new Date(b.ends_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div key={b.id} className="todayBookingItem">
                      <div className="bookingTimeCol">
                        <Clock size={13} />
                        <span>
                          {startH} - {endH}
                        </span>
                      </div>
                      <div className="bookingItemCard">
                        <div className="bookingStudentRow">
                          <strong>
                            {b.first_name} {b.last_name}
                          </strong>
                          <span
                            className={`bookingStatusTag ${
                              b.status === "completed" ? "completed" : "confirmed"
                            }`}
                          >
                            {b.status === "completed" ? "Réalisée" : "Confirmée"}
                          </span>
                        </div>
                        <div className="bookingDetailsRow">
                          <span>🚗 {b.vehicle_label}</span>
                          <span>
                            👤 {b.instructor_name || (b.companion_name ? `Accompagnateur : ${b.companion_name}` : "Accompagnateur personnel")}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick access to Tarifs & Offres */}
            <div className="todayOfferTeaser">
              <div className="offerTeaserText">
                <strong>Tarifs & Formules GoPermis</strong>
                <p>Clio Manuelle, Automatique et Audi RS3 Sportback.</p>
              </div>
              <button
                type="button"
                className="btnSmallGray"
                onClick={() => onNavigate("Tarifs & offres")}
              >
                Consulter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
