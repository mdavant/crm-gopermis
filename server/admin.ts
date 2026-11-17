import { randomUUID } from "node:crypto";
import { db } from "./db";
import { isMysqlMode, mysqlQuery, mysqlTransaction } from "./mysql.mjs";
import { HttpError, requireUser, clientIpAddress } from "./auth";
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  splitFullName,
} from "./accounts.mjs";
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
};

let initialized = false;
async function ensureTables() {
  if (initialized || isMysqlMode()) return;
  try {
    await db().query(`
      CREATE TABLE IF NOT EXISTS user_permission (
        user_id uuid REFERENCES app_user(id) ON DELETE CASCADE,
        permission_id text NOT NULL,
        PRIMARY KEY(user_id, permission_id)
      );
      ALTER TABLE app_user ADD COLUMN IF NOT EXISTS role_preset text DEFAULT 'instructor';
      ALTER TABLE app_user ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
    `);
    await db().query(`
      UPDATE app_user SET role_preset = 'admin' 
      WHERE id IN (SELECT user_id FROM user_role WHERE role_id = 'technical_admin')
      AND (role_preset IS NULL OR role_preset = 'instructor');
      
      INSERT INTO user_permission(user_id, permission_id)
      SELECT u.id, 'admin.full'
      FROM app_user u
      JOIN user_role ur ON ur.user_id = u.id
      WHERE ur.role_id = 'technical_admin'
      ON CONFLICT DO NOTHING;
    `);
    initialized = true;
  } catch (err) {
    console.error("Failed to ensure admin tables:", err instanceof Error ? err.message : "unknown");
  }
}

function mapPresetToRole(
  preset: string,
  explicitRole?: "admin" | "manager" | "instructor" | "staff",
): "admin" | "manager" | "instructor" | "staff" {
  if (explicitRole) return explicitRole;
  if (preset === "admin") return "admin";
  if (preset === "secretary") return "staff";
  if (preset === "instructor") return "instructor";
  return "staff";
}

function resolveDefaultPermissions(role: string, rolePreset: string, extra: string[]): string[] {
  const perms = new Set<string>(extra);
  if (rolePreset === "admin" || role === "admin") {
    for (const p of [
      "admin.full",
      "planning.create",
      "schedule.read",
      "schedule.write",
      "clients.view",
      "clients.read",
      "clients.create",
      "clients.edit",
      "clients.write",
      "drive.all",
      "catalog.edit",
      "catalog.write",
      "documents.read",
      "documents.write",
      "services.write",
      "payments.read",
      "payments.write",
      "resources.write",
      "sessions.complete",
      "audit.read",
    ]) {
      perms.add(p);
    }
  } else if (role === "manager") {
    for (const p of [
      "planning.create",
      "schedule.read",
      "schedule.write",
      "clients.view",
      "clients.read",
      "clients.create",
      "clients.edit",
      "clients.write",
      "drive.all",
      "documents.read",
      "documents.write",
      "services.write",
      "payments.read",
      "payments.write",
      "resources.write",
      "sessions.complete",
      "audit.read",
    ]) {
      perms.add(p);
    }
  } else if (rolePreset === "instructor" || role === "instructor") {
    perms.add("planning.create");
    perms.add("planning.own_only");
    perms.add("schedule.read");
    perms.add("schedule.write");
    perms.add("clients.view");
    perms.add("clients.read");
  } else if (rolePreset === "secretary" || role === "staff") {
    perms.add("planning.create");
    perms.add("schedule.read");
    perms.add("schedule.write");
    perms.add("clients.view");
    perms.add("clients.read");
    perms.add("clients.create");
    perms.add("clients.edit");
    perms.add("clients.write");
    perms.add("documents.read");
    perms.add("documents.write");
  }
  return Array.from(perms);
}

export async function listAdminUsers(): Promise<AdminUserRecord[]> {
  const caller = await requireUser();
  if (
    !caller.permissions.includes("admin.full") &&
    !caller.permissions.includes("technical_admin") &&
    !caller.roles.includes("admin") &&
    !caller.roles.includes("technical_admin")
  ) {
    throw new HttpError(403, "Seul un administrateur peut accéder au panel admin.");
  }

  if (isMysqlMode()) {
    const usersRows = (await mysqlQuery(
      `SELECT id, first_name, last_name, name, email, role, role_preset, is_active, created_at
       FROM users
       ORDER BY name ASC`,
    )) as Record<string, unknown>[];
    const permRows = (await mysqlQuery(
      "SELECT user_id, permission_name FROM user_permissions",
    )) as Record<string, unknown>[];
    const permByUser = new Map<string, string[]>();
    for (const pr of permRows) {
      const uid = String(pr.user_id);
      const list = permByUser.get(uid) ?? [];
      list.push(String(pr.permission_name));
      permByUser.set(uid, list);
    }

    return usersRows.map((r) => {
      const id = String(r.id);
      const role = String(r.role || "staff") as "admin" | "manager" | "instructor" | "staff";
      const preset = String(r.role_preset || "instructor");
      const rawPerms = permByUser.get(id) ?? [];
      const perms = new Set<string>(rawPerms);
      if (role === "admin" || perms.has("admin.full")) {
        for (const p of resolveDefaultPermissions("admin", "admin", [])) perms.add(p);
      }
      return {
        id,
        email: String(r.email),
        name: String(r.name),
        firstName: String(r.first_name || ""),
        lastName: String(r.last_name || ""),
        role,
        active: Boolean(r.is_active),
        rolePreset: preset,
        permissions: Array.from(perms),
        createdAt: new Date(r.created_at as string | Date).toISOString(),
      };
    });
  }

  await ensureTables();
  const query = `
    SELECT 
      u.id,
      u.email,
      u.name,
      u.active,
      COALESCE(u.role_preset, 'instructor') as "rolePreset",
      COALESCE(u.created_at, now()) as "createdAt",
      COALESCE(
        array_agg(up.permission_id) FILTER (WHERE up.permission_id IS NOT NULL),
        '{}'
      ) as permissions
    FROM app_user u
    LEFT JOIN user_permission up ON up.user_id = u.id
    GROUP BY u.id, u.email, u.name, u.active, u.role_preset, u.created_at
    ORDER BY u.name ASC;
  `;
  const result = await db().query(query);
  return result.rows.map((r) => {
    const isTechAdmin = r.rolePreset === "admin" || (r.permissions as string[]).includes("admin.full");
    const perms = new Set<string>(r.permissions || []);
    if (isTechAdmin) {
      for (const p of resolveDefaultPermissions("admin", "admin", [])) perms.add(p);
    }
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      active: r.active ?? true,
      rolePreset: r.rolePreset,
      permissions: Array.from(perms),
      createdAt: new Date(r.createdAt).toISOString(),
    };
  });
}

const CreateUserSchema = z.object({
  email: z.string().trim().min(3).max(254),
  name: z.string().trim().min(2).max(150).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères").max(256),
  role: z.enum(["admin", "manager", "instructor", "staff"]).optional(),
  rolePreset: z.enum(["admin", "instructor", "secretary", "custom"]).default("instructor"),
  permissions: z.array(z.string()).default([]),
});

export async function createAdminUser(raw: unknown) {
  const caller = await requireUser();
  if (
    !caller.permissions.includes("admin.full") &&
    !caller.permissions.includes("technical_admin") &&
    !caller.roles.includes("admin") &&
    !caller.roles.includes("technical_admin")
  ) {
    throw new HttpError(403, "Accès réservé aux administrateurs");
  }

  const data = CreateUserSchema.parse(raw);
  const identifier = normalizeEmail(data.email);
  if (!isValidEmail(identifier)) {
    throw new HttpError(422, "Adresse e-mail invalide.", "INVALID_EMAIL");
  }

  const fullName =
    data.name?.trim() ||
    `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
  if (!fullName || fullName.length < 2) {
    throw new HttpError(422, "Le nom complet est requis.");
  }
  const split = splitFullName(fullName);
  const firstName = data.firstName?.trim() || split.firstName;
  const lastName = data.lastName?.trim() ?? split.lastName;
  const targetRole = mapPresetToRole(data.rolePreset, data.role);
  const finalPermissions = resolveDefaultPermissions(
    targetRole,
    data.rolePreset,
    data.permissions,
  );
  const passHash = hashPassword(data.password);
  const ip = await clientIpAddress();

  if (isMysqlMode()) {
    const newUserId = randomUUID();
    return mysqlTransaction(async (conn) => {
      const [existing] = await conn.execute(
        "SELECT 1 FROM users WHERE LOWER(email) = ? LIMIT 1",
        [identifier],
      );
      if (Array.isArray(existing) && existing.length > 0) {
        throw new HttpError(409, "Un utilisateur avec cet e-mail existe déjà.");
      }

      await conn.execute(
        `INSERT INTO users (id, first_name, last_name, name, email, password_hash, role, role_preset, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          newUserId,
          firstName,
          lastName,
          fullName,
          identifier,
          passHash,
          targetRole,
          data.rolePreset,
        ],
      );

      for (const perm of finalPermissions) {
        await conn.execute(
          "INSERT IGNORE INTO user_permissions (id, user_id, permission_name) VALUES (?, ?, ?)",
          [randomUUID(), newUserId, perm],
        );
      }

      if (targetRole === "instructor" || finalPermissions.includes("planning.own_only")) {
        await conn.execute(
          `INSERT INTO instructors (id, user_id, first_name, last_name, name, email, active, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
          [randomUUID(), newUserId, firstName, lastName, fullName, identifier, caller.id],
        );
      }

      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, 'user.created', 'user', ?, ?, ?)`,
        [
          randomUUID(),
          caller.id,
          newUserId,
          JSON.stringify({ email: identifier, role: targetRole }),
          ip,
        ],
      );

      return { ok: true, id: newUserId };
    });
  }

  await ensureTables();
  const existing = await db().query("SELECT 1 FROM app_user WHERE lower(email) = $1", [identifier]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new HttpError(400, "Un profil avec cet identifiant ou email existe déjà.");
  }

  const insertUserRes = await db().query(
    `INSERT INTO app_user (email, name, password_hash, active, role_preset)
     VALUES ($1, $2, $3, true, $4) RETURNING id`,
    [identifier, fullName, passHash, data.rolePreset],
  );
  const newUserId = insertUserRes.rows[0].id;

  for (const perm of finalPermissions) {
    await db().query(
      `INSERT INTO user_permission(user_id, permission_id) VALUES($1, $2) ON CONFLICT DO NOTHING`,
      [newUserId, perm],
    );
  }

  const roleName =
    targetRole === "admin"
      ? "technical_admin"
      : targetRole === "manager"
        ? "manager"
        : targetRole === "staff"
          ? "administration"
          : "instructor";
  await db().query(
    `INSERT INTO user_role(user_id, role_id) VALUES($1, $2) ON CONFLICT DO NOTHING`,
    [newUserId, roleName],
  );

  if (data.rolePreset === "instructor" || finalPermissions.includes("planning.own_only")) {
    await db().query(
      `INSERT INTO instructor (name, active, created_by) VALUES ($1, true, $2) ON CONFLICT DO NOTHING`,
      [fullName, caller.id],
    ).catch(() => {});
  }

  return { ok: true, id: newUserId };
}

const UpdateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(150).optional(),
  active: z.boolean().optional(),
  role: z.enum(["admin", "manager", "instructor", "staff"]).optional(),
  rolePreset: z.enum(["admin", "instructor", "secretary", "custom"]).optional(),
  permissions: z.array(z.string()).optional(),
  newPassword: z.string().min(8).max(256).optional(),
});

export async function updateAdminUser(raw: unknown) {
  const caller = await requireUser();
  if (
    !caller.permissions.includes("admin.full") &&
    !caller.permissions.includes("technical_admin") &&
    !caller.roles.includes("admin") &&
    !caller.roles.includes("technical_admin")
  ) {
    throw new HttpError(403, "Accès réservé aux administrateurs");
  }

  const data = UpdateUserSchema.parse(raw);
  const ip = await clientIpAddress();

  if (isMysqlMode()) {
    await mysqlTransaction(async (conn) => {
      const [rows] = await conn.execute("SELECT id, role FROM users WHERE id = ? FOR UPDATE", [
        data.id,
      ]);
      const current = (rows as Record<string, unknown>[])[0];
      if (!current) throw new HttpError(404, "Utilisateur introuvable");

      if (
        data.name !== undefined ||
        data.active !== undefined ||
        data.rolePreset !== undefined ||
        data.role !== undefined
      ) {
        const split = data.name ? splitFullName(data.name) : null;
        const nextRole =
          data.role ?? (data.rolePreset ? mapPresetToRole(data.rolePreset) : undefined);
        await conn.execute(
          `UPDATE users
           SET first_name = COALESCE(?, first_name),
               last_name = COALESCE(?, last_name),
               name = COALESCE(?, name),
               is_active = COALESCE(?, is_active),
               role_preset = COALESCE(?, role_preset),
               role = COALESCE(?, role)
           WHERE id = ?`,
          [
            split?.firstName ?? null,
            split?.lastName ?? null,
            data.name?.trim() ?? null,
            data.active === undefined ? null : data.active ? 1 : 0,
            data.rolePreset ?? null,
            nextRole ?? null,
            data.id,
          ],
        );
      }

      if (data.newPassword) {
        const hash = hashPassword(data.newPassword);
        await conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", [
          hash,
          data.id,
        ]);
      }

      if (data.permissions !== undefined) {
        await conn.execute("DELETE FROM user_permissions WHERE user_id = ?", [data.id]);
        for (const perm of data.permissions) {
          await conn.execute(
            "INSERT IGNORE INTO user_permissions (id, user_id, permission_name) VALUES (?, ?, ?)",
            [randomUUID(), data.id, perm],
          );
        }
      }

      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, 'user.updated', 'user', ?, '{}', ?)`,
        [randomUUID(), caller.id, data.id, ip],
      );
    });
    return { ok: true };
  }

  await ensureTables();
  if (data.name !== undefined || data.active !== undefined || data.rolePreset !== undefined) {
    await db().query(
      `UPDATE app_user SET 
         name = COALESCE($1, name),
         active = COALESCE($2, active),
         role_preset = COALESCE($3, role_preset)
       WHERE id = $4`,
      [data.name?.trim(), data.active, data.rolePreset, data.id],
    );
  }

  if (data.newPassword) {
    const hash = hashPassword(data.newPassword);
    await db().query(`UPDATE app_user SET password_hash = $1 WHERE id = $2`, [hash, data.id]);
  }

  if (data.permissions !== undefined) {
    await db().query(`DELETE FROM user_permission WHERE user_id = $1`, [data.id]);
    for (const perm of data.permissions) {
      await db().query(
        `INSERT INTO user_permission(user_id, permission_id) VALUES($1, $2) ON CONFLICT DO NOTHING`,
        [data.id, perm],
      );
    }
    if (data.permissions.includes("admin.full")) {
      await db().query(
        `INSERT INTO user_role(user_id, role_id) VALUES($1, 'technical_admin') ON CONFLICT DO NOTHING`,
        [data.id],
      );
    }
  }

  return { ok: true };
}

export async function deleteAdminUser(raw: unknown) {
  const caller = await requireUser();
  if (
    !caller.permissions.includes("admin.full") &&
    !caller.permissions.includes("technical_admin") &&
    !caller.roles.includes("admin") &&
    !caller.roles.includes("technical_admin")
  ) {
    throw new HttpError(403, "Accès réservé aux administrateurs");
  }

  const { id } = z.object({ id: z.string().uuid() }).parse(raw);
  if (id === caller.id) {
    throw new HttpError(400, "Vous ne pouvez pas supprimer votre propre compte administrateur.");
  }

  if (isMysqlMode()) {
    const ip = await clientIpAddress();
    await mysqlTransaction(async (conn) => {
      await conn.execute("DELETE FROM auth_sessions WHERE user_id = ?", [id]);
      await conn.execute("DELETE FROM user_permissions WHERE user_id = ?", [id]);
      await conn.execute("UPDATE users SET is_active = 0 WHERE id = ?", [id]);
      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, 'user.deactivated', 'user', ?, '{}', ?)`,
        [randomUUID(), caller.id, id, ip],
      );
    });
    return { ok: true };
  }

  await ensureTables();
  await db().query("DELETE FROM auth_session WHERE user_id = $1", [id]);
  await db().query("DELETE FROM user_permission WHERE user_id = $1", [id]);
  await db().query("DELETE FROM user_role WHERE user_id = $1", [id]);
  await db().query("DELETE FROM app_user WHERE id = $1", [id]);

  return { ok: true };
}
