"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Car,
  User,
  Clock,
  CheckCircle2,
  ExternalLink,
  Check,
} from "lucide-react";
import { api, type Booking, type Resources } from "../lib/api-types";
import { useApp } from "./app-context";
import { Modal } from "./modal";

const START_HOUR = 8;
const END_HOUR = 20;
const TOTAL_HOURS = END_HOUR - START_HOUR; // 12 hours: 08:00 to 20:00
const HOUR_HEIGHT = 64; // px per hour

function getParisDateString(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

function parseParisDate(isoString: string): { hours: number; minutes: number; dayString: string } {
  const d = new Date(isoString);
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  let hours = 0;
  let minutes = 0;
  for (const p of parts) {
    if (p.type === "hour") hours = parseInt(p.value, 10);
    if (p.type === "minute") minutes = parseInt(p.value, 10);
  }
  const dayString = d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  return { hours, minutes, dayString };
}

function getMondayOfCurrentWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function CalendarGrid() {
  const { can, setNewBookingOpen } = useApp();
  const router = useRouter();

  // Navigation state
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [miniCalMonth, setMiniCalMonth] = useState<Date>(() => new Date());

  // Filter state
  const [selectedVehicles, setSelectedVehicles] = useState<Record<string, boolean>>({});
  const [selectedInstructors, setSelectedInstructors] = useState<Record<string, boolean>>({});
  const [selectedStatus, setSelectedStatus] = useState<Record<string, boolean>>({
    confirmed: true,
    completed: true,
  });

  // Data state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [resources, setResources] = useState<Resources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const todayParis = useMemo(() => getParisDateString(new Date()), []);

  // Compute week days
  const weekDays = useMemo(() => {
    if (viewMode === "day") {
      return [new Date(currentDate)];
    }
    const monday = getMondayOfCurrentWeek(currentDate);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate, viewMode]);

  // Compute start and end ISO dates for the query
  const queryRange = useMemo(() => {
    if (viewMode === "day") {
      const dStr = getParisDateString(currentDate);
      return { startDate: dStr, endDate: dStr };
    } else {
      const monday = weekDays[0];
      const sunday = weekDays[6];
      return {
        startDate: getParisDateString(monday),
        endDate: getParisDateString(sunday),
      };
    }
  }, [currentDate, viewMode, weekDays]);

  // Load resources once
  useEffect(() => {
    api<Resources>("resources")
      .then((res) => {
        setResources(res);
        const vMap: Record<string, boolean> = {};
        res.vehicles.forEach((v) => (vMap[v.id] = true));
        setSelectedVehicles(vMap);

        const iMap: Record<string, boolean> = {};
        res.instructors.forEach((i) => (iMap[i.id] = true));
        iMap["unassigned"] = true;
        setSelectedInstructors(iMap);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Fetch bookings whenever the date range changes
  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const b = await api<Booking[]>(
        `bookings?startDate=${queryRange.startDate}&endDate=${queryRange.endDate}`
      );
      setBookings(b);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [queryRange]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Mini-calendar generation
  const miniCalDays = useMemo(() => {
    const year = miniCalMonth.getFullYear();
    const month = miniCalMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Days from prev month
    let startDayOfWeek = firstDay.getDay() - 1; // 0=Mon, 6=Sun
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    for (let i = startDayOfWeek; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      days.push({ date: d, isCurrentMonth: false, key: `prev-${d.toISOString()}` });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, key: `curr-${i}` });
    }

    // Days from next month to fill grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, key: `next-${i}` });
    }

    return days;
  }, [miniCalMonth]);

  // Navigate dates
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === "week") {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === "week") {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setMiniCalMonth(now);
  };

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Vehicle filter
      if (b.vehicle_id && selectedVehicles[b.vehicle_id] === false) return false;
      // Instructor filter
      if (b.instructor_id && selectedInstructors[b.instructor_id] === false) return false;
      if (!b.instructor_id && selectedInstructors["unassigned"] === false) return false;
      // Status filter
      if (selectedStatus[b.status] === false) return false;
      return true;
    });
  }, [bookings, selectedVehicles, selectedInstructors, selectedStatus]);

  // Header period title
  const periodLabel = useMemo(() => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } else {
      const start = weekDays[0];
      const end = weekDays[6];
      const startMonth = start.toLocaleDateString("fr-FR", { month: "short" });
      const endMonth = end.toLocaleDateString("fr-FR", { month: "short" });
      const year = end.getFullYear();
      if (startMonth === endMonth) {
        return `${start.getDate()} — ${end.getDate()} ${startMonth} ${year}`;
      }
      return `${start.getDate()} ${startMonth} — ${end.getDate()} ${endMonth} ${year}`;
    }
  }, [currentDate, viewMode, weekDays]);

  // Complete a booking action
  const handleCompleteBooking = async (booking: Booking) => {
    if (!window.confirm(`Confirmer la réalisation de cette séance et décompter ${booking.minutes / 60}h ?`)) {
      return;
    }
    setActionBusy(true);
    setActionMessage("");
    setError("");
    try {
      await api(`bookings/${booking.id}/complete`, {});
      setActionMessage("Séance marquée réalisée avec succès. Solde d'heures débité.");
      setSelectedBooking(null);
      await loadBookings();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="planningContainer">
      {/* DUAL SIDEBAR: Mini Calendar & Quick Filters */}
      <aside className="planningDualSidebar">
        {/* Mini Calendar */}
        <div className="miniCalWidget">
          <div className="miniCalHeader">
            <span className="miniCalTitle">
              {miniCalMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </span>
            <div className="miniCalNavBtns">
              <button
                type="button"
                onClick={() => setMiniCalMonth(new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() - 1, 1))}
                aria-label="Mois précédent"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setMiniCalMonth(new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() + 1, 1))}
                aria-label="Mois suivant"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="miniCalGrid">
            {["L", "M", "M", "J", "V", "S", "D"].map((dayName, idx) => (
              <span key={idx} className="miniCalDayName">
                {dayName}
              </span>
            ))}
            {miniCalDays.map((item) => {
              const dayStr = getParisDateString(item.date);
              const isToday = dayStr === todayParis;
              const isSelected = dayStr === getParisDateString(currentDate);

              return (
                <button
                  key={item.key}
                  type="button"
                  className={`miniCalDayBtn ${!item.isCurrentMonth ? "dimmed" : ""} ${isToday ? "today" : ""} ${
                    isSelected ? "selected" : ""
                  }`}
                  onClick={() => {
                    setCurrentDate(item.date);
                  }}
                >
                  {item.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Vehicle Filters */}
        <div>
          <div className="filterSectionTitle">
            <span>Véhicules</span>
            <Car size={13} />
          </div>
          <div className="filterList">
            {resources?.vehicles.map((v, i) => {
              const colors = ["#ea580c", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#f59e0b"];
              const dotColor = colors[i % colors.length];
              return (
                <label key={v.id} className="filterItem">
                  <input
                    type="checkbox"
                    checked={selectedVehicles[v.id] !== false}
                    onChange={(e) =>
                      setSelectedVehicles((prev) => ({ ...prev, [v.id]: e.target.checked }))
                    }
                  />
                  <span className="filterDot" style={{ backgroundColor: dotColor }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Instructor Filters */}
        <div>
          <div className="filterSectionTitle">
            <span>Moniteurs</span>
            <User size={13} />
          </div>
          <div className="filterList">
            {resources?.instructors.map((inst) => (
              <label key={inst.id} className="filterItem">
                <input
                  type="checkbox"
                  checked={selectedInstructors[inst.id] !== false}
                  onChange={(e) =>
                    setSelectedInstructors((prev) => ({ ...prev, [inst.id]: e.target.checked }))
                  }
                />
                <span className="filterDot" style={{ backgroundColor: "#64748b" }} />
                <span>{inst.name}</span>
              </label>
            ))}
            <label className="filterItem">
              <input
                type="checkbox"
                checked={selectedInstructors["unassigned"] !== false}
                onChange={(e) =>
                  setSelectedInstructors((prev) => ({ ...prev, unassigned: e.target.checked }))
                }
              />
              <span className="filterDot" style={{ backgroundColor: "#94a3b8" }} />
              <span>Accompagnateur pers.</span>
            </label>
          </div>
        </div>

        {/* Status Filters */}
        <div>
          <div className="filterSectionTitle">
            <span>Statut</span>
            <CheckCircle2 size={13} />
          </div>
          <div className="filterList">
            <label className="filterItem">
              <input
                type="checkbox"
                checked={selectedStatus.confirmed !== false}
                onChange={(e) =>
                  setSelectedStatus((prev) => ({ ...prev, confirmed: e.target.checked }))
                }
              />
              <span className="filterDot" style={{ backgroundColor: "#ea580c" }} />
              <span>Confirmée</span>
            </label>
            <label className="filterItem">
              <input
                type="checkbox"
                checked={selectedStatus.completed !== false}
                onChange={(e) =>
                  setSelectedStatus((prev) => ({ ...prev, completed: e.target.checked }))
                }
              />
              <span className="filterDot" style={{ backgroundColor: "#10b981" }} />
              <span>Réalisée</span>
            </label>
          </div>
        </div>
      </aside>

      {/* MAIN PLANNING AREA */}
      <section className="planningMain">
        {/* Toolbar */}
        <div className="calendarToolbar">
          <div className="calendarNavGroup">
            <h2 className="calendarPeriodTitle">
              {periodLabel}
              {loading && <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500, marginLeft: "8px" }}>· actualisation…</span>}
            </h2>
            <div className="calendarNavControls">
              <button type="button" onClick={handlePrev} aria-label="Période précédente">
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={handleToday}>
                Aujourd’hui
              </button>
              <button type="button" onClick={handleNext} aria-label="Période suivante">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="calendarRightControls">
            {/* View Switcher: Semaine / Jour */}
            <div className="viewSwitcher">
              <button
                type="button"
                className={viewMode === "week" ? "active" : ""}
                onClick={() => setViewMode("week")}
              >
                Semaine
              </button>
              <button
                type="button"
                className={viewMode === "day" ? "active" : ""}
                onClick={() => setViewMode("day")}
              >
                Jour
              </button>
            </div>

            {/* "+ Nouvelle séance" Primary Action */}
            {can("schedule.write") && (
              <button
                type="button"
                className="btnPrimaryOrange"
                onClick={() => setNewBookingOpen(true)}
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Nouvelle séance</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ margin: "14px 22px 0" }}>
            <p className="error" role="alert">
              {error}
            </p>
          </div>
        )}

        {actionMessage && (
          <div style={{ margin: "14px 22px 0" }}>
            <p className="success" role="status">
              {actionMessage}
            </p>
          </div>
        )}

        {/* CALENDAR GRID STAGE */}
        <div className="calendarGridContainer">
          {/* Header row with day labels */}
          <div className="calendarHeaderRow">
            <div className="calendarTimeHeaderCorner">08-20h</div>
            <div className="calendarColumnsHeader">
              {weekDays.map((d) => {
                const dayStr = getParisDateString(d);
                const isToday = dayStr === todayParis;
                const dayName = d.toLocaleDateString("fr-FR", { weekday: "short" });
                return (
                  <div
                    key={dayStr}
                    className={`calendarDayHeaderCell ${isToday ? "isToday" : ""}`}
                  >
                    <span className="calendarDayName">{dayName}</span>
                    <span className="calendarDayNumber">{d.getDate()}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body: Time axis on left, columns for each day */}
          <div className="calendarBody">
            {/* Left time slots 08:00 to 20:00 */}
            <div className="calendarTimeAxis">
              {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
                const hour = START_HOUR + i;
                const formattedHour = `${hour < 10 ? "0" + hour : hour}:00`;
                return (
                  <div key={hour} className="calendarTimeSlotLabel">
                    {formattedHour}
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            <div className="calendarColumnsGrid">
              {weekDays.map((d) => {
                const dayStr = getParisDateString(d);
                const isToday = dayStr === todayParis;

                // Find all bookings for this day
                const dayBookings = filteredBookings.filter((b) => {
                  const parsed = parseParisDate(b.starts_at);
                  return parsed.dayString === dayStr;
                });

                return (
                  <div
                    key={dayStr}
                    className={`calendarDayColumnTrack ${isToday ? "isToday" : ""}`}
                  >
                    {/* Hour slot background lines */}
                    {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                      <div key={i} className="calendarHourSlotLine" />
                    ))}

                    {/* Render Booking Cards */}
                    {dayBookings.map((b) => {
                      const start = parseParisDate(b.starts_at);
                      const end = parseParisDate(b.ends_at);

                      // Calculate start minute from START_HOUR (8:00 = 480 min)
                      const startMinutesFromBase = (start.hours - START_HOUR) * 60 + start.minutes;
                      const durationMinutes = b.minutes;

                      // Clamp inside 08:00 - 20:00
                      const top = Math.max(0, (startMinutesFromBase / 60) * HOUR_HEIGHT);
                      const height = Math.max(26, (durationMinutes / 60) * HOUR_HEIGHT - 3);

                      const formattedStart = `${start.hours}h${start.minutes ? String(start.minutes).padStart(2, "0") : ""}`;
                      const formattedEnd = `${end.hours}h${end.minutes ? String(end.minutes).padStart(2, "0") : ""}`;

                      return (
                        <div
                          key={b.id}
                          className={`calendarEventCard status-${b.status}`}
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                          }}
                          onClick={() => setSelectedBooking(b)}
                          title={`${b.first_name} ${b.last_name} · ${b.vehicle_label}`}
                        >
                          <div className="calendarEventTitle">
                            {b.first_name} {b.last_name}
                          </div>
                          <div className="calendarEventMeta">
                            {b.vehicle_label} · {b.instructor_name ?? b.companion_name ?? "Personnel"}
                          </div>
                          <div className="calendarEventTimeBadge">
                            <Clock size={10} />
                            <span>
                              {formattedStart} - {formattedEnd} ({b.minutes / 60}h)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* SESSION INSPECTOR MODAL */}
      {selectedBooking && (
        <Modal
          title={`Séance de conduite · ${selectedBooking.first_name} ${selectedBooking.last_name}`}
          close={() => setSelectedBooking(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: selectedBooking.status === "completed" ? "#ecfdf5" : "#fff7ed",
                  color: selectedBooking.status === "completed" ? "#059669" : "#ea580c",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: "16px",
                }}
              >
                {selectedBooking.first_name[0]}
                {selectedBooking.last_name[0]}
              </div>
              <div>
                <strong style={{ fontSize: "16px", color: "#0f172a", display: "block" }}>
                  {selectedBooking.first_name} {selectedBooking.last_name}
                </strong>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "2px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    background: selectedBooking.status === "completed" ? "#d1fae5" : "#ffedd5",
                    color: selectedBooking.status === "completed" ? "#065f46" : "#9a3412",
                  }}
                >
                  {selectedBooking.status === "completed" ? "Réalisée" : "Confirmée"}
                </span>
              </div>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                fontSize: "13px",
              }}
            >
              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 600 }}>
                  HORAIRES (EUROPE/PARIS)
                </span>
                <strong>
                  {new Date(selectedBooking.starts_at).toLocaleTimeString("fr-FR", {
                    timeZone: "Europe/Paris",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  →{" "}
                  {new Date(selectedBooking.ends_at).toLocaleTimeString("fr-FR", {
                    timeZone: "Europe/Paris",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
                <span style={{ display: "block", color: "#64748b", fontSize: "11px", marginTop: "2px" }}>
                  {new Date(selectedBooking.starts_at).toLocaleDateString("fr-FR", {
                    timeZone: "Europe/Paris",
                    dateStyle: "full",
                  })}
                </span>
              </div>

              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 600 }}>
                  DURÉE FACTURABLE
                </span>
                <strong>{selectedBooking.minutes / 60} heure(s)</strong>
                <span style={{ display: "block", color: "#64748b", fontSize: "11px", marginTop: "2px" }}>
                  {selectedBooking.minutes} minutes
                </span>
              </div>

              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 600 }}>
                  VÉHICULE D&apos;ENSEIGNEMENT
                </span>
                <strong>{selectedBooking.vehicle_label}</strong>
              </div>

              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 600 }}>
                  ENCADREMENT
                </span>
                <strong>
                  {selectedBooking.instructor_name ?? `Accompagnateur : ${selectedBooking.companion_name}`}
                </strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#0f172a",
                }}
                onClick={() => {
                  setSelectedBooking(null);
                  router.push(`/clients/${selectedBooking.client_id}`);
                }}
              >
                <ExternalLink size={15} />
                Consulter la fiche client
              </button>

              {selectedBooking.status === "confirmed" && can("sessions.complete") && (
                <button
                  type="button"
                  disabled={actionBusy || new Date(selectedBooking.ends_at).getTime() > Date.now()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 16px",
                    borderRadius: "10px",
                    border: "0",
                    background: "#10b981",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                  onClick={() => handleCompleteBooking(selectedBooking)}
                >
                  <Check size={16} />
                  {actionBusy ? "Validation…" : "Marquer réalisée & décompter"}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
