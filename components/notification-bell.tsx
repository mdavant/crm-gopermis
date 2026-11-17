"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  CalendarDays,
  FileCheck2,
  Car,
  X,
} from "lucide-react";

import { useApp } from "./app-context";

interface NotificationItem {
  id: string;
  category: "planning" | "dossier" | "vehicule";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "1",
    category: "planning",
    title: "Séances du jour",
    message: "Planning opérationnel actif pour les leçons de conduite de la journée.",
    time: "Il y a 10 min",
    read: false,
  },
  {
    id: "2",
    category: "dossier",
    title: "Dossier élève mis à jour",
    message: "Prestation validée et volume d'heures calculé selon la grille officielle.",
    time: "Il y a 1h",
    read: false,
  },
  {
    id: "3",
    category: "vehicule",
    title: "Flotte automobile",
    message: "Véhicules double commande Clio et RS3 prêts pour les leçons.",
    time: "Il y a 2h",
    read: false,
  },
];

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState<"all" | "planning" | "dossier" | "vehicule">("all");
  const popoverRef = useRef<HTMLDivElement>(null);
  const { theme } = useApp();
  const isDark = theme === "dark";

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const toggleItemRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filtered = notifications.filter(
    (n) => filter === "all" || n.category === filter
  );

  return (
    <div style={{ position: "relative" }} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Notifications et alertes"
        title="Notifications et alertes"
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "11px",
          border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
          background: open
            ? (isDark ? "#1e293b" : "#eff6ff")
            : (isDark ? "#131d31" : "#ffffff"),
          color: open ? "#2563eb" : (isDark ? "#cbd5e1" : "#475569"),
          display: "grid",
          placeItems: "center",
          position: "relative",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
        className="notifBellBtn"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-3px",
              right: "-3px",
              background: "#2563eb",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 800,
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 2px 4px rgba(37, 99, 235, 0.4)",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Floating Dropdown Popover */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "360px",
            maxWidth: "90vw",
            background: isDark ? "#0f172a" : "#ffffff",
            border: isDark ? "1px solid #1e293b" : "1px solid #e2e8f0",
            borderRadius: "18px",
            boxShadow: isDark ? "0 20px 40px rgba(0,0,0,0.6)" : "0 20px 40px rgba(0,0,0,0.18)",
            zIndex: 100,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
          className="notifPopover"
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: isDark ? "1px solid #1e293b" : "1px solid #f1f5f9",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Bell size={16} style={{ color: "#2563eb" }} />
              <strong style={{ fontSize: "14px", color: isDark ? "#f8fafc" : "#0f172a" }}>Notifications</strong>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: isDark ? "rgba(37, 99, 235, 0.2)" : "#eff6ff",
                    color: "#2563eb",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: "10px",
                  }}
                >
                  {unreadCount} non lue(s)
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  title="Tout marquer comme lu"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#2563eb",
                    fontSize: "11px",
                    fontWeight: 650,
                    cursor: "pointer",
                    padding: "4px 6px",
                    borderRadius: "6px",
                  }}
                >
                  Tout lire
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: isDark ? "#cbd5e1" : "#94a3b8",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              padding: "8px 12px",
              background: isDark ? "#131d31" : "#f8fafc",
              borderBottom: isDark ? "1px solid #1e293b" : "1px solid #f1f5f9",
            }}
          >
            {[
              { id: "all", label: "Toutes" },
              { id: "planning", label: "Planning" },
              { id: "dossier", label: "Dossiers" },
              { id: "vehicule", label: "Véhicules" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id as "all" | "planning" | "dossier" | "vehicule")}
                style={{
                  flex: 1,
                  height: "26px",
                  borderRadius: "6px",
                  border: "none",
                  background: filter === f.id
                    ? (isDark ? "#1e293b" : "#ffffff")
                    : "transparent",
                  color: filter === f.id
                    ? (isDark ? "#f8fafc" : "#0f172a")
                    : (isDark ? "#94a3b8" : "#64748b"),
                  fontSize: "11px",
                  fontWeight: filter === f.id ? 700 : 500,
                  boxShadow: filter === f.id
                    ? (isDark ? "0 1px 3px rgba(0,0,0,0.5)" : "0 1px 2px rgba(0,0,0,0.06)")
                    : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Notification Items List */}
          <div style={{ maxHeight: "320px", overflowY: "auto", padding: "6px" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", color: isDark ? "#64748b" : "#94a3b8", fontSize: "12.5px" }}>
                Aucune notification pour le moment.
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleItemRead(item.id)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    marginBottom: "4px",
                    background: item.read
                      ? "transparent"
                      : (isDark ? "#131d31" : "#f8fafc"),
                    border: item.read
                      ? "1px solid transparent"
                      : (isDark ? "1px solid #1e293b" : "1px solid #f1f5f9"),
                    cursor: "pointer",
                    display: "flex",
                    gap: "10px",
                    transition: "all 0.12s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "#1e293b" : "#f1f5f9")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = item.read
                      ? "transparent"
                      : (isDark ? "#131d31" : "#f8fafc"))
                  }
                >
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      background:
                        item.category === "planning"
                          ? (isDark ? "#1e293b" : "#dbeafe")
                          : item.category === "dossier"
                          ? (isDark ? "#2a2216" : "#fef3c7")
                          : (isDark ? "#261d36" : "#f3e8ff"),
                      color:
                        item.category === "planning"
                          ? (isDark ? "#60a5fa" : "#2563eb")
                          : item.category === "dossier"
                          ? (isDark ? "#fbbf24" : "#d97706")
                          : (isDark ? "#c084fc" : "#9333ea"),
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {item.category === "planning" && <CalendarDays size={15} />}
                    {item.category === "dossier" && <FileCheck2 size={15} />}
                    {item.category === "vehicule" && <Car size={15} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <strong
                        style={{
                          fontSize: "12.5px",
                          color: isDark ? "#f8fafc" : "#0f172a",
                          fontWeight: item.read ? 600 : 750,
                        }}
                      >
                        {item.title}
                      </strong>
                      <span style={{ fontSize: "10.5px", color: isDark ? "#94a3b8" : "#94a3b8" }}>{item.time}</span>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: isDark ? "#94a3b8" : "#64748b", lineHeight: 1.35 }}>
                      {item.message}
                    </p>
                  </div>

                  {!item.read && (
                    <div
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "#2563eb",
                        alignSelf: "center",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
