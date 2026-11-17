"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Calendar,
  Users,
  Database,
  Settings,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  HardDrive,
} from "lucide-react";
import { useApp } from "./app-context";
import { AuthGate } from "./auth-gate";
import { AccountSettings } from "./account-settings";
import { CreateClientModal } from "./create-client-modal";
import { NewBookingModal } from "./new-booking-modal";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { clearPreviewSession } from "../lib/session";
import { api } from "../lib/api-types";

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    user,
    loading,
    refreshUser,
    accountOpen,
    setAccountOpen,
    sidebarOpen,
    setSidebarOpen,
    theme,
  } = useApp();

  const pathname = usePathname();
  const router = useRouter();
  const isDark = theme === "dark";

  if (pathname === "/") return <>{children}</>;

  if (loading) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          background: isDark ? "#090d16" : "#f8fafc",
          color: isDark ? "#f8fafc" : "#0f172a",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            className="brandMark"
            style={{
              margin: "0 auto 16px",
              width: "48px",
              height: "48px",
              background: isDark ? "#ea580c" : "#0f172a",
              color: "#ffffff",
            }}
          >
            GP
          </div>
          <p style={{ fontWeight: 600, color: isDark ? "#94a3b8" : "#64748b" }}>
            Chargement de GoPermis CRM…
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate onAuthenticated={refreshUser} />;
  }

  const navItems = [
    { href: "/", label: "Accueil", icon: Home, exact: true },
    { href: "/planning", label: "Planning", icon: Calendar, exact: false },
    { href: "/clients", label: "Clients", icon: Users, exact: false },
    { href: "/drive", label: "Drive", icon: HardDrive, exact: false },
    { href: "/donnees", label: "Données", icon: Database, exact: false },
    { href: "/parametres", label: "Paramètres", icon: Settings, exact: false },
  ];

  const handleLogout = async () => {
    try {
      await api("logout", {});
    } catch {
      // ignore
    }
    clearPreviewSession();
    await refreshUser();
    router.push("/");
  };

  return (
    <div className="appShell">
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Left Sidebar */}
      <aside
        className={`sidebar ${sidebarOpen ? "open" : ""}`}
        style={{
          background: isDark ? "#0b101b" : "#ffffff",
          borderColor: isDark ? "#1a2234" : "#e9e9eb",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Brand header */}
        <div className="brand" style={{ paddingBottom: "14px" }}>
          <div
            className="brandMark"
            style={{
              background: "#2563eb",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.35)",
            }}
          >
            GP
          </div>
          <div>
            <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>GoPermis</strong>
            <span style={{ color: isDark ? "#94a3b8" : "#9a9ca3" }}>CRM Auto-école</span>
          </div>
          {sidebarOpen && (
            <button
              className="mobileClose"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fermer le menu"
              style={{ color: isDark ? "#cbd5e1" : "#64748b" }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "12px" }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            // Active in dark mode: pure white icon and text with soft ambient glow, subtle background pill
            // Active in light mode: electric blue text/icon with soft blue background
            const activeBg = isDark ? "rgba(255, 255, 255, 0.08)" : "#eff6ff";
            const activeColor = isDark ? "#ffffff" : "#2563eb";
            const inactiveColor = isDark ? "#94a3b8" : "#666a73";

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                style={{ textDecoration: "none" }}
              >
                <button
                  type="button"
                  className={isActive ? "active" : ""}
                  style={{
                    width: "100%",
                    height: "42px",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "0 14px",
                    border: "none",
                    background: isActive ? activeBg : "transparent",
                    color: isActive ? activeColor : inactiveColor,
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "13px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: isActive && isDark ? "0 0 0 1px rgba(255, 255, 255, 0.12)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = isDark ? "#131d31" : "#f6f6f7";
                      e.currentTarget.style.color = isDark ? "#f8fafc" : "#222222";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = inactiveColor;
                    }
                  }}
                >
                  <Icon
                    size={18}
                    style={{
                      color: isActive ? activeColor : undefined,
                      filter: isActive && isDark ? "drop-shadow(0 0 5px rgba(255, 255, 255, 0.6))" : undefined,
                    }}
                  />
                  <span
                    style={{
                      color: isActive ? activeColor : undefined,
                      textShadow: isActive && isDark ? "0 0 8px rgba(255, 255, 255, 0.35)" : undefined,
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              </Link>
            );
          })}
        </nav>

        {/* User profile & controls anchored at the bottom */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: "14px",
            borderTop: `1px solid ${isDark ? "#1a2234" : "#f1f5f9"}`,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {/* User Profile Card */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 4px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: isDark ? "#1e293b" : "#f1f5f9",
                color: isDark ? "#f8fafc" : "#334155",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: "13px",
                border: `1px solid ${isDark ? "#334155" : "transparent"}`,
              }}
            >
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <span
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: isDark ? "#f8fafc" : "#0f172a",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.name}
              </span>
              <span style={{ display: "block", fontSize: "11px", color: isDark ? "#94a3b8" : "#64748b" }}>
                Connecté
              </span>
            </div>
          </div>

          {/* Account and Logout Buttons */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              style={{
                flex: 1,
                height: "34px",
                padding: "0 10px",
                borderRadius: "8px",
                border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                background: isDark ? "#131d31" : "#ffffff",
                color: isDark ? "#e2e8f0" : "#334155",
                fontSize: "12px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark ? "#1e293b" : "#f8fafc";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDark ? "#131d31" : "#ffffff";
              }}
            >
              <UserIcon size={13} />
              Compte
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                height: "34px",
                padding: "0 10px",
                borderRadius: "8px",
                border: isDark ? "1px solid rgba(220, 38, 38, 0.3)" : "1px solid #fee2e2",
                background: isDark ? "rgba(220, 38, 38, 0.15)" : "#fff5f5",
                color: isDark ? "#f87171" : "#dc2626",
                fontSize: "12px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              title="Déconnexion"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark ? "rgba(220, 38, 38, 0.25)" : "#fee2e2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDark ? "rgba(220, 38, 38, 0.15)" : "#fff5f5";
              }}
            >
              <LogOut size={13} />
            </button>
          </div>

          {/* THEME SWITCH: TOUT EN BAS DE LA SIDEBAR, À PART DU RESTE */}
          <div
            style={{
              paddingTop: "10px",
              marginTop: "4px",
              borderTop: `1px dashed ${isDark ? "#1a2234" : "#e2e8f0"}`,
              display: "flex",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          marginLeft: "248px",
          background: isDark ? "#090d16" : "#f7f8fa",
          minHeight: "100vh",
        }}
      >
        {/* Top utility bar with Notification Bell in top right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "12px 28px",
            background: "transparent",
          }}
          className="appShellTopBar"
        >
          <NotificationBell />
        </div>

        {/* Mobile top bar toggle */}
        <div
          style={{
            display: "none",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            background: isDark ? "#0b101b" : "#ffffff",
            borderBottom: `1px solid ${isDark ? "#1a2234" : "#e2e8f0"}`,
          }}
          className="mobileTopBar"
        >
          <button
            type="button"
            className="menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
            style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
          >
            <Menu size={20} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              className="brandMark"
              style={{
                width: "28px",
                height: "28px",
                fontSize: "13px",
                background: isDark ? "#ea580c" : "#0f172a",
                color: "#ffffff",
              }}
            >
              GP
            </div>
            <strong style={{ fontSize: "15px", color: isDark ? "#f8fafc" : "#0f172a" }}>
              GoPermis
            </strong>
          </div>
          <NotificationBell />
        </div>

        <div className="content" style={{ paddingTop: "4px" }}>
          {children}
        </div>
      </main>

      {/* Global Modals */}
      <CreateClientModal />
      <NewBookingModal />
      {accountOpen && (
        <AccountSettings
          close={() => setAccountOpen(false)}
          done={() => setAccountOpen(false)}
        />
      )}
    </div>
  );
}
