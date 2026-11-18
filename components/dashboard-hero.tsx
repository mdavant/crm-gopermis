"use client";
import React, { useMemo } from "react";
import { CalendarDays, Plus } from "lucide-react";
import type { Booking, Resources } from "../lib/api-types";

/** Lundi 00:00 de la semaine de `d`. */
function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

const ORBIT_COLORS = ["#f59e0b", "#34d399", "#8b5cf6", "#38bdf8", "#f472b6", "#a3e635"];
// Heures ouvrées par véhicule et par semaine (6 jours × 11 h).
const WEEKLY_HOURS_PER_VEHICLE = 66;

export function DashboardHero({
  bookings,
  resources,
  onPlan,
  onNewClient,
}: {
  bookings: Booking[];
  resources: Resources | null;
  onPlan: () => void;
  onNewClient: () => void;
}) {
  const stats = useMemo(() => {
    const from = startOfWeek(new Date());
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    const week = bookings.filter((b) => {
      const t = new Date(b.starts_at).getTime();
      return t >= from.getTime() && t < to.getTime();
    });
    const hours = week.reduce((sum, b) => sum + (b.minutes || 0), 0) / 60;
    const done = week.filter((b) => b.status === "completed").length;
    const vehicles = resources?.vehicles.filter((v) => v.active).length ?? 0;
    const capacity = vehicles * WEEKLY_HOURS_PER_VEHICLE;
    const occupancy = capacity > 0 ? Math.min(100, Math.round((hours / capacity) * 100)) : 0;
    const seen = new Map<string, string>();
    for (const b of week) {
      if (!seen.has(b.client_id)) seen.set(b.client_id, `${b.first_name?.[0] ?? ""}${b.last_name?.[0] ?? ""}`.toUpperCase());
    }
    return {
      sessions: week.length,
      hours: Math.round(hours * 10) / 10,
      done,
      completion: week.length ? Math.round((done / week.length) * 100) : 0,
      occupancy,
      students: [...seen.values()].slice(0, 6),
    };
  }, [bookings, resources]);

  const mood =
    stats.occupancy >= 60
      ? { lead: "Votre auto-école tourne à", accent: "plein régime", tail: "cette semaine" }
      : stats.occupancy >= 25
        ? { lead: "Votre auto-école trouve", accent: "son rythme", tail: "cette semaine" }
        : { lead: "Il reste de", accent: "belles disponibilités", tail: "cette semaine" };

  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <section className="dashHero" aria-label="Résumé de la semaine">
      <div className="dashHeroText">
        <span className="dashHeroTag">
          <span className="dashHeroDot" /> Semaine en cours
        </span>
        <h2 className="dashHeroTitle">
          {mood.lead} <span className="serifAccent">{mood.accent}</span> {mood.tail}
        </h2>
        <p className="dashHeroSub">
          {stats.sessions} séance{stats.sessions > 1 ? "s" : ""} planifiée{stats.sessions > 1 ? "s" : ""} pour{" "}
          {stats.hours} h de conduite.
        </p>
        <div className="dashHeroStats">
          <div>
            <strong>{stats.sessions}</strong>
            <span>Séances</span>
          </div>
          <div>
            <strong>{stats.hours} h</strong>
            <span>Conduite</span>
          </div>
          <div>
            <strong>{stats.completion} %</strong>
            <span>Réalisées</span>
          </div>
        </div>
        <div className="dashHeroActions">
          <button type="button" className="dashHeroBtn solid" onClick={onPlan}>
            <CalendarDays size={15} /> Voir le planning
          </button>
          <button type="button" className="dashHeroBtn ghost" onClick={onNewClient}>
            <Plus size={15} /> Ajouter un élève
          </button>
        </div>
      </div>

      <div className="dashHeroOrbit" aria-label={`Occupation de la flotte : ${stats.occupancy} %`}>
        <svg viewBox="0 0 120 120" className="dashHeroRing">
          <circle cx="60" cy="60" r={R} className="ringTrack" />
          <circle
            cx="60"
            cy="60"
            r={R}
            className="ringValue"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - stats.occupancy / 100)}
          />
        </svg>
        <div className="dashHeroRingLabel">
          <strong>{stats.occupancy} %</strong>
          <span>Flotte</span>
        </div>
        {stats.students.map((initials, i) => {
          const angle = (i / Math.max(stats.students.length, 1)) * 2 * Math.PI - Math.PI / 2;
          return (
            <span
              key={i}
              className="orbitBubble"
              style={{
                left: `calc(50% + ${Math.cos(angle) * 92}px)`,
                top: `calc(50% + ${Math.sin(angle) * 92}px)`,
                background: ORBIT_COLORS[i % ORBIT_COLORS.length],
                animationDelay: `${i * 0.4}s`,
              }}
            >
              {initials || "•"}
            </span>
          );
        })}
      </div>
    </section>
  );
}

/** Mini-courbe (séances par jour sur les 7 derniers jours). */
export function Sparkline({ values, color = "var(--acc)" }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  const w = 96;
  const h = 32;
  const pts = values.map((v, i) => [(i / Math.max(values.length - 1, 1)) * w, h - 3 - (v / max) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const id = React.useId().replace(/:/g, "");
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <defs>
        <linearGradient id={`sg${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#sg${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function dailyCounts(bookings: Booking[], days = 7) {
  const out: number[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(bookings.filter((b) => new Date(b.starts_at).toDateString() === d.toDateString()).length);
  }
  return out;
}
