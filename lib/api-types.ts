import { previewToken, clearPreviewSession } from "./session";
import { ApiError } from "./http";
import { readApiResponse } from "./http";
import type { Offer, Rate } from "../domain/pricing";
export type User = {
  id: string;
  name: string;
  email?: string;
  permissions: string[];
  roles?: string[];
  mustChangePassword?: boolean;
  instructorId?: string | null;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  rolePreset: "admin" | "manager" | "instructor" | "secretary" | "custom";
  permissions: string[];
  createdAt: string;
  lastLoginAt?: string | null;
  mustChangePassword: boolean;
  temporaryPassword: string | null;
};
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
  version: number;
  updated_at: string;
  address?: string | null;
  birth_date?: string | null;
  neph?: string | null;
  category?: string | null;
  completed_at?: string | null;
};
export type ClientPage = {
  items: ClientRecord[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
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
  const token = previewToken();
  let r: Response;
  try {
    r = await fetch("/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new ApiError(
      "Le serveur ne répond pas. Réessayez avec le bouton Actualiser la connexion.",
      0,
      "NETWORK_UNAVAILABLE",
    );
  }
  try {
    const data = await readApiResponse<T>(r);
    if (data && typeof data === "object" && "session" in data) {
      const session = data.session as { token: string; expiresAt: string };
      const { savePreviewSession } = await import("./session");
      savePreviewSession(session);
    }
    if (path === "logout" || path === "auth/logout") clearPreviewSession();
    return data;
  } catch (e) {
    if (
      e instanceof ApiError &&
      ["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(e.code)
    ) {
      clearPreviewSession();
      window.dispatchEvent(
        new CustomEvent("gopermis-session-expired", { detail: e.message }),
      );
    }
    throw e;
  }
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
  vehicle_model?: string;
  instructor_name: string | null;
  instructor_color?: string | null;
  service_type?: string | null;
  rental_document_id?: string | null;
  session_kind?: string | null;
  notes?: string | null;
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
    registration_number?: string | null;
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    insurance_signatory?: string | null;
    insurance_policy?: string | null;
    insurer?: string | null;
  }[];
  instructors: { id: string; name: string; active: boolean; color?: string | null }[];
  planningColors?: { companion: string; exam: string };
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

export type HomeStats = {totalClients:number;todayBookingsCount:number|null;todayMinutes:number|null;todayHours:number|null};

export type DriveItem = {
  id: string;
  parentId: string | null;
  name: string;
  type: "folder" | "file";
  mimeType: string | null;
  size: number;
  data: string | null;
  starred: boolean;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  creatorName?: string;
  creatorEmail?: string;
  childCount?: number;
};

export type BreadcrumbItem = {
  id: string | null;
  name: string;
};

export type DriveFolderTreeNode = {
  id: string;
  name: string;
  parentId: string | null;
  color: string | null;
  itemCount: number;
};

export type DriveResponse = {
  items: DriveItem[];
  currentFolder: DriveItem | null;
  breadcrumbs: BreadcrumbItem[];
  folderTree: DriveFolderTreeNode[];
  stats: {
    totalFiles: number;
    totalFolders: number;
    totalSizeBytes: number;
  };
};
