const key = "gopermis.preview.session";
let memory: { token: string; expiresAt: string } | null = null;
export function clearPreviewSession() {
  memory = null;
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
export function savePreviewSession(session?: {
  token: string;
  expiresAt: string;
}) {
  clearPreviewSession();
  if (!session) return;
  memory = session;
  try {
    sessionStorage.setItem(key, JSON.stringify(session));
  } catch {
    /* memory-only when embedded storage is blocked */
  }
}
export function previewToken() {
  if (!memory) {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) memory = JSON.parse(raw);
    } catch {}
  }
  if (
    !memory ||
    typeof memory.token !== "string" ||
    !Number.isFinite(Date.parse(memory.expiresAt)) ||
    Date.parse(memory.expiresAt) <= Date.now()
  ) {
    clearPreviewSession();
    return null;
  }
  return memory.token;
}
