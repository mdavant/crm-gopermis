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

// Format hour for display in calendar grid (08 AM, 09 AM, 12 PM, 01 PM, etc.)
function formatHourAMPM(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h.toString().padStart(2, "0")} ${ampm}`;
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
  const [selectedGearbox, setSelectedGearbox] = useState<"clio-manual" | "clio-auto" | "rs3">("clio-manual");
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
  const cardColorStyles = [
    { bg: "#fff1f2", border: "#ffe4e6", text: "#881337", subtext: "#9f1239", avatarBg: "#fecdd3", avatarText: "#9f1239" },
    { bg: "#f0fdf4", border: "#dcfce7", text: "#14532d", subtext: "#166534", avatarBg: "#bbf7d0", avatarText: "#166534" },
    { bg: "#f0f7ff", border: "#e0f2fe", text: "#0c4a6e", subtext: "#0369a1", avatarBg: "#bae6fd", avatarText: "#0369a1" },
    { bg: "#fffbeb", border: "#fef3c7", text: "#78350f", subtext: "#92400e", avatarBg: "#fde68a", avatarText: "#92400e" },
  ];

  // Real bookings only! No fabricated dummy sessions!
  const activeBookings = activeFilters ? rows.filter(b => activeFilters.includes(b.status)) : rows;

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
  const matchingVehicles = useMemo(() => {
    if (!resources) return [];
    return resources.vehicles.filter((v) => v.active && v.model_id === selectedGearbox);
  }, [resources, selectedGearbox]);

  return (
    <div className="calendarWorkspace">
      {/* Top Header Bar matching reference image */}
      <div className="calendarTopBar">
        <div className="calendarBreadcrumb">
          <span>Calendar</span>
          <span className="crumbSep">&gt;</span>
          <span className="crumbCurrent">All Calendar</span>
        </div>

        <div className="calendarTitleRow">
          <div>
            <h1 className="calendarMainTitle">Calendar</h1>
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

            {/* View Switcher: Day, Week, Month */}
            <div className="viewSwitcherPill">
              <button
                type="button"
                className={`viewPillBtn ${calendarView === "Day" ? "active" : ""}`}
                onClick={() => setCalendarView("Day")}
              >
                Day
              </button>
              <button
                type="button"
                className={`viewPillBtn ${calendarView === "Week" ? "active" : ""}`}
                onClick={() => setCalendarView("Week")}
              >
                Week
              </button>
              <button
                type="button"
                className={`viewPillBtn ${calendarView === "Month" ? "active" : ""}`}
                onClick={() => setCalendarView("Month")}
              >
                Month
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
                <span>New Event</span>
              </button>
            )}
          </div>
        </div>
      </div>

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
                  const dayName = day.toLocaleDateString("en-US", { weekday: "long" });
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

                    return (
                      <td
                        key={dayIdx}
                        className="calendarSlotCell"
                        onClick={() => {
                          if (can("schedule.write") && slotBookings.length === 0) {
                            handleSlotClick(day, hour);
                          }
                        }}
                      >
                        {slotBookings.map((b, bIdx) => {
                          const palette = cardColorStyles[bIdx % cardColorStyles.length];
                          const durHours = Math.max(1, Math.round(b.minutes / 60));
                          const spanStyle =
                            durHours > 1
                              ? { minHeight: `${durHours * 96 - 12}px`, zIndex: 5 }
                              : {};

                          const startH = new Date(b.starts_at).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          });
                          const endH = new Date(b.ends_at).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          });

                          return (
                            <div
                              key={b.id}
                              className="eventCard"
                              style={{
                                backgroundColor: palette.bg,
                                borderColor: palette.border,
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
                    {slotBookings.length === 0 ? (
                      <div className="emptyDaySlot">
                        <span>Créneau libre · Cliquez pour planifier</span>
                      </div>
                    ) : (
                      slotBookings.map((b, idx) => {
                        const palette = cardColorStyles[idx % cardColorStyles.length];
                        return (
                          <div
                            key={b.id}
                            className="eventCard dayEventCard"
                            style={{
                              backgroundColor: palette.bg,
                              borderColor: palette.border,
                              color: palette.text,
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
                      <div key={b.id} className="monthBookingChip">
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

            {/* Formula choice step 1: Transmission / Boîte */}
            <div className="formulaSection">
              <span className="formulaStepLabel">1. Type de transmission / Boîte</span>
              <div className="segmentedChoiceRow">
                <button
                  type="button"
                  className={`segmentBtn ${selectedGearbox === "clio-manual" ? "active" : ""}`}
                  onClick={() => setSelectedGearbox("clio-manual")}
                >
                  Boîte Manuelle
                </button>
                <button
                  type="button"
                  className={`segmentBtn ${selectedGearbox === "clio-auto" ? "active" : ""}`}
                  onClick={() => setSelectedGearbox("clio-auto")}
                >
                  Boîte Automatique
                </button>
                <button
                  type="button"
                  className={`segmentBtn ${selectedGearbox === "rs3" ? "active" : ""}`}
                  onClick={() => setSelectedGearbox("rs3")}
                >
                  Audi RS3
                </button>
              </div>
            </div>

            {/* Formula choice step 2: Avec ou sans accompagnateur */}
            <div className="formulaSection">
              <span className="formulaStepLabel">2. Mode d&apos;encadrement</span>
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

            {/* Vehicle selection (filtered by chosen gearbox) */}
            <label>
              Véhicule disponible
              <select name="vehicleId" required defaultValue="">
                <option value="" disabled>
                  Choisir un véhicule disponible
                </option>
                {matchingVehicles.length === 0 ? (
                  resources.vehicles
                    .filter((v) => v.active)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label} · {v.model_label}
                      </option>
                    ))
                ) : (
                  matchingVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} · {v.model_label}
                    </option>
                  ))
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
