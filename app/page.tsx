"use client";
import { useEffect, useState, useCallback, type FormEvent } from "react";
import {
  Home as HomeIcon,
  Users,
  LogOut,
  Car,
  WalletCards,
  CalendarDays,
  Bell,
} from "lucide-react";
import {
  api,
  type User,
  type Catalog,
  type ClientRecord,
  type Detail,
  type Booking,
  type Resources,
  type HomeStats,
} from "../lib/api-types";
import { Modal } from "../components/modal";
import { Dashboard } from "../components/dashboard";
import { Schedule } from "../components/schedule";
import { CalendarSidebar } from "../components/calendar-sidebar";
import { ResourceSettings } from "../components/resources";
import { ClientDetail } from "../components/client-detail";
import { ClientsView } from "../components/clients-view";
import { PricingView } from "../components/pricing-view";
import { NotificationsView } from "../components/notifications-view";
import { ProfileView } from "../components/profile-view";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<HomeStats | null>(null);
  const [rows, setRows] = useState<ClientRecord[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [resources, setResources] = useState<Resources | null>(null);
  const [cat, setCat] = useState<Catalog | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState<
    "Accueil" | "Planning" | "Clients" | "Ressources" | "Tarifs & offres" | "Notifications" | "Profil"
  >("Accueil");
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());
  const [activeFilters, setActiveFilters] = useState<string[]>(["confirmed", "completed"]);

  const toggleFilter = (id: string) => {
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const can = (p: string) => user?.permissions.includes(p) ?? false;

  const refresh = useCallback(async () => {
    const u = await api<User>("me");
    setUser(u);
    if (!u.permissions.includes("clients.read")) {
      setRows([]);
      setCat(null);
      setBookings([]);
      setResources(null);
      setSummary(null);
      return;
    }
    const [c, list, bList, resData, stats] = await Promise.all([
      api<Catalog>("catalog"),
      api<ClientRecord[]>("clients"),
      u.permissions.includes("schedule.read") ? api<Booking[]>("bookings") : Promise.resolve([]),
      u.permissions.includes("schedule.read") ? api<Resources>("resources") : Promise.resolve(null),
      api<HomeStats>("stats/summary"),
    ]);
    if (c) setCat(c);
    setRows(list);
    setBookings(bList);
    setResources(resData);
    setSummary(stats);
  }, []);

  useEffect(() => {
    const expired=()=>{setUser(null);setRows([]);setDetail(null);setCat(null);setResources(null);setBookings([]);setSummary(null);};
    window.addEventListener("gopermis-session-expired",expired);
    return ()=>window.removeEventListener("gopermis-session-expired",expired);
  },[]);

  useEffect(() => {
    refresh()
      .catch(async (e) => {
        if (
          e.message === "Connexion requise" ||
          e.message === "Session expirée"
        ) {
          try {
            setSetupRequired(
              (await api<{ required: boolean }>("setup")).required,
            );
          } catch (error) {
            setError((error as Error).message);
          }
        } else setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!user || !user.permissions.includes("clients.read")) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api<ClientRecord[]>("clients?q=" + encodeURIComponent(q))
        .then((v) => {
          if (!cancelled) setRows(v);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, user]);

  async function open(id: string) {
    setError("");
    setBusy(true);
    try {
      setDetail(await api<Detail>("clients/" + id));
      setView("Clients");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const values = Object.fromEntries(f);
      if (setupRequired) {
        await api("setup", values);
        setSetupRequired(false);
      }
      const res = await api<{ ok: boolean; token?: string; user?: User }>(
        "login",
        values,
      );
      if (res.user) {
        setUser(res.user);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className="loading" role="status">
        Chargement de GoPermis…
      </div>
    );

  if (!user)
    return (
      <div className="login">
        <form className="card" onSubmit={login}>
          <div className="brandMark">G</div>
          <p className="eyebrow">GOPERMIS · ESPACE ÉQUIPE</p>
          <h1>{setupRequired ? "Créer votre accès." : "Bienvenue."}</h1>
          <p>
            {setupRequired
              ? "Premier lancement de l’aperçu privé : créez votre compte administrateur."
              : "Connectez-vous à votre espace de travail."}
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {setupRequired && (
            <label>
              Nom affiché
              <input
                name="name"
                required
                maxLength={150}
                defaultValue="Administrateur GoPermis"
              />
            </label>
          )}
          <label>
            Identifiant
            <input
              name="identifiant"
              type="text"
              autoComplete="username"
              placeholder="ex: admin"
              defaultValue="admin"
              required
            />
          </label>
          <label>
            Mot de passe
            <input
              name="password"
              type="password"
              autoComplete={setupRequired ? "new-password" : "current-password"}
              minLength={setupRequired ? 14 : 1}
              maxLength={256}
              placeholder="••••••••••••••••"
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy
              ? "Connexion…"
              : setupRequired
                ? "Créer mon compte et me connecter"
                : "Se connecter"}
          </button>
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.5,
              color: "#334155",
              textAlign: "left",
            }}
          >
            Utilisez votre identifiant personnel et votre mot de passe.
          </div>
        </form>
      </div>
    );

  return (
    <div className="dualAppShell">
      {/* 1. Ultra-Slim Left Rail (Dock: 60px wide, vertically centered, no top logo, profile directly below) */}
      <aside className="dockRail">
        <nav className="dockNavStack">
          <button
            type="button"
            className={`dockIconBtn ${view === "Accueil" ? "active" : ""}`}
            onClick={() => {
              setView("Accueil");
              setDetail(null);
            }}
            title="Accueil & Tableau de bord"
          >
            <HomeIcon size={19} />
          </button>

          <button
            type="button"
            className={`dockIconBtn ${view === "Tarifs & offres" ? "active" : ""}`}
            onClick={() => {
              setView("Tarifs & offres");
              setDetail(null);
            }}
            title="Tarifs & Offres"
          >
            <WalletCards size={19} />
          </button>

          <button
            type="button"
            className={`dockIconBtn ${view === "Clients" ? "active" : ""}`}
            onClick={() => {
              setView("Clients");
              setDetail(null);
            }}
            title="Clients & Dossiers"
          >
            <Users size={19} />
          </button>

          <button
            type="button"
            className={`dockIconBtn ${view === "Planning" ? "active" : ""}`}
            onClick={() => {
              setView("Planning");
              setDetail(null);
            }}
            title="Planning & Calendrier"
          >
            <CalendarDays size={19} />
          </button>

          <button
            type="button"
            className={`dockIconBtn ${view === "Ressources" ? "active" : ""}`}
            onClick={() => {
              setView("Ressources");
              setDetail(null);
            }}
            title="Véhicules & Moniteurs"
          >
            <Car size={19} />
          </button>

          <button
            type="button"
            className={`dockIconBtn ${view === "Notifications" ? "active" : ""}`}
            onClick={() => {
              setView("Notifications");
              setDetail(null);
            }}
            title="Notifications"
          >
            <Bell size={19} />
          </button>

          {/* User Profile Avatar directly beneath icons in the centered stack */}
          <div
            className={`dockUserAvatar ${view === "Profil" ? "active" : ""}`}
            title={`${user.name} (Gérer mon profil)`}
            onClick={() => {
              setView("Profil");
              setDetail(null);
            }}
          >
            <span>{user.name.slice(0, 2).toUpperCase()}</span>
            <div className="dockStatusDot" />
          </div>

          {/* Discrete Logout Button */}
          <button
            type="button"
            className="dockIconBtn"
            title="Se déconnecter"
            onClick={async () => {
              try {
                await api("logout", {});
                setUser(null);
                setDetail(null);
                setRows([]);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LogOut size={16} />
          </button>
        </nav>
      </aside>

      {/* 2. Secondary Sidebar Panel (Only in Planning view matching reference image) */}
      {view === "Planning" && (
        <CalendarSidebar
          selectedDate={selectedCalendarDate}
          onSelectDate={(d) => setSelectedCalendarDate(d)}
          activeFilters={activeFilters}
          onToggleFilter={toggleFilter}
          stats={{manualVehicles:resources?.vehicles.filter(v=>v.active && v.model_id==="clio-manual").length ?? 0,autoVehicles:resources?.vehicles.filter(v=>v.active && v.model_id!=="clio-manual").length ?? 0}}
        />
      )}

      {/* 3. Main Content Viewport */}
      <main className={`mainAppContent ${view !== "Planning" ? "fullWidthView" : ""}`}>
        <div className="content" style={{ padding: 0 }}>
          {error && (
            <div role="alert" className="calendarAlert errorAlert">
              <span>{error}</span>
              <button onClick={() => setError("")}>×</button>
            </div>
          )}

          {/* VIEW: ACCUEIL / DASHBOARD */}
          {view === "Accueil" && (
            <Dashboard
              user={user}
              summary={summary}
              clients={rows}
              bookings={bookings}
              resources={resources}
              onNavigate={(v) => {
                setView(v as typeof view);
                setDetail(null);
              }}
              onNewClient={() => setCreate(true)}
              onNewBooking={() => {
                setView("Planning");
              }}
            />
          )}

          {/* VIEW: PLANNING / CALENDAR */}
          {view === "Planning" && can("schedule.read") && (
            <Schedule
              can={can}
              selectedDate={selectedCalendarDate}
              onDateChange={setSelectedCalendarDate}
              activeFilters={activeFilters}
              reload={refresh}
            />
          )}

          {/* VIEW: CLIENTS */}
          {view === "Clients" &&
            can("clients.read") &&
            (detail && cat ? (
              <div style={{ padding: "32px 40px" }}>
                <ClientDetail
                  detail={detail}
                  cat={cat}
                  can={can}
                  back={() => setDetail(null)}
                  reload={() => open(detail.client.id)}
                  onError={setError}
                />
              </div>
            ) : (
              <ClientsView
                clients={rows}
                q={q}
                onSearchChange={setQ}
                onSelectClient={open}
                onNewClient={() => setCreate(true)}
                onRefresh={refresh}
                can={can}
              />
            ))}

          {/* VIEW: RESSOURCES (VEHICULES & MONITEURS) */}
          {view === "Ressources" && cat && can("schedule.read") && (
            <ResourceSettings can={can} cat={cat} />
          )}

          {/* VIEW: TARIFS & OFFRES (EDITABLE) */}
          {view === "Tarifs & offres" && cat && (
            <PricingView cat={cat} can={can} onRefresh={refresh} />
          )}

          {/* VIEW: NOTIFICATIONS */}
          {view === "Notifications" && <NotificationsView />}

          {/* VIEW: PROFIL */}
          {view === "Profil" && (
            <ProfileView
              user={user}
              onUserUpdate={(updated) => setUser(updated)}
              onLogout={async () => {
                try {
                  await api("logout", {});
                  setUser(null);
                  setDetail(null);
                  setRows([]);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          )}
        </div>
      </main>

      {/* New Client Modal */}
      {create && (
        <Modal title="Nouveau client" close={() => setCreate(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                const c = await api<ClientRecord>(
                  "clients",
                  Object.fromEntries(f),
                );
                await refresh();
                await open(c.id);
                setCreate(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="formGrid">
              <label>
                Prénom
                <input name="firstName" required maxLength={100} autoFocus placeholder="ex: Lucas" />
              </label>
              <label>
                Nom
                <input name="lastName" required maxLength={100} placeholder="ex: Dubois" />
              </label>
            </div>
            <label>
              Téléphone
              <input
                name="phone"
                type="tel"
                required
                minLength={6}
                maxLength={30}
                placeholder="ex: 06 12 34 56 78"
              />
            </label>
            <label>
              Email (facultatif)
              <input name="email" type="email" placeholder="ex: lucas.dubois@email.fr" />
            </label>
            <label>
              Origine
              <input
                name="source"
                defaultValue="Saisie manuelle"
                maxLength={100}
              />
            </label>
            <p className="helperText" style={{ margin: "10px 0 16px" }}>
              La prestation et la formule (Boîte manuelle, boîte automatique ou RS3) pourront être ajoutées directement depuis la fiche client.
            </p>
            <div className="modalButtonsRow">
              <button
                type="button"
                className="btnSecondary"
                onClick={() => setCreate(false)}
              >
                Annuler
              </button>
              <button className="btnPrimary" disabled={busy}>
                {busy ? "Création…" : "Créer la fiche"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
