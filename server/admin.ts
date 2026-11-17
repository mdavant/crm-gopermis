import { db } from "./db";
import { HttpError, requireUser } from "./auth";
import { hashPassword } from "./accounts.mjs";
import { z } from "zod";

export type AdminUserRecord = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  rolePreset: string;
  permissions: string[];
  createdAt: string;
};

// Ensure auxiliary columns and table exist
let initialized = false;
async function ensureTables() {
  if (initialized) return;
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
    // Ensure existing technical_admin users have 'admin' role_preset and 'admin.full' permission
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
    console.error("Failed to ensure admin tables:", err);
  }
}

export async function listAdminUsers(): Promise<AdminUserRecord[]> {
  const caller = await requireUser();
  if (!caller.permissions.includes("admin.full") && !caller.permissions.includes("technical_admin")) {
    throw new HttpError(403, "Seul un administrateur peut accéder au panel admin.");
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
      perms.add("admin.full");
      perms.add("planning.create");
      perms.add("clients.view");
      perms.add("clients.create");
      perms.add("clients.edit");
      perms.add("drive.all");
      perms.add("catalog.edit");
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
  name: z.string().trim().min(2).max(150),
  password: z.string().min(4, "Le mot de passe doit faire au moins 4 caractères"),
  rolePreset: z.enum(["admin", "instructor", "secretary", "custom"]).default("instructor"),
  permissions: z.array(z.string()).default([]),
});

export async function createAdminUser(raw: unknown) {
  const caller = await requireUser();
  if (!caller.permissions.includes("admin.full") && !caller.permissions.includes("technical_admin")) {
    throw new HttpError(403, "Accès réservé aux administrateurs");
  }
  await ensureTables();

  const data = CreateUserSchema.parse(raw);
  const identifier = data.email.toLowerCase().trim();

  // Check unique identifier
  const existing = await db().query("SELECT 1 FROM app_user WHERE lower(email) = $1", [identifier]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new HttpError(400, "Un profil avec cet identifiant ou email existe déjà.");
  }

  const passHash = hashPassword(data.password);
  const insertUserRes = await db().query(
    `INSERT INTO app_user (email, name, password_hash, active, role_preset)
     VALUES ($1, $2, $3, true, $4) RETURNING id`,
    [identifier, data.name.trim(), passHash, data.rolePreset],
  );
  const newUserId = insertUserRes.rows[0].id;

  // Compute final permissions based on role preset
  const permsToInsert = new Set<string>(data.permissions);
  if (data.rolePreset === "admin") {
    permsToInsert.add("admin.full");
    permsToInsert.add("planning.create");
    permsToInsert.add("clients.view");
    permsToInsert.add("clients.create");
    permsToInsert.add("clients.edit");
    permsToInsert.add("drive.all");
    permsToInsert.add("catalog.edit");
  } else if (data.rolePreset === "instructor") {
    permsToInsert.add("planning.create");
    permsToInsert.add("planning.own_only");
    permsToInsert.add("clients.view");
  } else if (data.rolePreset === "secretary") {
    permsToInsert.add("planning.create");
    permsToInsert.add("clients.view");
    permsToInsert.add("clients.create");
    permsToInsert.add("clients.edit");
  }

  // Insert permissions
  for (const perm of permsToInsert) {
    await db().query(
      `INSERT INTO user_permission(user_id, permission_id) VALUES($1, $2) ON CONFLICT DO NOTHING`,
      [newUserId, perm],
    );
  }

  // Assign user_role
  const roleName = data.rolePreset === "admin" ? "technical_admin" : "instructor";
  await db().query(
    `INSERT INTO user_role(user_id, role_id) VALUES($1, $2) ON CONFLICT DO NOTHING`,
    [newUserId, roleName],
  );

  // If instructor role, automatically ensure instructor resource exists
  if (data.rolePreset === "instructor" || permsToInsert.has("planning.own_only")) {
    await db().query(
      `INSERT INTO instructor (name, active) VALUES ($1, true) ON CONFLICT DO NOTHING`,
      [data.name.trim()],
    ).catch(() => {});
  }

  return { ok: true, id: newUserId };
}

const UpdateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(150).optional(),
  active: z.boolean().optional(),
  rolePreset: z.enum(["admin", "instructor", "secretary", "custom"]).optional(),
  permissions: z.array(z.string()).optional(),
  newPassword: z.string().min(4).optional(),
});

export async function updateAdminUser(raw: unknown) {
  const caller = await requireUser();
  if (!caller.permissions.includes("admin.full") && !caller.permissions.includes("technical_admin")) {
    throw new HttpError(403, "Accès réservé aux administrateurs");
  }
  await ensureTables();

  const data = UpdateUserSchema.parse(raw);

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
    // Delete existing permissions and re-insert
    await db().query(`DELETE FROM user_permission WHERE user_id = $1`, [data.id]);
    for (const perm of data.permissions) {
      await db().query(
        `INSERT INTO user_permission(user_id, permission_id) VALUES($1, $2) ON CONFLICT DO NOTHING`,
        [data.id, perm],
      );
    }
    // Update role if admin.full changed
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
  if (!caller.permissions.includes("admin.full") && !caller.permissions.includes("technical_admin")) {
    throw new HttpError(403, "Accès réservé aux administrateurs");
  }
  await ensureTables();

  const { id } = z.object({ id: z.string().uuid() }).parse(raw);
  if (id === caller.id) {
    throw new HttpError(400, "Vous ne pouvez pas supprimer votre propre compte administrateur.");
  }

  await db().query("DELETE FROM auth_session WHERE user_id = $1", [id]);
  await db().query("DELETE FROM user_permission WHERE user_id = $1", [id]);
  await db().query("DELETE FROM user_role WHERE user_id = $1", [id]);
  await db().query("DELETE FROM app_user WHERE id = $1", [id]);

  return { ok: true };
}
