"use client";
import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";

interface CalendarSidebarProps {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  activeFilters: string[];
  onToggleFilter: (filterId: string) => void;
  stats?: {
    manualVehicles?: number;
    autoVehicles?: number;
    exams?: number;
  };
}

export function CalendarSidebar({
  selectedDate,
  onSelectDate,
  activeFilters,
  onToggleFilter,
  stats = { manualVehicles: 0, autoVehicles: 0, exams: 0 },
}: CalendarSidebarProps) {
  // Navigation for the mini calendar
  const [viewMonth, setViewMonth] = useState<Date>(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  // Accordion open/closed states
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [categoriesOpen, setRessourcesOpen] = useState(true);

  // Mini calendar navigation
  const prevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  };

  // Generate 35 or 42 grid cells for the month
  const monthDays = React.useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    // Day of week: 0 is Sun, 1 is Mon, etc.
    let startDayOfWeek = firstDay.getDay() - 1; // Mon = 0, Sun = 6
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    // Number of days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Number of days in previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean; dayNum: number }[] = [];

    // Prev month overflow
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      cells.push({ date: d, isCurrentMonth: false, dayNum: d.getDate() });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      cells.push({ date: d, isCurrentMonth: true, dayNum: i });
    }

    // Next month overflow up to 35 or 42 cells
    const remaining = 35 - cells.length > 0 ? 35 - cells.length : 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ date: d, isCurrentMonth: false, dayNum: i });
    }

    return cells;
  }, [viewMonth]);

  const monthLabel = viewMonth.toLocaleString("en-US", { month: "long" });

  const filterOptions = [
    {id:"confirmed",label:"Séances confirmées"},
    {id:"completed",label:"Séances réalisées"},
  ];

  return (
    <aside className="calendarSubPanel">
      {/* Top Planning GoPermis Widget */}
      <div className="allCalendarWidget">
        <div className="calendarTileIcon">
          <div className="tileRedHeader" />
          <span className="tileDayText">31</span>
        </div>
        <div className="calendarWidgetText">
          <strong className="widgetTitle">Planning GoPermis</strong>
          <span className="widgetSub">Séances de conduite</span>
        </div>
        <ChevronDown size={17} className="widgetChevron" />
      </div>

      <div className="subPanelDivider" />

      {/* Mini Month Calendar */}
      <div className="miniCalendarBox">
        <div className="miniCalendarNav">
          <button
            type="button"
            className="miniNavBtn"
            onClick={prevMonth}
            aria-label="Mois précédent"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="miniMonthTitle">{monthLabel}</span>
          <button
            type="button"
            className="miniNavBtn"
            onClick={nextMonth}
            aria-label="Mois suivant"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Days of week header: Mo Tu We Th Fr Sa Su */}
        <div className="miniWeekHeader">
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
          <span>Su</span>
        </div>

        {/* 7x5 Day Grid */}
        <div className="miniDaysGrid">
          {monthDays.map((cell, idx) => {
            const isSelected =
              selectedDate.getDate() === cell.date.getDate() &&
              selectedDate.getMonth() === cell.date.getMonth() &&
              selectedDate.getFullYear() === cell.date.getFullYear();

            return (
              <button
                key={idx}
                type="button"
                className={`miniDayCell ${
                  !cell.isCurrentMonth ? "outOfMonth" : ""
                } ${isSelected ? "selectedDay" : ""}`}
                onClick={() => onSelectDate(cell.date)}
              >
                <span>{cell.dayNum}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="subPanelDivider" />

      {/* Statuts Checklist */}
      <div className="subSection">
        <button
          type="button"
          className="sectionHeaderToggle"
          onClick={() => setScheduleOpen(!scheduleOpen)}
        >
          <span className="sectionHeading">Statuts</span>
          {scheduleOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {scheduleOpen && (
          <div className="checkboxList">
            {filterOptions.map((opt) => {
              const checked = activeFilters.includes(opt.id);
              return (
                <label key={opt.id} className="checkboxRow">
                  <div
                    className={`customCheckbox ${checked ? "checked" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onToggleFilter(opt.id);
                    }}
                  >
                    {checked && <Check size={12} strokeWidth={3} />}
                  </div>
                  <span className="checkboxLabel">{opt.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="subPanelDivider" />

      {/* Ressources Section */}
      <div className="subSection">
        <button
          type="button"
          className="sectionHeaderToggle"
          onClick={() => setRessourcesOpen(!categoriesOpen)}
        >
          <span className="sectionHeading">Ressources</span>
          {categoriesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {categoriesOpen && (
          <div className="categoriesList">
            <div className="categoryRow">
              <span className="catDot" style={{ backgroundColor: "#ef4444" }} />
              <span className="catName">Manuelles</span>
              <span className="catCountPill">{stats.manualVehicles ?? 0}</span>
            </div>
            <div className="categoryRow">
              <span className="catDot" style={{ backgroundColor: "#22c55e" }} />
              <span className="catName">Automatiques</span>
              <span className="catCountPill">{stats.autoVehicles ?? 0}</span>
            </div>
            <div className="categoryRow">
              <span className="catDot" style={{ backgroundColor: "#f59e0b" }} />
              <span className="catName">Indisponibilités</span>
              <span className="catCountPill">—</span>
            </div>
            <div className="categoryRow">
              <span className="catDot" style={{ backgroundColor: "#0284c7" }} />
              <span className="catName">Examens</span>
              <span className="catCountPill">{stats.exams ?? "—"}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
