import { cookies } from "next/headers";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { isMysqlMode, mysqlQuery, mysqlTransaction } from "./mysql.mjs";
import {
  previewMode,
  sessionToken,
  requireUser,
  digest,
  HttpError,
  clientIpAddress,
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
  const expiresDate = new Date(Date.now() + duration * 1000);
  const expiresAt = expiresDate.toISOString();
  const ip = await clientIpAddress(request);
  const ua = (request.headers.get("user-agent") ?? "").slice(0, 250) || null;

  if (isMysqlMode()) {
    await mysqlQuery(
      `INSERT INTO auth_sessions (token_hash, user_id, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [digest(token), userId, ip, ua, expiresDate],
    );
    await mysqlQuery("UPDATE users SET last_login_at = UTC_TIMESTAMP(3) WHERE id = ?", [
      userId,
    ]);
    await mysqlQuery(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, 'auth.login', 'user', ?, ?, ?)`,
      [randomUUID(), userId, userId, JSON.stringify({ method: "password" }), ip],
    );
  } else {
    await db().query(
      "INSERT INTO auth_session(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
      [digest(token), userId, expiresAt],
    );
  }

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
  const setup = await setupStatus();
  if (isMysqlMode()) {
    await mysqlQuery("SELECT 1 AS ok");
  } else {
    await db().query("SELECT 1");
  }
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
  const ip = await clientIpAddress(request);
  const key = digest(`${identifier}:${ip ?? "direct"}`);

  if (isMysqlMode()) {
    const result = await mysqlTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO login_attempts (attempt_key, attempts, window_start)
         VALUES (?, 0, UTC_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE attempt_key = attempt_key`,
        [key],
      );
      const [attemptRows] = await conn.execute(
        "SELECT attempts, window_start FROM login_attempts WHERE attempt_key = ? FOR UPDATE",
        [key],
      );
      const attempt = (attemptRows as Record<string, unknown>[])[0];
      const windowMs = new Date(attempt.window_start as string | Date).getTime();
      const expired = windowMs < Date.now() - 900000;
      const attemptsCount = Number(attempt.attempts || 0);
      if (!expired && attemptsCount >= 10) {
        return { error: 429 as const };
      }

      const [userRows] = await conn.execute(
        "SELECT id, password_hash, is_active FROM users WHERE LOWER(email) = ? LIMIT 1",
        [identifier],
      );
      const u = (userRows as Record<string, unknown>[])[0];
      if (!u || !Number(u.is_active) || !verifyPassword(x.password, u.password_hash)) {
        await conn.execute(
          `UPDATE login_attempts
           SET attempts = ?, window_start = CASE WHEN ? = 1 THEN UTC_TIMESTAMP(3) ELSE window_start END
           WHERE attempt_key = ?`,
          [expired ? 1 : attemptsCount + 1, expired ? 1 : 0, key],
        );
        return { error: 401 as const };
      }

      await conn.execute("DELETE FROM login_attempts WHERE attempt_key = ?", [key]);
      return { id: String(u.id) };
    });

    if (result.error === 429) {
      throw new HttpError(
        429,
        "Trop de tentatives incorrectes. Réessayez dans 15 minutes.",
        "LOGIN_THROTTLED",
      );
    }
    if (!result.id) {
      throw new HttpError(
        401,
        "Identifiant ou mot de passe incorrect.",
        "INVALID_CREDENTIALS",
      );
    }
    return establish(request, result.id);
  }

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
  if (token) {
    if (isMysqlMode()) {
      await mysqlQuery("DELETE FROM auth_sessions WHERE token_hash = ?", [
        digest(token),
      ]);
    } else {
      await db().query("DELETE FROM auth_session WHERE token_hash=$1", [
        digest(token),
      ]);
    }
  }
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
  const ip = await clientIpAddress();

  if (isMysqlMode()) {
    await mysqlTransaction(async (conn) => {
      const [rows] = await conn.execute(
        "SELECT password_hash FROM users WHERE id = ? AND is_active = 1 FOR UPDATE",
        [user.id],
      );
      const u = (rows as Record<string, unknown>[])[0];
      if (!u || !verifyPassword(x.currentPassword, u.password_hash)) {
        throw new HttpError(
          401,
          "Mot de passe actuel incorrect.",
          "INVALID_CURRENT_PASSWORD",
        );
      }
      await conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", [
        hashPassword(x.newPassword),
        user.id,
      ]);
      await conn.execute("DELETE FROM auth_sessions WHERE user_id = ?", [user.id]);
      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, 'account.password_changed', 'user', ?, '{}', ?)`,
        [randomUUID(), user.id, user.id, ip],
      );
    });
    (await cookies()).delete("gopermis_session");
    return { ok: true };
  }

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
