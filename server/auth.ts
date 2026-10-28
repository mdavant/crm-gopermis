import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { db } from "./db";
export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function requireUser(permission?: string, req?: Request) {
  let token = (await cookies()).get("gopermis_session")?.value;
  if (!token && req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
    if (!token) {
      token = req.headers.get("x-session-token")?.trim();
    }
  }
  if (!token) throw new HttpError(401, "Connexion requise");
  const result = await db().query(
    `SELECT u.id,u.name FROM auth_session s JOIN app_user u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`,
    [digest(token)],
  );
  const user = result.rows[0] as { id: string; name: string } | undefined;
  if (!user) throw new HttpError(401, "Session expirée");
  const perms = await db().query(
    "SELECT DISTINCT permission_id FROM user_role ur JOIN role_permission rp ON rp.role_id=ur.role_id WHERE ur.user_id=$1",
    [user.id],
  );
  const permissions = perms.rows.map((r) => r.permission_id as string);
  if (permission && !permissions.includes(permission))
    throw new HttpError(403, "Permission insuffisante");
  return { ...user, permissions };
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedOrigin = host ? `${proto}://${host}` : null;
  const requestOrigin = new URL(request.url).origin;

  const allowedOrigins = new Set<string>();
  if (process.env.APP_ORIGIN) allowedOrigins.add(process.env.APP_ORIGIN);
  if (forwardedOrigin) allowedOrigins.add(forwardedOrigin);
  if (requestOrigin) allowedOrigins.add(requestOrigin);

  if (allowedOrigins.has(origin)) return;

  if (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  ) {
    return;
  }

  if (
    origin.endsWith(".run.app") ||
    origin.includes(".run.app:") ||
    origin.endsWith(".google.com")
  ) {
    return;
  }

  throw new HttpError(403, "Origine refusée");
}
