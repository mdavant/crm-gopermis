"use client";
import React, { useState } from "react";
import {
  Bell,
  CalendarDays,
  Car,
  FileCheck2,
  Clock,
  Check,
} from "lucide-react";

interface NotificationItem {
  id: string;
  category: "planning" | "dossier" | "vehicule";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export function NotificationsView() {
  const [filter, setFilter] = useState<"all" | "planning" | "dossier" | "vehicule">("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const filtered = notifications.filter(
    (n) => filter === "all" || n.category === filter
  );

  return (
    <div className="notificationsWorkspace">
      <div className="notificationsHeader">
        <div>
          <span className="profileEyebrow">COMMUNICATION & ALERTES</span>
          <h1 className="notificationsTitle">Notifications</h1>
          <p className="notificationsSubtitle">Suivi des séances, pièces des dossiers élèves et gestion des véhicules.</p>
        </div>

        <button type="button" className="btnSmallGray" onClick={markAllRead}>
          <Check size={14} /> Tout marquer comme lu
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="notifTabsRow">
        <button
          type="button"
          className={`notifTabBtn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          Toutes ({notifications.length})
        </button>
        <button
          type="button"
          className={`notifTabBtn ${filter === "planning" ? "active" : ""}`}
          onClick={() => setFilter("planning")}
        >
          Planning
        </button>
        <button
          type="button"
          className={`notifTabBtn ${filter === "dossier" ? "active" : ""}`}
          onClick={() => setFilter("dossier")}
        >
          Dossiers élèves
        </button>
        <button
          type="button"
          className={`notifTabBtn ${filter === "vehicule" ? "active" : ""}`}
          onClick={() => setFilter("vehicule")}
        >
          Véhicules
        </button>
      </div>

      {/* Notifications List */}
      <div className="notifListContainer">
        {filtered.length === 0 ? (
          <div className="emptyNotifBox">
            <Bell size={32} />
            <p>Aucune notification pour cette catégorie.</p>
          </div>
        ) : (
          filtered.map((n) => (
            <div key={n.id} className={`notifCard ${n.read ? "read" : "unread"}`}>
              <div
                className={`notifIconBox ${
                  n.category === "planning"
                    ? "blue"
                    : n.category === "dossier"
                    ? "amber"
                    : "purple"
                }`}
              >
                {n.category === "planning" && <CalendarDays size={18} />}
                {n.category === "dossier" && <FileCheck2 size={18} />}
                {n.category === "vehicule" && <Car size={18} />}
              </div>

              <div className="notifContent">
                <div className="notifTitleRow">
                  <strong>{n.title}</strong>
                  <span className="notifTime">
                    <Clock size={12} /> {n.time}
                  </span>
                </div>
                <p className="notifText">{n.message}</p>
              </div>

              {!n.read && <div className="unreadDot" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
