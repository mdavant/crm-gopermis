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
} from "lucide-react";
import {
  api,
  type User,
  type Catalog,
  type ClientRecord,
  type Detail,
} from "../lib/api-types";
import { AuthGate } from "../components/auth-gate";
import { AccountSettings } from "../components/account-settings";
import { clearPreviewSession } from "../lib/session";
import { Modal } from "../components/modal";
import { Schedule } from "../components/schedule";
import { ResourceSettings } from "../components/resources";
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
    const [c, list] = await Promise.all([
      api<Catalog>("catalog"),
      api<ClientRecord[]>("clients"),
    ]);
    setCat(c);
    setRows(list);
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
  if (!user) return <AuthGate onAuthenticated={setUser} />;
  return (
    <div className="appShell">
      <aside className={"sidebar " + (side ? "open" : "")}>
        <div className="brand">
          <div className="brandMark">G</div>
          <div>
            <strong>GoPermis</strong>
            <span>Control Center</span>
          </div>
          <button
            aria-label="Fermer le menu"
            className="mobileClose"
            onClick={() => setSide(false)}
          >
            <X />
          </button>
        </div>
        <nav>
          {(
            [
              ["Clients", Users],
              ["Tarifs & offres", WalletCards],
              ...(can("schedule.read")
                ? ([
                    ["Planning", Car],
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
              <Icon size={19} />
              <span>{String(label)}</span>
            </button>
          ))}
        </nav>
        <div className="navBottom">
          <p className="emptyHint">
            Cœur CRM · Version 0.3
            <br />
            Google et WhatsApp non connectés
          </p>
        </div>
        <button className="accountButton" onClick={() => setAccountOpen(true)}>
          Mon compte · mot de passe
        </button>
        <div className="profile">
          <div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{user.name}</strong>
            <span>Espace sécurisé</span>
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
            <LogOut size={18} />
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
            <Menu />
          </button>
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Rechercher un client"
              placeholder="Nom, téléphone, email ou identifiant…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setDetail(null);
                setView("Clients");
              }}
            />
          </div>
          {can("clients.write") && (
            <button className="primary" onClick={() => setCreate(true)}>
              <Plus size={18} /> Nouveau client
            </button>
          )}
        </header>
        <div className="content">
          {error && (
            <div role="alert" className="error">
              {error}
              <button onClick={() => setError("")}>Fermer</button>
            </div>
          )}
          {busy && <p role="status">Chargement…</p>}
          {view === "Clients" && !can("clients.read") && (
            <section className="card">
              <h1>Connexion réussie</h1>
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
                <section className="hero">
                  <div>
                    <p className="eyebrow">RELATIONS & SUIVI</p>
                    <h1>Clients</h1>
                    <p>
                      Chaque personne, toutes ses prestations. Un seul dossier.
                    </p>
                  </div>
                  <span className="statusPill">Données enregistrées</span>
                </section>
                <section className="card clientList">
                  <div className="listHeader">
                    <span>
                      {rows.length} résultat{rows.length > 1 ? "s" : ""}
                    </span>
                    <small>100 résultats maximum · affinez la recherche</small>
                  </div>
                  {rows.length === 0 ? (
                    <div className="emptyState">
                      <Users size={36} />
                      <h2>
                        {q
                          ? "Aucun résultat"
                          : "Votre premier client commence ici"}
                      </h2>
                      <p>
                        {q
                          ? "Essayez un autre nom ou numéro."
                          : "Créez une fiche, puis ajoutez une prestation et son forfait."}
                      </p>
                      {!q && can("clients.write") && (
                        <button
                          className="primary"
                          onClick={() => setCreate(true)}
                        >
                          Créer un client
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
                          <span>{c.phone}</span>
                        </div>
                        <div className="desktopCell">
                          <span>Email</span>
                          <b>{c.email || "À renseigner"}</b>
                        </div>
                        <span className="statusPill">{c.status}</span>
                        <ChevronRight size={18} />
                      </button>
                    ))
                  )}
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
                  <p className="eyebrow">CATALOGUE GOPERMIS</p>
                  <h1>Tarifs & offres</h1>
                  <p>
                    Versions conservées en base · les prestations gardent leur
                    prix accepté.
                  </p>
                </div>
              </section>
              <div className="detailGrid">
                {cat.models.map((m) => (
                  <section className="card" key={m.id}>
                    <Car />
                    <h2>{m.label}</h2>
                    {cat.rates
                      .filter((r) => r.model === m.id)
                      .map((r) => (
                        <p key={r.id}>
                          {r.support} <strong>{money(r.cents)}/h</strong>
                          <br />
                          <small>Depuis le {r.validFrom}</small>
                        </p>
                      ))}
                    {m.id === "rs3" && (
                      <small>Accompagnement GoPermis uniquement.</small>
                    )}
                  </section>
                ))}
                {cat.offers.map((o) => (
                  <section className="card" key={o.id}>
                    <h2>{o.label}</h2>
                    <p>
                      {o.paidMinutes / 60} h payées + {o.bonusMinutes / 60} h
                      offertes.
                    </p>
                    <small>
                      Bonus attribué après paiement intégral en une fois.
                    </small>
                  </section>
                ))}
              </div>
            </>
          )}
          {view === "Avancement" && (
            <section className="card">
              <p className="eyebrow">CONSTRUCTION DU CRM</p>
              <h1>Un socle connecté.</h1>
              <p>
                Clients, prestations, tarifs, paiements, notes et journal
                d’heures sont centralisés dans votre espace.
              </p>
              <p>
                Planning, réservations et réalisation des séances sont
                disponibles selon vos droits. À venir : documents,
                administration des tarifs et des utilisateurs, intégrations
                Google et WhatsApp.
              </p>
              <p>
                Les écrans fictifs de la V1 ont été retirés de la navigation
                opérationnelle.
              </p>
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
                <input name="firstName" required maxLength={100} autoFocus />
              </label>
              <label>
                Nom
                <input name="lastName" required maxLength={100} />
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
              />
            </label>
            <label>
              Email (facultatif)
              <input name="email" type="email" />
            </label>
            <label>
              Origine
              <input
                name="source"
                defaultValue="Saisie manuelle"
                maxLength={100}
              />
            </label>
            <p>La prestation pourra être ajoutée depuis la fiche client.</p>
            <button className="primary" disabled={busy}>
              Créer la fiche
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
