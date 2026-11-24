"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Home as HomeIcon,
  Users,
  LogOut,
  CalendarDays,
  HardDrive,
  Database,
  ShieldCheck,
  MoreHorizontal,
  X,
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
import { clearPreviewSession } from "../lib/session";
import { Modal } from "../components/modal";
import { Dashboard } from "../components/dashboard";
import { Schedule } from "../components/schedule";
import { CalendarSidebar } from "../components/calendar-sidebar";
import { ClientDetail } from "../components/client-detail";
import { ClientsView } from "../components/clients-view";
import { ProfileView } from "../components/profile-view";
import { DriveView } from "../components/drive-view";
import { DonneesView } from "../components/donnees-view";
import { ThemeToggle } from "../components/theme-toggle";
import { AuthGate } from "../components/auth-gate";
import { AdminPanel } from "../components/admin-panel";
import { ForcePasswordChange } from "../components/force-password";
import { useApp } from "../components/app-context";
import { CategorySelect } from "../components/client-fields";
import { CommandPalette, type PaletteAction } from "../components/command-palette";
import { Plus, UserCircle2 } from "lucide-react";

export default function Home() {
  const { refreshUser: refreshContextUser } = useApp();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<HomeStats | null>(null);
  const [rows, setRows] = useState<ClientRecord[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [resources, setResources] = useState<Resources | null>(null);
  const [cat, setCat] = useState<Catalog | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState<
    "Accueil" | "Planning" | "Clients" | "Drive" | "Donnees" | "Profil" | "AdminPanel"
  >("Accueil");
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());
  const [moreOpen, setMoreOpen] = useState(false);
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
    void refreshContextUser();
    if (u.mustChangePassword) return;
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
  }, [refreshContextUser]);

  useEffect(() => {
    const expired=()=>{setUser(null);setRows([]);setDetail(null);setCat(null);setResources(null);setBookings([]);setSummary(null);};
    window.addEventListener("gopermis-session-expired",expired);
    return ()=>window.removeEventListener("gopermis-session-expired",expired);
  },[]);

  useEffect(() => {
    refresh()
      .catch((e) => {
        if (
          e.message !== "Connexion requise" &&
          e.message !== "Session expirée"
        ) {
          setError(e.message);
        }
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

  if (loading)
    return (
      <div className="loading" role="status">
        Chargement de GoPermis…
      </div>
    );

  if (!user) {
    return (
      <AuthGate
        onAuthenticated={(u) => {
          setUser(u);
          void refresh();
        }}
      />
    );
  }

  if (user.mustChangePassword) {
    return (
      <ForcePasswordChange
        user={user}
        onDone={(u) => {
          setUser(u);
          void refresh();
        }}
      />
    );
  }
  const isAdmin = Boolean(
    user.permissions?.includes("admin.full") ||
    user.permissions?.includes("users.manage") ||
    user.permissions?.includes("technical_admin") ||
    user.roles?.includes("technical_admin") ||
    user.roles?.includes("admin")
  );

  const go = (v: typeof view) => () => {
    setView(v);
    setDetail(null);
  };
  const paletteActions: PaletteAction[] = [
    { id: "nav-home", label: "Tableau de bord", icon: HomeIcon, keywords: "accueil", run: go("Accueil") },
    ...(can("schedule.read")
      ? [{ id: "nav-planning", label: "Planning", icon: CalendarDays, keywords: "calendrier seances agenda", run: go("Planning") }]
      : []),
    { id: "nav-clients", label: "Élèves & dossiers", icon: Users, keywords: "clients eleves", run: go("Clients") },
    { id: "nav-drive", label: "Drive", icon: HardDrive, keywords: "documents fichiers", run: go("Drive") },
    { id: "nav-data", label: "Données : tarifs & véhicules", icon: Database, keywords: "tarifs vehicules moniteurs", run: go("Donnees") },
    { id: "nav-profile", label: "Mon profil", icon: UserCircle2, keywords: "compte parametres mot de passe", run: go("Profil") },
    ...(isAdmin
      ? [{ id: "nav-admin", label: "Panel admin", icon: ShieldCheck, keywords: "utilisateurs roles permissions", run: go("AdminPanel") }]
      : []),
    ...(can("clients.write")
      ? [{ id: "new-client", label: "Nouveau client", icon: Plus, keywords: "ajouter eleve creer", run: () => setCreate(true) }]
      : []),
  ];

  return (
    <div className="dualAppShell">
      <CommandPalette actions={paletteActions} onOpenClient={(id) => void open(id)} canSearchClients={can("clients.read")} />
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
            className={`dockIconBtn ${view === "Drive" ? "active" : ""}`}
            onClick={() => {
              setView("Drive");
              setDetail(null);
            }}
            title="Drive & Documents"
          >
            <HardDrive size={19} />
          </button>

          <button
            type="button"
            className={`dockIconBtn ${view === "Donnees" ? "active" : ""}`}
            onClick={() => {
              setView("Donnees");
              setDetail(null);
            }}
            title="Données (Tarifs & Véhicules)"
          >
            <Database size={19} />
          </button>



          {/* User Profile Avatar directly beneath icons */}
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
        </nav>

        {/* Bottom container: Anchored at the very bottom, separated from the rest */}
        <div className="dockBottom">
          <button
            type="button"
            className="dockIconBtn"
            title="Se déconnecter"
            onClick={async () => {
              try {
                await api("logout", {});
                clearPreviewSession();
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

          {/* Sun / Moon Theme Switcher at the very bottom of the rail */}
          <ThemeToggle compact />
        </div>
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

          {/* VIEW: DRIVE & DOCUMENTS */}
          {view === "Drive" && (
            <div style={{ padding: "16px 20px 16px 6px", width: "100%", boxSizing: "border-box", alignSelf: "stretch" }}>
              <DriveView />
            </div>
          )}

          {/* VIEW: DONNÉES (COMBINÉ TARIFS & RESSOURCES) */}
          {view === "Donnees" && (
            <div style={{ padding: "28px 36px" }}>
              <DonneesView cat={cat} can={can} onRefresh={refresh} />
            </div>
          )}

          {/* VIEW: PROFIL */}
          {view === "Profil" && (
            <ProfileView
              user={user}
              onUserUpdate={(updated) => setUser(updated)}
              onLogout={async () => {
                try {
                  await api("logout", {});
                  clearPreviewSession();
                  setUser(null);
                  setDetail(null);
                  setRows([]);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          )}

          {/* VIEW: ADMIN PANEL */}
          {view === "AdminPanel" && isAdmin && (
            <AdminPanel
              currentUser={user}
              onBackToDashboard={() => setView("Accueil")}
            />
          )}
        </div>
      </main>

      {/* Barre d'onglets mobile */}
      <nav className="mTabBar" aria-label="Navigation principale">
        {(
          [
            ["Accueil", HomeIcon, "Accueil"],
            ["Planning", CalendarDays, "Planning"],
            ["Clients", Users, "Élèves"],
            ["Drive", HardDrive, "Drive"],
          ] as const
        ).map(([v, Icon, label]) => (
          <button
            key={v}
            type="button"
            className={view === v ? "active" : ""}
            onClick={() => {
              setView(v);
              setDetail(null);
              setMoreOpen(false);
            }}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
        <button type="button" className={moreOpen || ["Donnees", "Profil", "AdminPanel"].includes(view) ? "active" : ""} onClick={() => setMoreOpen((o) => !o)}>
          <MoreHorizontal size={21} />
          <span>Plus</span>
        </button>
      </nav>
      {moreOpen && (
        <div className="mSheetBackdrop" onClick={() => setMoreOpen(false)}>
          <div className="mSheet" onClick={(e) => e.stopPropagation()}>
            <div className="mSheetHead">
              <div className="mSheetUser">
                <span>{user.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
              </div>
              <button type="button" aria-label="Fermer" onClick={() => setMoreOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {(
              [
                ["Profil", UserCircle2, "Mon profil", true],
                ["Donnees", Database, "Tarifs & véhicules", true],
                ["AdminPanel", ShieldCheck, "Panel admin", isAdmin],
              ] as const
            )
              .filter((x) => x[3])
              .map(([v, Icon, label]) => (
                <button
                  key={v}
                  type="button"
                  className="mSheetItem"
                  onClick={() => {
                    setView(v);
                    setDetail(null);
                    setMoreOpen(false);
                  }}
                >
                  <Icon size={19} /> {label}
                </button>
              ))}
            <div className="mSheetItem mSheetAccent">
              <ThemeToggle compact /> Couleur de l&apos;interface
            </div>
            <button
              type="button"
              className="mSheetItem danger"
              onClick={async () => {
                setMoreOpen(false);
                try {
                  await api("logout", {});
                  clearPreviewSession();
                  setUser(null);
                  setDetail(null);
                  setRows([]);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut size={19} /> Se déconnecter
            </button>
          </div>
        </div>
      )}

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
            <CategorySelect />
            <label>
              Adresse
              <input name="address" maxLength={255} placeholder="ex: 2 rue Colette 31200 Toulouse" />
            </label>
            <div className="formGrid">
              <label>
                Date de naissance
                <input name="birthDate" type="date" />
              </label>
              <label>
                NEPH (facultatif)
                <input name="neph" maxLength={20} pattern="[0-9A-Za-z ]{6,20}" placeholder="N° de dossier permis" />
              </label>
            </div>
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
