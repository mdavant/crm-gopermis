"use client";
import React from "react";
import { Moon, Sun } from "lucide-react";
import { useApp } from "./app-context";

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useApp();
  const isDark = theme === "dark";

  // Compact variant: sleek animated pill for the 60px left dock rail
  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Passer au thème clair" : "Passer au thème sombre"}
        title={isDark ? "Passer au thème clair" : "Passer au thème sombre"}
        style={{
          width: "48px",
          height: "26px",
          borderRadius: "9999px",
          border: "none",
          outline: "none",
          padding: "3px",
          cursor: "pointer",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          // Dark: sleek dark capsule; Light: soft slate capsule (no black contour)
          background: isDark ? "#1e293b" : "#cbd5e1",
          boxShadow: isDark
            ? "inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(255,255,255,0.05)"
            : "inset 0 1px 3px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.04)",
          transition: "background 0.25s ease, box-shadow 0.25s ease",
        }}
      >
        {/* Left icon: Sun - always white as requested */}
        <span
          style={{
            width: "20px",
            height: "20px",
            display: "grid",
            placeItems: "center",
            color: "#ffffff",
            opacity: isDark ? 0.35 : 1,
            transition: "opacity 0.2s ease",
            zIndex: 1,
          }}
        >
          <Sun size={12} strokeWidth={2.5} style={{ color: "#ffffff" }} />
        </span>

        {/* Right icon: Moon - white */}
        <span
          style={{
            width: "20px",
            height: "20px",
            display: "grid",
            placeItems: "center",
            color: "#ffffff",
            opacity: isDark ? 1 : 0.4,
            transition: "opacity 0.2s ease",
            zIndex: 1,
          }}
        >
          <Moon size={11} strokeWidth={2.5} style={{ color: "#ffffff" }} />
        </span>

        {/* Sliding knob: White in dark mode, Dark in light mode to contrast */}
        <span
          style={{
            position: "absolute",
            top: "3px",
            left: "3px",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: isDark ? "#ffffff" : "#0f172a",
            boxShadow: isDark
              ? "0 2px 5px rgba(0,0,0,0.4)"
              : "0 2px 5px rgba(15,23,42,0.35)",
            transform: isDark ? "translateX(22px)" : "translateX(0px)",
            transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s ease",
            zIndex: 2,
          }}
        />
      </button>
    );
  }

  // Full variant: prominent animated pill with labels for sidebar bottom
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        width: "100%",
      }}
    >
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Passer au thème clair" : "Passer au thème sombre"}
        title={isDark ? "Passer au thème clair" : "Passer au thème sombre"}
        style={{
          width: "66px",
          height: "34px",
          borderRadius: "9999px",
          border: "none",
          outline: "none",
          padding: "4px",
          cursor: "pointer",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          // Dark: deep slate capsule; Light: soft neutral capsule (no black contour)
          background: isDark ? "#1e293b" : "#cbd5e1",
          boxShadow: isDark
            ? "inset 0 2px 4px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.2)"
            : "inset 0 2px 4px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.05)",
          transition: "background 0.25s ease, box-shadow 0.25s ease",
        }}
      >
        {/* Sun icon: MUST BE WHITE as explicitly requested */}
        <span
          style={{
            width: "26px",
            height: "26px",
            display: "grid",
            placeItems: "center",
            color: "#ffffff",
            opacity: isDark ? 0.35 : 1,
            transition: "opacity 0.2s ease",
            zIndex: 1,
          }}
        >
          <Sun size={15} strokeWidth={2.4} style={{ color: "#ffffff" }} />
        </span>

        {/* Moon icon: crisp white */}
        <span
          style={{
            width: "26px",
            height: "26px",
            display: "grid",
            placeItems: "center",
            color: "#ffffff",
            opacity: isDark ? 1 : 0.35,
            transition: "opacity 0.2s ease",
            zIndex: 1,
          }}
        >
          <Moon size={14} strokeWidth={2.4} style={{ color: "#ffffff" }} />
        </span>

        {/* Sliding knob: White in dark mode, Dark slate in light mode */}
        <span
          style={{
            position: "absolute",
            top: "4px",
            left: "4px",
            width: "26px",
            height: "26px",
            borderRadius: "50%",
            background: isDark ? "#ffffff" : "#0f172a",
            boxShadow: isDark
              ? "0 3px 8px rgba(0,0,0,0.45)"
              : "0 3px 8px rgba(15,23,42,0.35)",
            transform: isDark ? "translateX(32px)" : "translateX(0px)",
            transition: "transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s ease",
            zIndex: 2,
          }}
        />
      </button>

      {/* Discrete label beneath toggle */}
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: isDark ? "#94a3b8" : "#64748b",
          userSelect: "none",
          transition: "color 0.2s ease",
        }}
      >
        {isDark ? "Thème sombre" : "Thème clair"}
      </span>
    </div>
  );
}
