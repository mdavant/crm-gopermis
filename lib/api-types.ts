import { readApiResponse } from "./http";
import type { Offer, Rate } from "../domain/pricing";
export type User = { id: string; name: string; permissions: string[] };
export type Catalog = {
  rates: Rate[];
  offers: (Offer & { label: string })[];
  models: { id: string; label: string }[];
  types: { id: string; label: string; pricing_mode: string }[];
};
export type ClientRecord = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  status: string;
  source: string;
  created_at: string;
};
export type ServiceRecord = {
  id: string;
  label: string;
  status: string;
  price_snapshot: {
    unitCents: number;
    totalCents: number;
    paidMinutes: number;
    potentialBonusMinutes: number;
    model: string;
    support: string;
  };
};
export type Detail = {
  client: ClientRecord;
  services: ServiceRecord[];
  ledger: {
    id: string;
    service_id: string;
    minutes: number;
    kind: string;
    reason: string;
    created_at: string;
  }[];
  payments: {
    id: string;
    service_id: string;
    amount_cents: number;
    method: string;
    created_at: string;
  }[];
  notes: { id: string; body: string; author: string; created_at: string }[];
  history: { action: string; actor: string; created_at: string }[];
};
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("gopermis_session")
      : null;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["x-session-token"] = token;
  }
  const r = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await readApiResponse<T>(r);
  if (
    path === "login" &&
    data &&
    typeof data === "object" &&
    "token" in data &&
    typeof data.token === "string"
  ) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gopermis_session", data.token);
    }
  }
  if (path === "logout") {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("gopermis_session");
    }
  }
  return data;
}
export type Booking = {
  id: string;
  service_id: string;
  client_id: string;
  vehicle_id: string;
  instructor_id: string | null;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "completed";
  minutes: number;
  vehicle_label: string;
  instructor_name: string | null;
  first_name: string;
  last_name: string;
  companion_name: string | null;
  completed_at: string | null;
};
export type Resources = {
  vehicles: {
    id: string;
    label: string;
    model_id: string;
    model_label: string;
    active: boolean;
  }[];
  instructors: { id: string; name: string; active: boolean }[];
  blocks: {
    id: string;
    reason: string;
    starts_at: string;
    ends_at: string;
    vehicle_label: string | null;
    instructor_name: string | null;
    client_name: string;
  }[];
  creditPolicy: "reserve_credit" | "credit_on_completion" | null;
};
