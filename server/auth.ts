import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";
import { db } from "./db";
import { isMysqlMode, mysqlQuery } from "./mysql.mjs";
import { HttpError } from "./errors.mjs";
import { ALL_PERMISSIONS } from "../lib/permissions";

export { HttpError };

export type CrmRole = "admin" | "manager" | "instructor" | "staff";

export type AuthenticatedUser = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  permissions: string[];
  roles: string[];
  /** Mot de passe temporaire : doit être changé avant tout autre accès. */
  mustChangePassword?: boolean;
};

export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");

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

export async function clientIpAddress(request?: Request): Promise<string | null> {
  try {
    const hdrs = request ? request.headers : await headers();
    const fwd = hdrs.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
    const real = hdrs.get("x-real-ip");
    if (real) return real.trim().slice(0, 64);
  } catch {
    // Ignore when called outside request context
  }
  return null;
}

function expandPermissionAliases(perms: Set<string>) {
  if (perms.has("admin.full")) {
    for (const p of ALL_PERMISSIONS) perms.add(p.key);
    for (const p of ["clients.view", "clients.create", "clients.edit", "planning.create", "catalog.edit", "drive.all"])
      perms.add(p);
    perms.delete("planning.own_only");
  }
  // Anciens noms de permission (comptes créés avant le catalogue détaillé).
  if (perms.has("clients.view")) perms.add("clients.read");
  if (perms.has("clients.edit") || perms.has("clients.create")) perms.add("clients.write");
  if (perms.has("planning.create")) {
    perms.add("schedule.read");
    perms.add("schedule.write");
  }
  if (perms.has("catalog.edit")) perms.add("catalog.write");
  if (perms.has("drive.all")) for (const p of ["drive.read", "drive.write", "drive.delete"]) perms.add(p);
  // Dépendances : un sous-accès implique son accès parent.
  for (const p of ALL_PERMISSIONS)
    if (perms.has(p.key)) for (const r of p.requires ?? []) perms.add(r);
}

export async function requireUser(
  permission?: string,
  options: { allowPendingPassword?: boolean } = {},
): Promise<AuthenticatedUser> {
  const user = await loadUser(permission);
  if (user.mustChangePassword && !options.allowPendingPassword)
    throw new HttpError(
      403,
      "Définissez votre nouveau mot de passe pour continuer.",
      "PASSWORD_CHANGE_REQUIRED",
    );
  return user;
}

async function loadUser(permission?: string): Promise<AuthenticatedUser> {
  const token = await sessionToken();
  if (!token) throw new HttpError(401, "Connexion requise", "AUTH_REQUIRED");
  const tokenHash = digest(token);

  if (isMysqlMode()) {
    const userRows = (await mysqlQuery(
      `SELECT u.id, u.first_name, u.last_name, u.name, u.email, u.role, u.must_change_password
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3) AND u.is_active = 1
       LIMIT 1`,
      [tokenHash],
    )) as Record<string, unknown>[];

    const u = userRows[0];
    if (!u) throw new HttpError(401, "Session expirée", "SESSION_EXPIRED");

    const userId = String(u.id);
    const role = String(u.role || "staff");
    const roles = role === "admin" ? ["admin", "technical_admin"] : [role];

    // Les accès sont ceux cochés pour la personne dans le panel admin ;
    // le rôle « admin » garde toujours l'accès complet.
    const permRows = (await mysqlQuery(
      "SELECT permission_name FROM user_permissions WHERE user_id = ?",
      [userId],
    )) as Record<string, unknown>[];

    const permSet = new Set<string>(
      permRows.map((r) => String(r.permission_name)),
    );
    if (role === "admin") permSet.add("admin.full");
    expandPermissionAliases(permSet);
    const permissions = Array.from(permSet);

    if (permission && !permSet.has("admin.full") && !permSet.has(permission)) {
      throw new HttpError(403, "Permission insuffisante", "FORBIDDEN");
    }

    return {
      id: userId,
      name: String(u.name),
      firstName: String(u.first_name || ""),
      lastName: String(u.last_name || ""),
      email: String(u.email),
      permissions,
      roles,
      mustChangePassword: Boolean(Number(u.must_change_password)),
    };
  }

  const result = await db().query(
    `SELECT u.id,u.name,u.email,COALESCE(u.must_change_password,false) AS "mustChangePassword" FROM auth_session s JOIN app_user u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`,
    [tokenHash],
  );
  const user = result.rows[0] as
    | { id: string; name: string; email: string; mustChangePassword: boolean }
    | undefined;
  if (!user) throw new HttpError(401, "Session expirée", "SESSION_EXPIRED");

  let permsResult;
  const hasUp = await db()
    .query("SELECT to_regclass('public.user_permission') IS NOT NULL AS ok")
    .then((r) => Boolean(r.rows[0]?.ok))
    .catch(() => false);
  if (hasUp) {
    permsResult = await db().query(
      `SELECT DISTINCT permission_id FROM (
         SELECT rp.permission_id FROM user_role ur JOIN role_permission rp ON rp.role_id=ur.role_id WHERE ur.user_id=$1
         UNION
         SELECT up.permission_id FROM user_permission up WHERE up.user_id=$1
       ) p`,
      [user.id],
    );
  } else {
    permsResult = await db().query(
      "SELECT DISTINCT permission_id FROM user_role ur JOIN role_permission rp ON rp.role_id=ur.role_id WHERE ur.user_id=$1",
      [user.id],
    );
  }
  const permSet = new Set<string>(
    permsResult.rows.map((r) => r.permission_id as string),
  );

  const rolesRes = await db()
    .query("SELECT role_id FROM user_role WHERE user_id=$1", [user.id])
    .catch(() => ({ rows: [] }));
  const roles = (rolesRes.rows as Array<{ role_id?: string }>).map((r) =>
    String(r.role_id || ""),
  );
  expandPermissionAliases(permSet);
  const permissions = Array.from(permSet);

  if (permission && !permSet.has("admin.full") && !permSet.has(permission))
    throw new HttpError(403, "Permission insuffisante", "FORBIDDEN");
  return { ...user, permissions, roles };
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
