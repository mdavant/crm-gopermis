"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import { api, type Detail, type Resources, type ClientPage, type Booking } from "../lib/api-types";
import { useApp } from "./app-context";
import { IntervalFields, localInstant } from "./schedule";
import { AlertCircle } from "lucide-react";

export function NewBookingModal({
  onBookingSuccess,
}: {
  onBookingSuccess?: (booking: Booking) => void;
}) {
  const { newBookingOpen, setNewBookingOpen, selectedClientIdForBooking } = useApp();
  const router = useRouter();

  const [clientSearch, setClientSearch] = useState("");
  const [clientList, setClientList] = useState<{ id: string; name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientDetail, setClientDetail] = useState<Detail | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [resources, setResources] = useState<Resources | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");

  // Load resources once when modal opens
  useEffect(() => {
    if (newBookingOpen) {
      setRequestId(crypto.randomUUID());
      setError("");
      api<Resources>("resources")
        .then(setResources)
        .catch((e) => setError(e.message));
    }
  }, [newBookingOpen]);

  // Set initial selected client if passed from context
  useEffect(() => {
    if (selectedClientIdForBooking) {
      setSelectedClientId(selectedClientIdForBooking);
    }
  }, [selectedClientIdForBooking]);

  // Search clients for the select dropdown
  useEffect(() => {
    if (!newBookingOpen) return;
    let active = true;
    const timer = setTimeout(() => {
      api<ClientPage>("clients/search?pageSize=30&q=" + encodeURIComponent(clientSearch))
        .then((res) => {
          if (active) {
            setClientList(res.items.map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}` })));
            if (!selectedClientId && res.items.length > 0 && !selectedClientIdForBooking) {
              setSelectedClientId(res.items[0].id);
            }
          }
        })
        .catch(() => {});
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [clientSearch, newBookingOpen, selectedClientId, selectedClientIdForBooking]);

  // Load client detail when a client is selected
  useEffect(() => {
    if (!selectedClientId) {
      setClientDetail(null);
      setSelectedServiceId("");
      return;
    }
    setLoading(true);
    api<Detail>(`clients/${selectedClientId}`)
      .then((d) => {
        setClientDetail(d);
        const activeServices = d.services.filter((s) => s.status === "Active");
        if (activeServices.length > 0) {
          setSelectedServiceId(activeServices[0].id);
        } else {
          setSelectedServiceId("");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedClientId]);

  if (!newBookingOpen) return null;

  const activeServices = clientDetail?.services.filter((s) => s.status === "Active") ?? [];
  const selectedService = activeServices.find((s) => s.id === selectedServiceId);

  const compatibleVehicles = resources?.vehicles.filter(
    (v) => v.active && (!selectedService || v.model_id === selectedService.price_snapshot.model)
  ) ?? [];

  return (
    <Modal
      title="Planifier une nouvelle séance"
      close={() => {
        if (!busy) {
          setError("");
          setNewBookingOpen(false);
        }
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!selectedServiceId) {
            setError("Veuillez sélectionner une prestation active.");
            return;
          }
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const body = {
              vehicleId: f.get("vehicleId"),
              instructorId: f.get("instructorId") || null,
              startsAt: localInstant(f.get("startsAt")),
              endsAt: localInstant(f.get("endsAt")),
              requestId,
              ...(selectedService?.price_snapshot.support === "Personnel"
                ? {
                    companionName: f.get("companionName"),
                    companionLicenseDate: f.get("companionLicenseDate"),
                  }
                : {}),
            };
            const booking = await api<Booking>(`services/${selectedServiceId}/bookings`, body);
            setNewBookingOpen(false);
            if (onBookingSuccess) {
              onBookingSuccess(booking);
            }
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        <label>
          Rechercher un élève
          <input
            type="search"
            placeholder="Nom ou prénom..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />
        </label>

        <label>
          Élève sélectionné
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            required
          >
            <option value="" disabled>
              Choisir un élève
            </option>
            {clientList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {loading && <p style={{ fontSize: "13px", color: "#64748b" }}>Chargement des prestations de l&apos;élève...</p>}

        {clientDetail && activeServices.length === 0 && !loading && (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", padding: "14px", borderRadius: "10px", margin: "12px 0" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#c2410c", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={16} />
              Cet élève n&apos;a aucune prestation active. Vous devez lui ajouter une prestation (forfait ou heures) avant de planifier une séance.
            </p>
            <button
              type="button"
              style={{ marginTop: "10px", fontSize: "12.5px" }}
              onClick={() => {
                setNewBookingOpen(false);
                router.push(`/clients/${selectedClientId}`);
              }}
            >
              Ouvrir le dossier élève pour ajouter une offre
            </button>
          </div>
        )}

        {activeServices.length > 0 && (
          <>
            <label>
              Prestation active
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                required
              >
                {activeServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} · Accompagnement {s.price_snapshot.support} ({s.price_snapshot.model})
                  </option>
                ))}
              </select>
            </label>

            {selectedService && (
              <>
                <label>
                  Véhicule physique
                  <select name="vehicleId" required defaultValue="">
                    <option value="" disabled>
                      Sélectionner un véhicule
                    </option>
                    {compatibleVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label} ({v.model_label})
                      </option>
                    ))}
                  </select>
                </label>

                {selectedService.price_snapshot.support === "GoPermis" ? (
                  <label>
                    Moniteur
                    <select name="instructorId" required defaultValue="">
                      <option value="" disabled>
                        Sélectionner un moniteur
                      </option>
                      {resources?.instructors
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
                      Nom de l’accompagnateur personnel
                      <input name="companionName" required maxLength={150} />
                    </label>
                    <label>
                      Date d’obtention de son permis
                      <input type="date" name="companionLicenseDate" required />
                    </label>
                    <small style={{ color: "#64748b", fontSize: "11px" }}>
                      Au moins 5 ans de permis révolus requis à la date de la séance.
                    </small>
                  </>
                )}

                <IntervalFields />

                <p style={{ fontSize: "12px", color: "#64748b", margin: "14px 0 6px" }}>
                  La réservation bloque les créneaux avec vérification anti-conflit stricte (véhicule, moniteur et élève).
                </p>

                <button className="primary" disabled={busy || compatibleVehicles.length === 0}>
                  {busy ? "Vérification des disponibilités…" : "Confirmer la réservation"}
                </button>
              </>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
