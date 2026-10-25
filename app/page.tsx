"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Plus,
  Search,
  LogOut,
  Menu,
  X,
  ChevronRight,
  LayoutDashboard,
  Car,
  WalletCards,
  Calendar,
  Zap,
  TrendingUp,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  api,
  type User,
  type Catalog,
  type ClientRecord,
  type ClientPage,
  type Detail,
} from "../lib/api-types";
import { AuthGate } from "../components/auth-gate";
import { AccountSettings } from "../components/account-settings";
import { clearPreviewSession } from "../lib/session";
import { Modal } from "../components/modal";
import { Schedule } from "../components/schedule";
import { ResourceSettings } from "../components/resources";
import { ClientFields } from "../components/client-fields";
import { ClientDetail } from "../components/client-detail";

const money = (n: number) =>
  (n / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default function Home() {
  const [user, setUser] = useState<User | null>(null),
    [accountOpen, setAccountOpen] = useState(false),
    [error, setError] = useState(""),
    [rows, setRows] = useState<ClientRecord[]>([]),
    [cat, setCat] = useState<Catalog | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [displayedPage, setDisplayedPage] = useState(1),
    [pages, setPages] = useState(0),
    [total, setTotal] = useState(0),
    [filter, setFilter] = useState(""),
    [listLoading, setListLoading] = useState(false),
    [revision, setRevision] = useState(0),
    [view, setView] = useState("Clients"),
    [side, setSide] = useState(false),
    [create, setCreate] = useState(false),
    [busy, setBusy] = useState(false);

  const can = (p: string) => user?.permissions.includes(p) ?? false;

  const refresh = useCallback(async () => {
    const u = await api<User>("me");
    setUser(u);
    if (!u.permissions.includes("clients.read")) {
      setRows([]);
      setCat(null);
      return;
    }
    setCat(await api<Catalog>("catalog"));
  }, []);

  useEffect(() => {
    if (user?.id) refresh().catch((e) => setError(e.message));
  }, [user?.id, refresh]);

  useEffect(() => {
    const expired = () => {
      setUser(null);
      setDetail(null);
      setRows([]);
    };
    window.addEventListener("gopermis-session-expired", expired);
    return () =>
      window.removeEventListener("gopermis-session-expired", expired);
  }, []);

  const canRead = user?.permissions.includes("clients.read") ?? false;
  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    setListLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q,
        page: String(page),
        pageSize: "25",
        ...(filter ? { status: filter } : {}),
      });
      api<ClientPage>("clients/search?" + params)
        .then((result) => {
          if (!cancelled) {
            setRows(result.items);
            setTotal(result.total);
            setPages(result.pages);
            setDisplayedPage(result.page);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        })
        .finally(() => {
          if (!cancelled) setListLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, page, filter, canRead, user?.id, revision]);

  async function open(id: string) {
    setError("");
    setBusy(true);
    try {
      setDetail(await api<Detail>("clients/" + id));
      setRevision((n) => n + 1);
      setView("Clients");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return <AuthGate onAuthenticated={setUser} />;

  return (
    <div className="appShell">
      <aside className={"sidebar " + (side ? "open" : "")}>
        <div className="brand">
          <div className="brandMark">G</div>
          <div>
            <strong>GoPermis</strong>
            <span>Espace Direction</span>
          </div>
          <button
            aria-label="Fermer le menu"
            className="mobileClose"
            onClick={() => setSide(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav>
          {(
            [
              ["Clients", Users],
              ["Tarifs & offres", WalletCards],
              ...(can("schedule.read")
                ? ([
                    ["Planning", Calendar],
                    ["Ressources", Car],
                  ] as const)
                : []),
              ["Avancement", LayoutDashboard],
            ] as const
          ).map(([label, Icon]) => (
            <button
              key={String(label)}
              className={view === label ? "active" : ""}
              onClick={() => {
                setView(String(label));
                setDetail(null);
                setSide(false);
              }}
            >
              <Icon size={18} />
              <span>{String(label)}</span>
            </button>
          ))}
        </nav>
        <div className="navBottom">
          <p className="emptyHint">
            GoPermis CRM · Édition Pro
            <br />
            Synchronisation locale active
          </p>
        </div>
        <button className="accountButton" onClick={() => setAccountOpen(true)}>
          Mon compte · Sécurité
        </button>
        <div className="profile">
          <div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{user.name}</strong>
            <span>Accès sécurisé</span>
          </div>
          <button
            aria-label="Se déconnecter"
            onClick={async () => {
              try {
                await api("auth/logout", {});
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
        </div>
      </aside>
      {side && <div className="overlay" onClick={() => setSide(false)} />}
      <main>
        <header>
          <button
            className="menu"
            aria-label="Ouvrir le menu"
            onClick={() => setSide(true)}
          >
            <Menu size={20} />
          </button>
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Rechercher un client"
              placeholder="Rechercher un élève par nom, téléphone, email..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
                setDetail(null);
                setView("Clients");
              }}
            />
            <kbd>⌘K</kbd>
          </div>
          <div className="headActions">
            {can("clients.write") && (
              <button className="primary" onClick={() => setCreate(true)}>
                <Plus size={16} /> Nouveau client
              </button>
            )}
          </div>
        </header>

        <div className="content">
          {error && (
            <div role="alert" className="error">
              <span>{error}</span>
              <button onClick={() => setError("")}>Fermer</button>
            </div>
          )}

          {busy && <p role="status" style={{ color: "#ea580c", fontWeight: 600, fontSize: 13 }}>Chargement en cours…</p>}

          {view === "Clients" && !can("clients.read") && (
            <section className="card" style={{ padding: 32 }}>
              <h1>Accès restreint</h1>
              <p>
                Votre compte n’a pas encore de droit d’accès aux dossiers
                clients. Contactez l’administrateur.
              </p>
            </section>
          )}

          {view === "Clients" &&
            can("clients.read") &&
            (detail && cat ? (
              <ClientDetail
                detail={detail}
                cat={cat}
                can={can}
                back={() => setDetail(null)}
                reload={() => open(detail.client.id)}
                onError={setError}
              />
            ) : (
              <>
                {/* Modern Personalized Greeting Hero (Image 2 Inspired) */}
                <section className="hero">
                  <div>
                    <p className="eyebrow">TABLEAU DE BORD · GOPERMIS</p>
                    <h1>Bonjour, {user.name} !</h1>
                    <p>
                      Pilotez les élèves, séances de conduite et véhicules en temps réel.
                    </p>
                  </div>
                  <span
                    className="statusPill"
                    style={{
                      background: "#ecfdf5",
                      color: "#059669",
                      borderColor: "#a7f3d0",
                      padding: "6px 14px",
                    }}
                  >
                    ● Auto-école opérationnelle
                  </span>
                </section>

                {/* Bento KPI Strip */}
                <div className="bentoStats">
                  <div className="bentoCard">
                    <div className="bentoCardHeader">
                      <div className="bentoIcon orange">
                        <Users size={20} />
                      </div>
                      <span className="bentoBadge">Dossiers</span>
                    </div>
                    <div>
                      <h3>{total}</h3>
                      <p>Élèves inscrits</p>
                    </div>
                    <small>
                      <strong>{rows.filter((r) => r.status === "Actif").length}</strong> en formation active
                    </small>
                  </div>

                  <div className="bentoCard">
                    <div className="bentoCardHeader">
                      <div className="bentoIcon blue">
                        <Calendar size={20} />
                      </div>
                      <span className="bentoBadge">Planning</span>
                    </div>
                    <div>
                      <h3>Conduite</h3>
                      <p>Séances & moniteurs</p>
                    </div>
                    <small>
                      Créneaux synchronisés 24/7
                    </small>
                  </div>

                  <div className="bentoCard">
                    <div className="bentoCardHeader">
                      <div className="bentoIcon emerald">
                        <TrendingUp size={20} />
                      </div>
                      <span className="bentoBadge">Forfaits</span>
                    </div>
                    <div>
                      <h3>{cat?.offers?.length ?? 2} Offres</h3>
                      <p>Grille tarifaire active</p>
                    </div>
                    <small>
                      <strong>Forfaits 20h, 30h & bonus</strong>
                    </small>
                  </div>

                  <div className="bentoCard">
                    <div className="bentoCardHeader">
                      <div className="bentoIcon purple">
                        <Car size={20} />
                      </div>
                      <span className="bentoBadge">Flotte</span>
                    </div>
                    <div>
                      <h3>{cat?.models?.length ?? 3} Modèles</h3>
                      <p>Véhicules disponibles</p>
                    </div>
                    <small>
                      Manuelle & automatique
                    </small>
                  </div>
                </div>

                {/* Fast Commands Bar (from Image 2) */}
                <div className="fastCommands">
                  <div className="fastCommandsIntro">
                    <div className="bentoIcon orange" style={{ width: 36, height: 36 }}>
                      <Zap size={18} />
                    </div>
                    <div>
                      <strong>Actions rapides</strong>
                      <span>Accès direct aux fonctionnalités clés</span>
                    </div>
                  </div>
                  <div className="fastCommandsList">
                    {can("clients.write") && (
                      <button className="fastCmdBtn" onClick={() => setCreate(true)}>
                        <Plus size={15} /> Nouveau dossier élève
                      </button>
                    )}
                    {can("schedule.read") && (
                      <button
                        className="fastCmdBtn"
                        onClick={() => {
                          setView("Planning");
                          setDetail(null);
                        }}
                      >
                        <Calendar size={15} /> Consulter le planning
                      </button>
                    )}
                    {can("schedule.read") && (
                      <button
                        className="fastCmdBtn"
                        onClick={() => {
                          setView("Ressources");
                          setDetail(null);
                        }}
                      >
                        <Car size={15} /> Flotte & moniteurs
                      </button>
                    )}
                    <button
                      className="fastCmdBtn"
                      onClick={() => {
                        setView("Tarifs & offres");
                        setDetail(null);
                      }}
                    >
                      <WalletCards size={15} /> Grille tarifaire
                    </button>
                  </div>
                </div>

                {/* Client Directory Card */}
                <section className="card clientList">
                  <div className="listHeader">
                    <div>
                      <strong>Annuaire des élèves</strong>
                      <span style={{ marginLeft: 8, fontSize: 13, color: "#64748b" }}>
                        · {total} dossier{total > 1 ? "s" : ""}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {["", "Prospect", "Actif", "Terminé", "Archivé"].map((st) => (
                        <button
                          key={st}
                          onClick={() => {
                            setFilter(st);
                            setPage(1);
                          }}
                          style={{
                            border: "1px solid",
                            borderColor: filter === st ? "#ea580c" : "#e2e8f0",
                            background: filter === st ? "#fff7ed" : "#ffffff",
                            color: filter === st ? "#ea580c" : "#475569",
                            fontWeight: filter === st ? 700 : 500,
                            padding: "6px 14px",
                            borderRadius: 999,
                            fontSize: 12.5,
                          }}
                        >
                          {st || "Tous"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {listLoading && (
                    <p role="status" className="listLoading">
                      Recherche des dossiers en cours…
                    </p>
                  )}

                  {rows.length === 0 ? (
                    <div className="emptyState">
                      <Users size={40} />
                      <h2>
                        {q
                          ? "Aucun élève trouvé"
                          : "Aucun dossier élève pour le moment"}
                      </h2>
                      <p>
                        {q
                          ? "Vérifiez l'orthographe du nom, email ou numéro de téléphone."
                          : "Créez une première fiche élève pour enregistrer un forfait et planifier des heures de conduite."}
                      </p>
                      {!q && can("clients.write") && (
                        <button
                          className="primary"
                          onClick={() => setCreate(true)}
                        >
                          <Plus size={16} /> Créer un premier élève
                        </button>
                      )}
                    </div>
                  ) : (
                    rows.map((c) => (
                      <button
                        className="clientRow"
                        key={c.id}
                        onClick={() => open(c.id)}
                      >
                        <div className="avatar soft">
                          {c.first_name[0]}
                          {c.last_name[0]}
                        </div>
                        <div className="identity">
                          <b>
                            {c.first_name} {c.last_name}
                          </b>
                          <span>{c.phone || "Téléphone non renseigné"}</span>
                        </div>
                        <div className="desktopCell">
                          <span>Contact Email</span>
                          <b>{c.email || "Non communiqué"}</b>
                        </div>
                        <div>
                          <span
                            className="statusPill"
                            data-status={c.status}
                          >
                            {c.status}
                          </span>
                        </div>
                        <ChevronRight size={18} />
                      </button>
                    ))
                  )}

                  <div className="pagination">
                    <button
                      disabled={page <= 1 || listLoading}
                      onClick={() => setPage((n) => n - 1)}
                    >
                      ← Page précédente
                    </button>
                    <span role="status">
                      {total === 0
                        ? "0 résultat"
                        : `Page ${displayedPage} sur ${Math.max(1, pages)} · 25 par page`}
                    </span>
                    <button
                      disabled={page >= pages || listLoading}
                      onClick={() => setPage((n) => n + 1)}
                    >
                      Page suivante →
                    </button>
                  </div>
                </section>
              </>
            ))}

          {view === "Planning" && can("schedule.read") && (
            <Schedule can={can} />
          )}

          {view === "Ressources" && cat && can("schedule.read") && (
            <ResourceSettings can={can} cat={cat} />
          )}

          {view === "Tarifs & offres" && cat && (
            <>
              <section className="hero">
                <div>
                  <p className="eyebrow">CATALOGUE AUTO-ÉCOLE</p>
                  <h1>Tarifs & forfaits</h1>
                  <p>
                    Historique conservé · Les forfaits vendus conservent leur prix accepté.
                  </p>
                </div>
              </section>

              <div className="detailGrid">
                {cat.models.map((m) => (
                  <section className="card" key={m.id} style={{ padding: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div className="bentoIcon purple" style={{ width: 36, height: 36 }}>
                        <Car size={18} />
                      </div>
                      <h2 style={{ margin: 0, fontSize: 16 }}>{m.label}</h2>
                    </div>
                    {cat.rates
                      .filter((r) => r.model === m.id)
                      .map((r) => (
                        <div
                          key={r.id}
                          style={{
                            background: "#f8fafc",
                            padding: "12px 14px",
                            borderRadius: 12,
                            marginTop: 10,
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>{r.support}</span>
                            <strong style={{ fontSize: 16, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                              {money(r.cents)}/h
                            </strong>
                          </div>
                          <small style={{ color: "#94a3b8", fontSize: 11, marginTop: 4, display: "block" }}>
                            Tarif en vigueur depuis le {r.validFrom}
                          </small>
                        </div>
                      ))}
                    {m.id === "rs3" && (
                      <small style={{ color: "#ea580c", marginTop: 8, display: "block", fontWeight: 600 }}>
                        Accompagnement GoPermis réservé.
                      </small>
                    )}
                  </section>
                ))}

                {cat.offers.map((o) => (
                  <section className="card" key={o.id} style={{ padding: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div className="bentoIcon emerald" style={{ width: 36, height: 36 }}>
                        <Sparkles size={18} />
                      </div>
                      <h2 style={{ margin: 0, fontSize: 16 }}>{o.label}</h2>
                    </div>
                    <div
                      style={{
                        background: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        padding: "14px 16px",
                        borderRadius: 14,
                        color: "#065f46",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {o.paidMinutes / 60} h de conduite + {o.bonusMinutes / 60} h offerte
                    </div>
                    <small style={{ color: "#64748b", marginTop: 10, display: "block", fontSize: 12 }}>
                      Bonus crédité après règlement intégral du forfait.
                    </small>
                  </section>
                ))}
              </div>
            </>
          )}

          {view === "Avancement" && (
            <section className="card" style={{ padding: 36 }}>
              <p className="eyebrow">SYSTÈME & CONFORMITÉ</p>
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: "4px 0 16px" }}>
                Panel Administratif GoPermis
              </h1>
              <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, maxWidth: 680 }}>
                Votre plateforme centralise l&apos;intégralité des flux : gestion des dossiers élèves, validation des forfaits d&apos;heures, paiements reçus, planning synchronisé des moniteurs et véhicules, avec un contrôle strict des disponibilités.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 24 }}>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#059669", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                    <CheckCircle2 size={16} /> Base PostgreSQL & PGlite
                  </div>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Migrations 001 à 005 appliquées</span>
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#059669", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                    <CheckCircle2 size={16} /> Planning anti-conflits
                  </div>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Réservations moniteurs & véhicules</span>
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#059669", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                    <CheckCircle2 size={16} /> Audit & Traçabilité
                  </div>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Journal immuable des actions</span>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {accountOpen && (
        <AccountSettings
          close={() => setAccountOpen(false)}
          done={() => {
            setAccountOpen(false);
            setUser(null);
            setRows([]);
            setDetail(null);
          }}
        />
      )}

      {create && (
        <Modal title="Nouveau dossier client" close={() => setCreate(false)}>
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
            <ClientFields />
            <p style={{ fontSize: 12.5, color: "#64748b", margin: "14px 0" }}>
              Le forfait et les séances de conduite pourront être configurés directement depuis la fiche élève.
            </p>
            <button className="primary" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
              Créer la fiche élève
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
