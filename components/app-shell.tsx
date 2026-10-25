"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Calendar,
  Users,
  WalletCards,
  Settings,
  LogOut,
  User as UserIcon,
  Menu,
  X,
} from "lucide-react";
import { useApp } from "./app-context";
import { AuthGate } from "./auth-gate";
import { AccountSettings } from "./account-settings";
import { CreateClientModal } from "./create-client-modal";
import { NewBookingModal } from "./new-booking-modal";
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
  } = useApp();

  const pathname = usePathname();
  const router = useRouter();

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <div className="brandMark" style={{ margin: "0 auto 16px", width: "48px", height: "48px" }}>
            GP
          </div>
          <p style={{ fontWeight: 600, color: "#64748b" }}>Chargement de GoPermis CRM…</p>
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
    { href: "/tarifs", label: "Tarifs & offres", icon: WalletCards, exact: false },
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
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brandMark">GP</div>
          <div>
            <strong>GoPermis</strong>
            <span>CRM Auto-école</span>
          </div>
          {sidebarOpen && (
            <button
              className="mobileClose"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fermer le menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

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
                  style={{ width: "100%" }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              </Link>
            );
          })}
        </nav>

        {/* User profile & footer */}
        <div style={{ marginTop: "auto", paddingTop: "20px", borderTop: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 6px 14px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#f1f5f9",
                color: "#334155",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: "13px",
              }}
            >
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ overflow: "hidden" }}>
              <span style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.name}
              </span>
              <span style={{ display: "block", fontSize: "11px", color: "#64748b" }}>
                Connecté
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              style={{
                flex: 1,
                height: "36px",
                padding: "0 10px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                color: "#334155",
                fontSize: "12px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              <UserIcon size={13} />
              Compte
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                height: "36px",
                padding: "0 10px",
                borderRadius: "8px",
                border: "1px solid #fee2e2",
                background: "#fff5f5",
                color: "#dc2626",
                fontSize: "12px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
              title="Déconnexion"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, minWidth: 0, marginLeft: "260px" }}>
        {/* Mobile top bar toggle */}
        <div
          style={{
            display: "none",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
          }}
          className="mobileTopBar"
        >
          <button
            type="button"
            className="menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu size={20} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="brandMark" style={{ width: "28px", height: "28px", fontSize: "13px" }}>
              GP
            </div>
            <strong style={{ fontSize: "15px" }}>GoPermis</strong>
          </div>
          <div style={{ width: "40px" }} />
        </div>

        <div className="content">{children}</div>
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
