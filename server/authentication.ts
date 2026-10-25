import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import {
  previewMode,
  sessionToken,
  requireUser,
  digest,
  HttpError,
} from "./auth";
import { setupStatus, setupAccount } from "./setup";
import { verifyPassword, hashPassword } from "./accounts.mjs";
import { transaction, audit } from "./crm";
const input = z.object({
  identifiant: z.string().trim().min(1, "Identifiant requis").max(254),
  password: z.string().min(1, "Mot de passe requis").max(256),
});
async function establish(request: Request, userId: string) {
  const token = randomBytes(32).toString("hex");
  const preview = previewMode();
  const duration = preview ? 3600 : 28800;
  const expiresAt = new Date(Date.now() + duration * 1000).toISOString();
  await db().query(
    "INSERT INTO auth_session(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
    [digest(token), userId, expiresAt],
  );
  const https =
    request.headers.get("origin")?.startsWith("https://") ??
    new URL(request.url).protocol === "https:";
  (await cookies()).set("gopermis_session", token, {
    httpOnly: true,
    path: "/",
    sameSite: preview && https ? "none" : "lax",
    secure: https || !preview,
    partitioned: preview && https,
    maxAge: duration,
  });
  return {
    ok: true,
    preview,
    ...(preview ? { session: { token, expiresAt } } : {}),
  };
}
export async function authenticationStatus() {
  // Probe the chosen database before showing a form, even for an anonymous visitor.
  const setup = await setupStatus();
  await db().query("SELECT 1");
  let user = null;
  try {
    user = await requireUser();
  } catch (e) {
    if (!(e instanceof HttpError && e.status === 401)) throw e;
  }
  return { user, preview: previewMode(), setupRequired: setup.required };
}
export async function loginAccount(raw: unknown, request: Request) {
  const body = z.record(z.string(), z.unknown()).parse(raw);
  const x = input.parse({
    identifiant: body.identifiant || body.username || body.email,
    password: body.password,
  });
  const identifier = x.identifiant.toLowerCase();
  const key = digest(identifier);
  // Count failures, not successful logins; serialize attempts for the same account.
  const userId = await transaction(async (c) => {
    await c.query(
      "INSERT INTO login_attempt(key,attempts) VALUES($1,0) ON CONFLICT DO NOTHING",
      [key],
    );
    const attempt = (
      await c.query("SELECT * FROM login_attempt WHERE key=$1 FOR UPDATE", [
        key,
      ])
    ).rows[0];
    const expired =
      new Date(attempt.window_start).getTime() < Date.now() - 900000;
    if (!expired && attempt.attempts >= 10) return { error: 429 };
    const u = (
      await c.query(
        "SELECT id,password_hash,active FROM app_user WHERE lower(email)=$1",
        [identifier],
      )
    ).rows[0];
    if (!verifyPassword(x.password, u?.password_hash) || !u?.active) {
      await c.query(
        "UPDATE login_attempt SET attempts=$2,window_start=CASE WHEN $3 THEN now() ELSE window_start END WHERE key=$1",
        [key, expired ? 1 : attempt.attempts + 1, expired],
      );
      return { error: 401 };
    }
    await c.query("DELETE FROM login_attempt WHERE key=$1", [key]);
    return { id: u.id as string };
  });
  if (userId.error === 429)
    throw new HttpError(
      429,
      "Trop de tentatives incorrectes. Réessayez dans 15 minutes.",
      "LOGIN_THROTTLED",
    );
  if (!userId.id)
    throw new HttpError(
      401,
      "Identifiant ou mot de passe incorrect.",
      "INVALID_CREDENTIALS",
    );
  return establish(request, userId.id);
}
export async function registerAccount(raw: unknown, request: Request) {
  await setupAccount(raw);
  return loginAccount(raw, request);
}
export async function logoutAccount() {
  const token = await sessionToken();
  if (token)
    await db().query("DELETE FROM auth_session WHERE token_hash=$1", [
      digest(token),
    ]);
  (await cookies()).delete("gopermis_session");
  return { ok: true };
}
export async function changePassword(raw: unknown) {
  const user = await requireUser();
  const x = z
    .object({
      currentPassword: z.string().min(1).max(256),
      newPassword: z.string().min(14).max(256),
    })
    .parse(raw);
  if (x.currentPassword === x.newPassword)
    throw new HttpError(
      422,
      "Choisissez un nouveau mot de passe.",
      "SAME_PASSWORD",
    );
  await transaction(async (c) => {
    const u = (
      await c.query(
        "SELECT password_hash FROM app_user WHERE id=$1 AND active FOR UPDATE",
        [user.id],
      )
    ).rows[0];
    if (!u || !verifyPassword(x.currentPassword, u.password_hash))
      throw new HttpError(
        401,
        "Mot de passe actuel incorrect.",
        "INVALID_CURRENT_PASSWORD",
      );
    await c.query("UPDATE app_user SET password_hash=$2 WHERE id=$1", [
      user.id,
      hashPassword(x.newPassword),
    ]);
    await c.query("DELETE FROM auth_session WHERE user_id=$1", [user.id]);
    await audit(c, user.id, "account.password_changed", user.id);
  });
  (await cookies()).delete("gopermis_session");
  return { ok: true };
}
