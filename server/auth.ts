import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";
import { db } from "./db";
export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}
export function previewMode() {
  return (
    process.env.APP_ENV === "preview" ||
    process.env.NODE_ENV !== "production" ||
    (process.env.DATABASE_MODE === "pglite" &&
      process.env.ALLOW_PREVIEW_SETUP === "1")
  );
}
export async function sessionToken() {
  const bearer = (await headers()).get("authorization");
  if (previewMode() && bearer?.startsWith("Bearer ")) return bearer.slice(7);
  return (await cookies()).get("gopermis_session")?.value;
}
export async function requireUser(permission?: string) {
  const token = await sessionToken();
  if (!token) throw new HttpError(401, "Connexion requise", "AUTH_REQUIRED");
  const result = await db().query(
    `SELECT u.id,u.name FROM auth_session s JOIN app_user u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`,
    [digest(token)],
  );
  const user = result.rows[0] as { id: string; name: string } | undefined;
  if (!user) throw new HttpError(401, "Session expirée", "SESSION_EXPIRED");
  const perms = await db().query(
    "SELECT DISTINCT permission_id FROM user_role ur JOIN role_permission rp ON rp.role_id=ur.role_id WHERE ur.user_id=$1",
    [user.id],
  );
  const permissions = perms.rows.map((r) => r.permission_id as string);
  if (permission && !permissions.includes(permission))
    throw new HttpError(403, "Permission insuffisante", "FORBIDDEN");
  return { ...user, permissions };
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin)
    throw new HttpError(
      403,
      "Origine de la requête absente. Rechargez la page.",
      "ORIGIN_REJECTED",
    );
  if (!previewMode()) {
    const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
    if (origin === expected) return;
  } else {
    const url = new URL(request.url);
    const host =
      request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
      request.headers.get("host") ||
      url.host;
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
      url.protocol.slice(0, -1);
    if (
      origin === process.env.APP_ORIGIN ||
      origin === url.origin ||
      origin === `${proto}://${host}` ||
      request.headers.get("sec-fetch-site") === "same-origin"
    )
      return;
  }
  throw new HttpError(
    403,
    "Origine refusée. Ouvrez le CRM depuis son adresse autorisée.",
    "ORIGIN_REJECTED",
  );
}
