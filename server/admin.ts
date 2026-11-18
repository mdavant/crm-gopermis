import { randomInt, randomUUID } from "node:crypto";
import { db } from "./db";
import { isMysqlMode, mysqlQuery, mysqlTransaction } from "./mysql.mjs";
import { HttpError, requireUser, clientIpAddress, type AuthenticatedUser } from "./auth";
import { hashPassword, normalizeEmail, splitFullName } from "./accounts.mjs";
import { KNOWN_PERMISSION_KEYS, presetPermissions, withRequirements } from "../lib/permissions";
import { z } from "zod";

export type AdminUserRecord = {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role?: "admin" | "manager" | "instructor" | "staff";
  active: boolean;
  rolePreset: string;
  permissions: string[];
  createdAt: string;
  lastLoginAt?: string | null;
  /** Le compte n'a pas encore remplacé son mot de passe temporaire. */
  mustChangePassword: boolean;
  /** Visible uniquement tant que le mot de passe temporaire n'a pas été changé. */
  temporaryPassword: string | null;
};

const PRESETS = ["admin", "manager", "secretary", "instructor", "custom"] as const;

/** Mot de passe temporaire lisible, sans caractères ambigus (0/O, 1/l…). 16 caractères. */
export function generateTemporaryPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const group = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `${group()}-${group()}-${group()}-${randomInt(10, 100)}`;
}

/** Identifiant de connexion : e-mail ou identifiant simple (lettres, chiffres, . _ - +). */
function normalizeIdentifier(raw: string) {
  const id = normalizeEmail(raw);
  if (!/^[a-z0-9._+@-]{3,254}$/.test(id))
    throw new HttpError(
      422,
      "Identifiant invalide : 3 caractères minimum, lettres, chiffres, point, tiret ou e-mail.",
      "INVALID_IDENTIFIER",
    );
  return id;
}

/** Ne garde que les permissions connues, ajoute leurs accès parents. */
function sanitizePermissions(perms: string[]) {
  return [...withRequirements(perms.filter((p) => KNOWN_PERMISSION_KEYS.has(p)))];
}

function roleFor(preset: string, perms: string[]): "admin" | "manager" | "instructor" | "staff" {
  if (perms.includes("admin.full")) return "admin";
  if (preset === "manager") return "manager";
  if (preset === "instructor" || perms.includes("planning.own_only")) return "instructor";
  return "staff";
}

async function requireUsersManager(): Promise<AuthenticatedUser> {
  const caller = await requireUser();
  if (!caller.permissions.includes("admin.full") && !caller.permissions.includes("users.manage"))
    throw new HttpError(403, "Accès réservé aux gestionnaires de comptes.", "FORBIDDEN");
  return caller;
}

/** Seul un administrateur complet peut donner ou retirer les droits d'administration. */
function guardSensitive(caller: AuthenticatedUser, perms: string[]) {
  if (caller.permissions.includes("admin.full")) return;
  if (perms.includes("admin.full") || perms.includes("users.manage"))
    throw new HttpError(403, "Seul un administrateur complet peut attribuer les droits d'administration.");
}

export async function listAdminUsers(): Promise<AdminUserRecord[]> {
  await requireUsersManager();

  if (isMysqlMode()) {
    const usersRows = (await mysqlQuery(
      `SELECT id, first_name, last_name, name, email, role, role_preset, is_active, created_at,
              last_login_at, must_change_password, temp_password
       FROM users ORDER BY is_active DESC, name ASC`,
    )) as Record<string, unknown>[];
    const permRows = (await mysqlQuery("SELECT user_id, permission_name FROM user_permissions")) as Record<
      string,
      unknown
    >[];
    const permByUser = new Map<string, string[]>();
    for (const pr of permRows) {
      const uid = String(pr.user_id);
      permByUser.set(uid, [...(permByUser.get(uid) ?? []), String(pr.permission_name)]);
    }
    return usersRows.map((r) => {
      const id = String(r.id);
      const role = String(r.role || "staff") as AdminUserRecord["role"];
      const perms = permByUser.get(id) ?? [];
      const pending = Boolean(Number(r.must_change_password));
      return {
        id,
        email: String(r.email),
        name: String(r.name),
        firstName: String(r.first_name || ""),
        lastName: String(r.last_name || ""),
        role,
        active: Boolean(Number(r.is_active)),
        rolePreset: String(r.role_preset || "custom"),
        permissions: role === "admin" && !perms.includes("admin.full") ? [...perms, "admin.full"] : perms,
        createdAt: new Date(r.created_at as string | Date).toISOString(),
        lastLoginAt: r.last_login_at ? new Date(r.last_login_at as string | Date).toISOString() : null,
        mustChangePassword: pending,
        temporaryPassword: pending && r.temp_password ? String(r.temp_password) : null,
      };
    });
  }

  const result = await db().query(`
    SELECT u.id, u.email, u.name, u.active,
           COALESCE(u.role_preset, 'custom') AS "rolePreset",
           COALESCE(u.created_at, now()) AS "createdAt",
           COALESCE(u.must_change_password, false) AS "mustChangePassword",
           u.temp_password AS "tempPassword",
           COALESCE(array_agg(up.permission_id) FILTER (WHERE up.permission_id IS NOT NULL), '{}') AS permissions,
           bool_or(ur.role_id = 'technical_admin') AS "isTechAdmin"
    FROM app_user u
    LEFT JOIN user_permission up ON up.user_id = u.id
    LEFT JOIN user_role ur ON ur.user_id = u.id
    GROUP BY u.id
    ORDER BY u.active DESC, u.name ASC`);
  return result.rows.map((r) => {
    const perms = [...new Set<string>(r.permissions || [])];
    if (r.isTechAdmin && !perms.includes("admin.full")) perms.push("admin.full");
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      active: r.active ?? true,
      rolePreset: r.rolePreset,
      permissions: perms,
      createdAt: new Date(r.createdAt).toISOString(),
      mustChangePassword: Boolean(r.mustChangePassword),
      temporaryPassword: r.mustChangePassword && r.tempPassword ? String(r.tempPassword) : null,
    };
  });
}

const CreateUserSchema = z.object({
  email: z.string().trim().min(3).max(254),
  name: z.string().trim().min(2, "Le nom complet est requis.").max(150),
  rolePreset: z.enum(PRESETS).default("custom"),
  permissions: z.array(z.string().max(80)).max(100).optional(),
});

export async function createAdminUser(raw: unknown) {
  const caller = await requireUsersManager();
  const data = CreateUserSchema.parse(raw);
  const identifier = normalizeIdentifier(data.email);
  const perms = sanitizePermissions(data.permissions ?? presetPermissions(data.rolePreset));
  if (perms.length === 0) throw new HttpError(422, "Attribuez au moins une permission.");
  guardSensitive(caller, perms);
  const { firstName, lastName } = splitFullName(data.name);
  const role = roleFor(data.rolePreset, perms);
  const temporaryPassword = generateTemporaryPassword();
  const passHash = hashPassword(temporaryPassword);
  const ip = await clientIpAddress();

  if (isMysqlMode()) {
    const newUserId = randomUUID();
    await mysqlTransaction(async (conn) => {
      const [existing] = await conn.execute("SELECT 1 FROM users WHERE LOWER(email) = ? LIMIT 1", [identifier]);
      if (Array.isArray(existing) && existing.length > 0)
        throw new HttpError(409, "Un utilisateur avec cet identifiant existe déjà.");
      await conn.execute(
        `INSERT INTO users (id, first_name, last_name, name, email, password_hash, role, role_preset, is_active,
                            must_change_password, temp_password)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
        [newUserId, firstName, lastName, data.name, identifier, passHash, role, data.rolePreset, temporaryPassword],
      );
      for (const perm of perms)
        await conn.execute(
          "INSERT IGNORE INTO user_permissions (id, user_id, permission_name) VALUES (?, ?, ?)",
          [randomUUID(), newUserId, perm],
        );
      if (role === "instructor")
        await conn.execute(
          `INSERT INTO instructors (id, user_id, first_name, last_name, name, email, active, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
          [randomUUID(), newUserId, firstName, lastName, data.name, identifier, caller.id],
        );
      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, 'user.created', 'user', ?, ?, ?)`,
        [randomUUID(), caller.id, newUserId, JSON.stringify({ identifier, role, permissions: perms }), ip],
      );
    });
    return { ok: true, id: newUserId, identifier, temporaryPassword };
  }

  const existing = await db().query("SELECT 1 FROM app_user WHERE lower(email) = $1", [identifier]);
  if (existing.rowCount) throw new HttpError(409, "Un utilisateur avec cet identifiant existe déjà.");
  const ins = await db().query(
    `INSERT INTO app_user (email, name, password_hash, active, role_preset, must_change_password, temp_password)
     VALUES ($1, $2, $3, true, $4, true, $5) RETURNING id`,
    [identifier, data.name, passHash, data.rolePreset, temporaryPassword],
  );
  const newUserId = ins.rows[0].id as string;
  for (const perm of perms)
    await db().query("INSERT INTO user_permission(user_id, permission_id) VALUES($1, $2) ON CONFLICT DO NOTHING", [
      newUserId,
      perm,
    ]);
  const roleName = role === "admin" ? "technical_admin" : role === "manager" ? "manager" : role === "staff" ? "administration" : "instructor";
  await db().query("INSERT INTO user_role(user_id, role_id) VALUES($1, $2) ON CONFLICT DO NOTHING", [newUserId, roleName]);
  return { ok: true, id: newUserId, identifier, temporaryPassword };
}

const UpdateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(150).optional(),
  active: z.boolean().optional(),
  rolePreset: z.enum(PRESETS).optional(),
  permissions: z.array(z.string().max(80)).max(100).optional(),
  resetPassword: z.boolean().optional(),
});

export async function updateAdminUser(raw: unknown) {
  const caller = await requireUsersManager();
  const data = UpdateUserSchema.parse(raw);
  const perms = data.permissions ? sanitizePermissions(data.permissions) : undefined;
  if (perms) guardSensitive(caller, perms);
  if (data.id === caller.id) {
    if (data.active === false) throw new HttpError(400, "Vous ne pouvez pas désactiver votre propre compte.");
    if (perms && caller.permissions.includes("admin.full") && !perms.includes("admin.full"))
      throw new HttpError(400, "Vous ne pouvez pas retirer vos propres droits d'administrateur.");
  }
  const temporaryPassword = data.resetPassword ? generateTemporaryPassword() : null;
  const ip = await clientIpAddress();

  if (isMysqlMode()) {
    await mysqlTransaction(async (conn) => {
      const [rows] = await conn.execute("SELECT id, role, role_preset FROM users WHERE id = ? FOR UPDATE", [data.id]);
      const current = (rows as Record<string, unknown>[])[0];
      if (!current) throw new HttpError(404, "Utilisateur introuvable");
      if (perms && !perms.includes("admin.full") && String(current.role) === "admin") {
        const [admins] = await conn.execute(
          "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1 AND id <> ?",
          [data.id],
        );
        if (Number((admins as Record<string, unknown>[])[0]?.n ?? 0) === 0)
          throw new HttpError(400, "Il doit rester au moins un administrateur actif.");
      }
      const preset = data.rolePreset ?? String(current.role_preset || "custom");
      const nextRole = perms ? roleFor(preset, perms) : null;
      const split = data.name ? splitFullName(data.name) : null;
      await conn.execute(
        `UPDATE users SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
                name = COALESCE(?, name), is_active = COALESCE(?, is_active),
                role_preset = COALESCE(?, role_preset), role = COALESCE(?, role)
         WHERE id = ?`,
        [
          split?.firstName ?? null,
          split?.lastName ?? null,
          data.name ?? null,
          data.active === undefined ? null : data.active ? 1 : 0,
          data.rolePreset ?? null,
          nextRole,
          data.id,
        ],
      );
      if (temporaryPassword) {
        await conn.execute(
          "UPDATE users SET password_hash = ?, must_change_password = 1, temp_password = ? WHERE id = ?",
          [hashPassword(temporaryPassword), temporaryPassword, data.id],
        );
        await conn.execute("DELETE FROM auth_sessions WHERE user_id = ?", [data.id]);
      }
      if (data.active === false) await conn.execute("DELETE FROM auth_sessions WHERE user_id = ?", [data.id]);
      if (perms) {
        await conn.execute("DELETE FROM user_permissions WHERE user_id = ?", [data.id]);
        for (const perm of perms)
          await conn.execute(
            "INSERT IGNORE INTO user_permissions (id, user_id, permission_name) VALUES (?, ?, ?)",
            [randomUUID(), data.id, perm],
          );
      }
      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, ?, 'user', ?, ?, ?)`,
        [
          randomUUID(),
          caller.id,
          temporaryPassword ? "user.password_reset" : "user.updated",
          data.id,
          JSON.stringify({ permissions: perms, active: data.active }),
          ip,
        ],
      );
    });
    return { ok: true, temporaryPassword };
  }

  await db().query(
    `UPDATE app_user SET name = COALESCE($1, name), active = COALESCE($2, active), role_preset = COALESCE($3, role_preset)
     WHERE id = $4`,
    [data.name ?? null, data.active ?? null, data.rolePreset ?? null, data.id],
  );
  if (temporaryPassword) {
    await db().query(
      "UPDATE app_user SET password_hash = $1, must_change_password = true, temp_password = $2 WHERE id = $3",
      [hashPassword(temporaryPassword), temporaryPassword, data.id],
    );
    await db().query("DELETE FROM auth_session WHERE user_id = $1", [data.id]);
  }
  if (perms) {
    await db().query("DELETE FROM user_permission WHERE user_id = $1", [data.id]);
    for (const perm of perms)
      await db().query("INSERT INTO user_permission(user_id, permission_id) VALUES($1, $2) ON CONFLICT DO NOTHING", [
        data.id,
        perm,
      ]);
    if (perms.includes("admin.full"))
      await db().query("INSERT INTO user_role(user_id, role_id) VALUES($1, 'technical_admin') ON CONFLICT DO NOTHING", [data.id]);
    else await db().query("DELETE FROM user_role WHERE user_id = $1 AND role_id = 'technical_admin'", [data.id]);
  }
  return { ok: true, temporaryPassword };
}

export async function deleteAdminUser(raw: unknown) {
  const caller = await requireUsersManager();
  const { id } = z.object({ id: z.string().uuid() }).parse(raw);
  if (id === caller.id) throw new HttpError(400, "Vous ne pouvez pas désactiver votre propre compte.");

  if (isMysqlMode()) {
    const ip = await clientIpAddress();
    await mysqlTransaction(async (conn) => {
      await conn.execute("DELETE FROM auth_sessions WHERE user_id = ?", [id]);
      await conn.execute("UPDATE users SET is_active = 0, temp_password = NULL WHERE id = ?", [id]);
      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, 'user.deactivated', 'user', ?, '{}', ?)`,
        [randomUUID(), caller.id, id, ip],
      );
    });
    return { ok: true };
  }

  await db().query("DELETE FROM auth_session WHERE user_id = $1", [id]);
  await db().query("UPDATE app_user SET active = false, temp_password = NULL WHERE id = $1", [id]);
  return { ok: true };
}
