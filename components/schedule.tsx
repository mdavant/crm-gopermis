"use client";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  api,
  type Booking,
  type Resources,
  type Detail,
  type ClientRecord,
} from "../lib/api-types";
import { Modal } from "./modal";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Car,
  User,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  FileSignature,
} from "lucide-react";

export const displayDate = (value: string) =>
  new Date(value).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });

export function localInstant(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  const date = new Date(text);
  const parts = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (
    !parts ||
    !Number.isFinite(date.getTime()) ||
    [
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
    ].some((n, i) => n !== Number(parts[i + 1]))
  )
    throw new Error("Horaire local invalide, notamment au changement d’heure.");
  return date.toISOString();
}

export function IntervalFields() {
  return (
    <div className="formGrid">
      <label>
        Début
        <input type="datetime-local" name="startsAt" required step="60" />
      </label>
      <label>
        Fin
        <input type="datetime-local" name="endsAt" required step="60" />
      </label>
    </div>
  );
}

const INSTRUCTOR_FALLBACK_COLORS = ["#e5484d", "#8e4ec6", "#12a594", "#3e7bfa", "#d6409f", "#e8833a", "#65a30d"];

// Heure affichée dans la grille (08:00, 09:00…)
function formatHourAMPM(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

const timeFr = (value: string) =>
  new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Heure courante, rafraîchie chaque minute (ligne rouge « maintenant »). */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function NowLine({ now }: { now: Date }) {
  return (
    <div className="nowLine" style={{ top: `${(now.getMinutes() / 60) * 100}%` }} aria-hidden="true">
      <span className="nowPill">
        {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

export function Schedule({
  can,
  detail,
  reload,
  selectedDate,
  onDateChange,
  activeFilters,
}: {
  can: (p: string) => boolean;
  detail?: Detail;
  reload?: () => Promise<void>;
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  activeFilters?: string[];
}) {
  const now = useNow();
  const [rows, setRows] = useState<Booking[]>([]);
  const [resources, setResources] = useState<Resources | null>(null);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // View mode: "Day", "Week", "Month"
  const [calendarView, setCalendarView] = useState<"Day" | "Week" | "Month">("Week");

  // Current anchor date (defaults to selectedDate or today)
  const [currentDate, setCurrentDate] = useState<Date>(selectedDate ?? new Date());

  useEffect(() => {
    if (selectedDate) {
      setCurrentDate(selectedDate);
    }
  }, [selectedDate]);

  // Modal states
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [prefilledSlot, setPrefilledSlot] = useState<{ date: string; hour: number } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>(detail?.client.id ?? "");
  const [clientDetailData, setClientDetailData] = useState<Detail | null>(detail ?? null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  // Formula wizard states in Booking modal
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedSupport, setSelectedSupport] = useState<"GoPermis" | "Personnel">("GoPermis");

  const refresh = useCallback(async () => {
    try {
      const [b, r, cList] = await Promise.all([
        api<Booking[]>("bookings" + (detail ? "?clientId=" + detail.client.id : "")),
        api<Resources>("resources"),
        api<ClientRecord[]>("clients").catch(() => []),
      ]);
      setRows(b);
      setResources(r);
      setClients(cList);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [detail]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // When client selection changes in modal, load their active services
  useEffect(() => {
    if (!selectedClientId) {
      setClientDetailData(null);
      setSelectedServiceId("");
      return;
    }
    if (detail && detail.client.id === selectedClientId) {
      setClientDetailData(detail);
      const active = detail.services.find((s) => s.status === "Active");
      if (active) setSelectedServiceId(active.id);
      return;
    }
    api<Detail>("clients/" + selectedClientId)
      .then((d) => {
        setClientDetailData(d);
        const active = d.services.find((s) => s.status === "Active");
        if (active) setSelectedServiceId(active.id);
      })
      .catch((e) => setError((e as Error).message));
  }, [selectedClientId, detail]);

  // Calculate days for the currently viewed week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Calculate days for Month view
  const monthDaysGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    let startDayOfWeek = firstDay.getDay() - 1; // Mon = 0
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean; dayNum: number }[] = [];
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      cells.push({ date: d, isCurrentMonth: false, dayNum: d.getDate() });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      cells.push({ date: d, isCurrentMonth: true, dayNum: i });
    }
    const remaining = 35 - cells.length > 0 ? 35 - cells.length : 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ date: d, isCurrentMonth: false, dayNum: i });
    }
    return cells;
  }, [currentDate]);

  // Navigation functions
  const navigatePrevious = () => {
    const d = new Date(currentDate);
    if (calendarView === "Day") {
      d.setDate(d.getDate() - 1);
    } else if (calendarView === "Month") {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    setCurrentDate(d);
    onDateChange?.(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (calendarView === "Day") {
      d.setDate(d.getDate() + 1);
    } else if (calendarView === "Month") {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    setCurrentDate(d);
    onDateChange?.(d);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    onDateChange?.(today);
  };

  // Hours displayed on the vertical axis (8 AM to 7 PM)
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  // Visual color palette for real bookings

  // Couleur d'une séance : examen pratique, sinon couleur du moniteur GoPermis,
  // sinon (pas de moniteur) couleur « accompagnateur personnel ».
  const planningColors = resources?.planningColors ?? { companion: "#0ea5e9", exam: "#f59e0b" };
  const instructorColor = (id: string | null) => {
    if (!id || !resources) return null;
    const list = resources.instructors;
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return null;
    return list[i].color || INSTRUCTOR_FALLBACK_COLORS[i % INSTRUCTOR_FALLBACK_COLORS.length];
  };
  const colorFor = (b: Booking) =>
    b.service_type === "exam"
      ? planningColors.exam
      : b.instructor_id
        ? instructorColor(b.instructor_id) || b.instructor_color || "#e5484d"
        : planningColors.companion;
  const paletteFor = (b: Booking) => {
    const c = colorFor(b);
    return {
      bg: `color-mix(in oklab, ${c} 18%, rgba(255,255,255,.6))`,
      border: c,
      text: `color-mix(in oklab, ${c} 62%, #1c1210)`,
      subtext: `color-mix(in oklab, ${c} 55%, #3b2a26)`,
      avatarBg: c,
      avatarText: "#ffffff",
    };
  };

  // Filtre « un seul moniteur / un seul véhicule »
  const [focus, setFocus] = useState("all");
  const matchesFocus = (b: Booking) =>
    focus === "all" ||
    (focus.startsWith("i:") && b.instructor_id === focus.slice(2)) ||
    (focus.startsWith("v:") && b.vehicle_id === focus.slice(2)) ||
    (focus === "companion" && !b.instructor_id && b.service_type !== "exam") ||
    (focus === "exam" && b.service_type === "exam");

  const activeBookings = (activeFilters ? rows.filter((b) => activeFilters.includes(b.status)) : rows).filter(matchesFocus);

  // Month and year display
  const monthName = currentDate.toLocaleString("fr-FR", { month: "long" });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const yearNumber = currentDate.getFullYear();

  // Find bookings for a specific day and hour
  const getBookingsForSlot = (day: Date, hour: number) => {
    return activeBookings.filter((b) => {
      const bDate = new Date(b.starts_at);
      const isSameDay =
        bDate.getDate() === day.getDate() &&
        bDate.getMonth() === day.getMonth() &&
        bDate.getFullYear() === day.getFullYear();
      return isSameDay && bDate.getHours() === hour;
    });
  };

  const getBookingsForDay = (day: Date) => {
    return activeBookings.filter((b) => {
      const bDate = new Date(b.starts_at);
      return (
        bDate.getDate() === day.getDate() &&
        bDate.getMonth() === day.getMonth() &&
        bDate.getFullYear() === day.getFullYear()
      );
    });
  };

  async function perform(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(success);
      setBookingModalOpen(false);
      setSelectedBooking(null);
      await refresh();
      await reload?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Open booking modal pre-filled with date and time
  const handleSlotClick = (day: Date, hour: number) => {
    const yyyy = day.getFullYear();
    const mm = String(day.getMonth() + 1).padStart(2, "0");
    const dd = String(day.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    setPrefilledSlot({ date: dateStr, hour });
    setBookingModalOpen(true);
  };

  // Filter vehicles according to selected formula
  const activeVehicles = useMemo(
    () => (resources ? resources.vehicles.filter((v) => v.active) : []),
    [resources],
  );
  const selectedVehicle = activeVehicles.find((v) => v.id === selectedVehicleId);
  // RS3 : accompagnement GoPermis uniquement.
  const personnelAllowed = selectedVehicle?.model_id !== "rs3";

  return (
    <div className="calendarWorkspace">
      {/* Top Header Bar matching reference image */}
      <div className="calendarTopBar">
        <div className="calendarBreadcrumb">
          <span>Planning</span>
          <span className="crumbSep">&gt;</span>
          <span className="crumbCurrent">Toutes les séances</span>
        </div>

        <div className="calendarTitleRow">
          <div>
            <h1 className="calendarMainTitle">Planning</h1>
            <div className="calendarDateBadgeRow">
              <div className="calendarMonthDropdown">
                <span>
                  {capitalizedMonth}, {yearNumber}
                </span>
                <button
                  type="button"
                  className="iconBtnSmall"
                  onClick={navigatePrevious}
                  aria-label="Précédent"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className="iconBtnSmall"
                  onClick={navigateNext}
                  aria-label="Suivant"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="todayNavBtn"
                  onClick={goToToday}
                  title="Revenir à aujourd'hui"
                >
                  Aujourd&apos;hui
                </button>
              </div>

              <div className="eventCountBadge">
                <CalendarDays size={15} />
                <span>{activeBookings.length} séances chargées</span>
              </div>
            </div>
          </div>

          <div className="calendarControlsRight">
            {/* Sync with Google Calendar button matching reference image */}
            <button
              type="button"
              className="syncGoogleBtn"
              disabled title="Intégration Google Calendar non configurée"
            >
              <div className="googleCalIcon">31</div>
              <span>Google Calendar non connecté</span>
            </button>

            {/* Afficher : tout le planning, un moniteur ou un véhicule */}
            <label className="planFocus">
              <span>Afficher</span>
              <select value={focus} onChange={(e) => setFocus(e.target.value)} aria-label="Filtrer le planning">
                <option value="all">Tout le planning</option>
                {resources && resources.instructors.some((i) => i.active) && (
                  <optgroup label="Moniteur GoPermis">
                    {resources.instructors
                      .filter((i) => i.active)
                      .map((i) => (
                        <option key={i.id} value={"i:" + i.id}>
                          {i.name}
                        </option>
                      ))}
                  </optgroup>
                )}
                {resources && resources.vehicles.some((v) => v.active) && (
                  <optgroup label="Véhicule">
                    {resources.vehicles
                      .filter((v) => v.active)
                      .map((v) => (
                        <option key={v.id} value={"v:" + v.id}>
                          {v.label}
                        </option>
                      ))}
                  </optgroup>
                )}
                <optgroup label="Type de séance">
                  <option value="companion">Accompagnateur personnel</option>
                  <option value="exam">Examens pratiques</option>
                </optgroup>
              </select>
            </label>

            {/* View Switcher: Day, Week, Month */}
            <div className="viewSwitcherPill">
              <button
                type="button"
                className={`viewPillBtn ${calendarView === "Day" ? "active" : ""}`}
                onClick={() => setCalendarView("Day")}
              >
                Jour
              </button>
              <button
                type="button"
                className={`viewPillBtn ${calendarView === "Week" ? "active" : ""}`}
                onClick={() => setCalendarView("Week")}
              >
                Semaine
              </button>
              <button
                type="button"
                className={`viewPillBtn ${calendarView === "Month" ? "active" : ""}`}
                onClick={() => setCalendarView("Month")}
              >
                Mois
              </button>
            </div>

            {/* + New Event Button matching reference screenshot */}
            {can("schedule.write") && (
              <button
                type="button"
                className="calendarPrimaryAction"
                onClick={() => {
                  const now = new Date();
                  const yyyy = now.getFullYear();
                  const mm = String(now.getMonth() + 1).padStart(2, "0");
                  const dd = String(now.getDate()).padStart(2, "0");
                  setPrefilledSlot({ date: `${yyyy}-${mm}-${dd}`, hour: 10 });
                  setBookingModalOpen(true);
                }}
              >
                <Plus size={16} />
                <span>Nouvelle séance</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {resources && (
        <div className="planLegend" aria-label="Légende des couleurs">
          {resources.instructors
            .filter((i) => i.active)
            .map((i) => (
              <button
                key={i.id}
                type="button"
                className={focus === "i:" + i.id ? "active" : ""}
                onClick={() => setFocus(focus === "i:" + i.id ? "all" : "i:" + i.id)}
              >
                <span className="planDot" style={{ background: instructorColor(i.id) ?? undefined }} />
                {i.name}
              </button>
            ))}
          <button type="button" className={focus === "companion" ? "active" : ""} onClick={() => setFocus(focus === "companion" ? "all" : "companion")}>
            <span className="planDot" style={{ background: planningColors.companion }} />
            Accompagnateur personnel
          </button>
          <button type="button" className={focus === "exam" ? "active" : ""} onClick={() => setFocus(focus === "exam" ? "all" : "exam")}>
            <span className="planDot" style={{ background: planningColors.exam }} />
            Examen pratique
          </button>
          {focus !== "all" && (
            <button type="button" className="planLegendReset" onClick={() => setFocus("all")}>
              Tout afficher
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="calendarAlert errorAlert">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {message && (
        <div className="calendarAlert successAlert">
          <CheckCircle2 size={16} />
          <span>{message}</span>
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}

      {/* VIEW: WEEK (DEFAULT) */}
      {calendarView === "Week" && (
        <div className="calendarGridContainer">
          <table className="calendarTable">
            <thead>
              <tr>
                <th className="timezoneColHeader">
                  <span className="tzBadge">Europe/Paris</span>
                </th>
                {weekDays.map((day, idx) => {
                  const dayNum = day.getDate();
                  const dayName = day.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
                  const isToday = new Date().toDateString() === day.toDateString();

                  return (
                    <th key={idx} className={`dayColHeader ${isToday ? "todayColHeader" : ""}`}>
                      <div className="dayHeaderWrap">
                        <span className={`dayNumber ${isToday ? "todayNumber" : ""}`}>{dayNum}</span>
                        <span className="dayNameLabel">{dayName}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour} className="calendarRow">
                  <td className="timeCellLabel">
                    <span className="hourText">{formatHourAMPM(hour)}</span>
                  </td>
                  {weekDays.map((day, dayIdx) => {
                    const slotBookings = getBookingsForSlot(day, hour);
                    const isNowCell =
                      now.toDateString() === day.toDateString() && now.getHours() === hour;
                    const isTodayCol = now.toDateString() === day.toDateString();

                    return (
                      <td
                        key={dayIdx}
                        className={`calendarSlotCell ${isTodayCol ? "todaySlotCell" : ""}`}
                        onClick={() => {
                          if (can("schedule.write") && slotBookings.length === 0) {
                            handleSlotClick(day, hour);
                          }
                        }}
                      >
                        {isNowCell && <NowLine now={now} />}
                        {slotBookings.map((b) => {
                          const palette = paletteFor(b);
                          const durHours = Math.max(1, Math.round(b.minutes / 60));
                          const spanStyle =
                            durHours > 1
                              ? { minHeight: `${durHours * 96 - 12}px`, zIndex: 5 }
                              : {};

                          const startH = timeFr(b.starts_at);
                          const endH = timeFr(b.ends_at);

                          return (
                            <div
                              key={b.id}
                              className="eventCard"
                              style={{
                                background: palette.bg,
                                borderColor: palette.border,
                                ["--ev" as string]: palette.border,
                                color: palette.text,
                                ...spanStyle,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBooking(b);
                              }}
                            >
                              <div className="eventCardHeader">
                                <span className="eventCardTitle" style={{ color: palette.text }}>
                                  {b.first_name} {b.last_name}
                                </span>
                              </div>

                              <div className="eventCardTime" style={{ color: palette.subtext }}>
                                <Clock size={12} />
                                <span>
                                  {startH} - {endH}
                                </span>
                              </div>

                              <div className="eventCardFooter">
                                <div className="avatarCluster">
                                  <div
                                    className="miniAvatar"
                                    style={{
                                      backgroundColor: palette.avatarBg,
                                      color: palette.avatarText,
                                    }}
                                  >
                                    {b.first_name[0]}
                                  </div>
                                  <span className="avatarMoreText" style={{ color: palette.subtext }}>
                                    {b.vehicle_label.split(" ")[0]}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW: DAY */}
      {calendarView === "Day" && (
        <div className="calendarGridContainer dayViewContainer">
          <div className="dayViewHeader">
            <h2>
              {currentDate.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </h2>
            <span className="dayBookingCount">
              {getBookingsForDay(currentDate).length} séance(s) prévue(s)
            </span>
          </div>

          <div className="dayTimelineGrid">
            {hours.map((hour) => {
              const slotBookings = getBookingsForSlot(currentDate, hour);
              return (
                <div
                  key={hour}
                  className="dayTimelineRow"
                  onClick={() => {
                    if (can("schedule.write") && slotBookings.length === 0) {
                      handleSlotClick(currentDate, hour);
                    }
                  }}
                >
                  <div className="dayTimeLabel">{formatHourAMPM(hour)}</div>
                  <div className="daySlotArea">
                    {now.toDateString() === currentDate.toDateString() &&
                      now.getHours() === hour && <NowLine now={now} />}
                    {slotBookings.length === 0 ? (
                      <div className="emptyDaySlot">
                        <span>Créneau libre · Cliquez pour planifier</span>
                      </div>
                    ) : (
                      slotBookings.map((b) => {
                        const palette = paletteFor(b);
                        return (
                          <div
                            key={b.id}
                            className="eventCard dayEventCard"
                            style={{
                              background: palette.bg,
                              borderColor: palette.border,
                              color: palette.text,
                              ["--ev" as string]: palette.border,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBooking(b);
                            }}
                          >
                            <div className="eventCardHeader">
                              <strong className="eventCardTitle">{b.first_name} {b.last_name}</strong>
                              <span className="eventCardTime">
                                <Clock size={12} /> {displayDate(b.starts_at)} → {displayDate(b.ends_at)}
                              </span>
                            </div>
                            <div className="eventCardFooter">
                              <span>🚗 {b.vehicle_label}</span>
                              <span>👤 {b.instructor_name || "Accompagnateur: " + b.companion_name}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: MONTH */}
      {calendarView === "Month" && (
        <div className="calendarGridContainer monthViewContainer">
          <div className="monthGridHeader">
            <span>Lun</span>
            <span>Mar</span>
            <span>Mer</span>
            <span>Jeu</span>
            <span>Ven</span>
            <span>Sam</span>
            <span>Dim</span>
          </div>
          <div className="monthDaysGridLarge">
            {monthDaysGrid.map((cell, idx) => {
              const dayBookings = getBookingsForDay(cell.date);
              const isToday = new Date().toDateString() === cell.date.toDateString();

              return (
                <div
                  key={idx}
                  className={`monthGridCell ${!cell.isCurrentMonth ? "outOfMonth" : ""} ${
                    isToday ? "todayCell" : ""
                  }`}
                  onClick={() => {
                    setCurrentDate(cell.date);
                    setCalendarView("Day");
                  }}
                >
                  <div className="monthCellHead">
                    <span className={`monthDayNum ${isToday ? "todayNumBadge" : ""}`}>
                      {cell.dayNum}
                    </span>
                    {dayBookings.length > 0 && (
                      <span className="monthCountBadge">{dayBookings.length}</span>
                    )}
                  </div>

                  <div className="monthCellBookings">
                    {dayBookings.slice(0, 3).map((b) => (
                      <div key={b.id} className="monthBookingChip" style={{ borderLeftColor: colorFor(b) }}>
                        {b.first_name} ({new Date(b.starts_at).getHours()}h)
                      </div>
                    ))}
                    {dayBookings.length > 3 && (
                      <span className="monthMoreText">+{dayBookings.length - 3} autres</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <Modal title="Détails de la séance" close={() => setSelectedBooking(null)}>
          <div className="bookingDetailView">
            <div className="bookingDetailHeader">
              <div>
                <h3>
                  {selectedBooking.first_name} {selectedBooking.last_name}
                </h3>
                <p className="bookingSub">
                  {displayDate(selectedBooking.starts_at)} → {displayDate(selectedBooking.ends_at)} (
                  {selectedBooking.minutes / 60} h)
                </p>
              </div>
              <span
                className={`statusBadge ${
                  selectedBooking.status === "completed" ? "completed" : "confirmed"
                }`}
              >
                {selectedBooking.status === "completed" ? "Réalisée" : "Confirmée"}
              </span>
            </div>

            <div className="bookingMetaList">
              <div className="bookingMetaItem">
                <Car size={16} />
                <span>{selectedBooking.vehicle_label}</span>
              </div>
              <div className="bookingMetaItem">
                <User size={16} />
                <span>
                  {selectedBooking.instructor_name ??
                    "Accompagnateur : " + selectedBooking.companion_name}
                </span>
              </div>
            </div>

            {selectedBooking.completed_at && (
              <p className="completedNotice">
                Validée le {displayDate(selectedBooking.completed_at)}
              </p>
            )}

            {(can("documents.read") || can("documents.write")) && (
              <div className="bookingRental">
                <FileSignature size={16} />
                {selectedBooking.rental_document_id ? (
                  <>
                    <span>Fiche de location générée</span>
                    <a className="btnSecondary" href={`/api/documents/${selectedBooking.rental_document_id}/download?inline=1`} target="_blank" rel="noreferrer">
                      Ouvrir
                    </a>
                  </>
                ) : (
                  <>
                    <span>Pas encore de fiche de location</span>
                    {can("documents.write") && (
                      <button
                        type="button"
                        className="btnSecondary"
                        disabled={busy}
                        onClick={() =>
                          void perform(async () => {
                            const res = await api<{ documentId: string }>(`bookings/${selectedBooking.id}/rental`, {});
                            return res;
                          }, "Fiche de location générée et rangée dans le dossier de l'élève.")
                        }
                      >
                        Générer la fiche
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="modalActionRow">
              {selectedBooking.status === "confirmed" && can("sessions.complete") && (
                <button
                  className="btnPrimary"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Confirmer la réalisation de cette séance (${selectedBooking.minutes / 60} h) ?`
                      )
                    ) {
                      void perform(
                        () => api(`bookings/${selectedBooking.id}/complete`, {}),
                        "Séance validée. Journal d'heures actualisé."
                      );
                    }
                  }}
                >
                  Marquer réalisée ({selectedBooking.minutes / 60} h)
                </button>
              )}
              <button
                type="button"
                className="btnSecondary"
                onClick={() => setSelectedBooking(null)}
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* New Booking Modal with Formula Selection (Boîte Manuelle / Auto / RS3, Avec/Sans Moniteur) */}
      {bookingModalOpen && resources && (
        <Modal
          title="Planifier une nouvelle séance"
          close={() => {
            if (!busy) setBookingModalOpen(false);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (!selectedServiceId) {
                setError("Veuillez sélectionner une prestation client active.");
                return;
              }
              try {
                const body = {
                  vehicleId: f.get("vehicleId"),
                  instructorId: selectedSupport === "GoPermis" ? f.get("instructorId") || null : null,
                  startsAt: localInstant(f.get("startsAt")),
                  endsAt: localInstant(f.get("endsAt")),
                  requestId: crypto.randomUUID(),
                  ...(selectedSupport === "Personnel"
                    ? {
                        companionName: f.get("companionName"),
                        companionLicenseDate: f.get("companionLicenseDate"),
                      }
                    : {}),
                };
                void perform(
                  () => api(`services/${selectedServiceId}/bookings`, body),
                  "Séance réservée et enregistrée avec succès."
                );
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            {/* 1. Client selection */}
            {!detail && (
              <label>
                Élève (Client)
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Choisir un élève...
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({c.phone})
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* 1. Véhicule : un seul sélecteur, la boîte se déduit du modèle */}
            <label>
              Véhicule
              <select
                name="vehicleId"
                required
                value={selectedVehicleId}
                onChange={(e) => {
                  setSelectedVehicleId(e.target.value);
                  const v = activeVehicles.find((x) => x.id === e.target.value);
                  if (v?.model_id === "rs3") setSelectedSupport("GoPermis");
                }}
              >
                <option value="" disabled>
                  Choisir un véhicule
                </option>
                {activeVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} · {v.model_label}
                  </option>
                ))}
              </select>
            </label>

            {/* Formula choice step 2: Avec ou sans accompagnateur */}
            <div className="formulaSection">
              <span className="formulaStepLabel">Mode d&apos;encadrement</span>
              <div className="segmentedChoiceRow">
                <button
                  type="button"
                  className={`segmentBtn ${selectedSupport === "GoPermis" ? "active" : ""}`}
                  onClick={() => setSelectedSupport("GoPermis")}
                >
                  Avec Moniteur GoPermis
                </button>
                <button
                  type="button"
                  className={`segmentBtn ${selectedSupport === "Personnel" ? "active" : ""}`}
                  onClick={() => setSelectedSupport("Personnel")}
                  disabled={!personnelAllowed}
                  title={personnelAllowed ? undefined : "Accompagnement GoPermis uniquement sur RS3"}
                >
                  Accompagnateur personnel (Supervisée)
                </button>
              </div>
            </div>

            {/* Prestation active de l'élève */}
            <label>
              Prestation & Dossier actif
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                required
                disabled={!clientDetailData}
              >
                {!clientDetailData ? (
                  <option value="">Sélectionnez d&apos;abord un élève</option>
                ) : clientDetailData.services.filter((s) => s.status === "Active").length === 0 ? (
                  <option value="">Aucune prestation active pour cet élève (créez-en une dans son dossier)</option>
                ) : (
                  <>
                    <option value="" disabled>
                      Choisir la prestation...
                    </option>
                    {clientDetailData.services
                      .filter((s) => s.status === "Active")
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label} ({s.price_snapshot.support} · {s.price_snapshot.model})
                        </option>
                      ))}
                  </>
                )}
              </select>
            </label>

            {/* Instructor or Companion */}
            {selectedSupport === "GoPermis" ? (
              <label>
                Moniteur GoPermis
                <select name="instructorId" required defaultValue="">
                  <option value="" disabled>
                    Choisir un moniteur
                  </option>
                  {resources.instructors
                    .filter((i) => i.active)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <>
                <label>
                  Nom de l&apos;accompagnateur personnel
                  <input name="companionName" required maxLength={150} placeholder="ex: Jean Dupont" />
                </label>
                <label>
                  Date d&apos;obtention de son permis
                  <input type="date" name="companionLicenseDate" required />
                </label>
              </>
            )}

            {/* Date and time fields */}
            <div className="formGrid">
              <label>
                Début
                <input
                  type="datetime-local"
                  name="startsAt"
                  required
                  step="60"
                  defaultValue={
                    prefilledSlot
                      ? `${prefilledSlot.date}T${String(prefilledSlot.hour).padStart(2, "0")}:00`
                      : ""
                  }
                />
              </label>
              <label>
                Fin
                <input
                  type="datetime-local"
                  name="endsAt"
                  required
                  step="60"
                  defaultValue={
                    prefilledSlot
                      ? `${prefilledSlot.date}T${String(prefilledSlot.hour + 1).padStart(2, "0")}:00`
                      : ""
                  }
                />
              </label>
            </div>

            <div className="modalButtonsRow">
              <button
                type="button"
                className="btnSecondary"
                onClick={() => setBookingModalOpen(false)}
                disabled={busy}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btnPrimary"
                disabled={busy || !selectedServiceId}
              >
                {busy ? "Enregistrement…" : "Confirmer la réservation"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
