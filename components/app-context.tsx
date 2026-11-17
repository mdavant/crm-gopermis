"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, type User, type Catalog } from "../lib/api-types";

interface AppContextType {
  user: User | null;
  loading: boolean;
  catalog: Catalog | null;
  can: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  createClientOpen: boolean;
  setCreateClientOpen: (open: boolean) => void;
  newBookingOpen: boolean;
  setNewBookingOpen: (open: boolean) => void;
  accountOpen: boolean;
  setAccountOpen: (open: boolean) => void;
  selectedClientIdForBooking?: string;
  openNewBookingWithClient: (clientId?: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [selectedClientIdForBooking, setSelectedClientIdForBooking] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gopermis-theme") as "light" | "dark" | null;
      const initial = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      setTheme(initial);
      document.documentElement.setAttribute("data-theme", initial);
      if (initial === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {
      // fallback
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem("gopermis-theme", next);
        document.documentElement.setAttribute("data-theme", next);
        if (next === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      } catch {
        // fallback
      }
      return next;
    });
  }, []);

  const can = useCallback((p: string) => user?.permissions.includes(p) ?? false, [user]);

  const refreshCatalog = useCallback(async () => {
    try {
      const c = await api<Catalog>("catalog");
      setCatalog(c);
    } catch {
      // User might not have clients.read or not logged in yet
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await api<User>("me");
      setUser(u);
      if (u.permissions.includes("clients.read")) {
        await refreshCatalog();
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshCatalog]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setCatalog(null);
    };
    window.addEventListener("gopermis-session-expired", handleExpired);
    return () => window.removeEventListener("gopermis-session-expired", handleExpired);
  }, []);

  const openNewBookingWithClient = useCallback((clientId?: string) => {
    setSelectedClientIdForBooking(clientId);
    setNewBookingOpen(true);
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        catalog,
        can,
        refreshUser,
        refreshCatalog,
        createClientOpen,
        setCreateClientOpen,
        newBookingOpen,
        setNewBookingOpen,
        accountOpen,
        setAccountOpen,
        selectedClientIdForBooking,
        openNewBookingWithClient,
        sidebarOpen,
        setSidebarOpen,
        theme,
        toggleTheme,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within an AppProvider");
  return ctx;
}
