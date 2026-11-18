import { z } from "zod";
import { db } from "./db";
import { isMysqlMode, mysqlQuery, mysqlTransaction } from "./mysql.mjs";
import { HttpError } from "./auth";
import { createAccount, hashPassword, splitFullName } from "./accounts.mjs";
import { randomUUID } from "node:crypto";

/**
 * MySQL : le formulaire « Initialiser l'accès administrateur » n'est ouvert
 * que tant qu'aucun administrateur actif n'existe. Il se ferme de lui-même
 * dès la création du premier compte.
 */
async function mysqlAdminMissing() {
  const rows = (await mysqlQuery(
    "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1",
  )) as unknown[];
  return rows.length === 0;
}

/** Initial setup is for private development previews only, never PostgreSQL/MySQL production deployments. */
function allowed() {
  if (isMysqlMode()) return false;
  const embedded =
    process.env.DATABASE_MODE === "pglite" ||
    (!process.env.DATABASE_MODE && !process.env.DATABASE_URL);
  return (
    embedded &&
    (process.env.NODE_ENV !== "production" ||
      process.env.ALLOW_PREVIEW_SETUP === "1")
  );
}

export async function setupStatus() {
  if (isMysqlMode()) return { required: await mysqlAdminMissing() };
  if (!allowed()) return { required: false };
  return {
    required: !(await db().query("SELECT 1 FROM app_user LIMIT 1")).rowCount,
  };
}

export async function setupAccount(raw: unknown) {
  if (isMysqlMode()) return setupMysqlAdmin(raw);
  if (!allowed())
    throw new HttpError(403, "Création initiale réservée à l’aperçu privé.");
  const x = z
    .object({
      identifiant: z.string().trim().min(1).max(254),
      name: z.string().trim().min(1).max(150),
      password: z.string().min(14, "14 caractères minimum").max(256),
    })
    .parse(raw);
  const c = await db().connect();
  try {
    const created = await createAccount(
      c,
      {
        identifier: x.identifiant.toLowerCase(),
        name: x.name,
        password: x.password,
      },
      { initialOnly: true },
    );
    if (!created)
      throw new HttpError(
        409,
        "Un compte existe déjà. Connectez-vous avec son identifiant et son mot de passe.",
      );
    return { ok: true };
  } finally {
    c.release();
  }
}

const mysqlSetupInput = z.object({
  identifiant: z.string().trim().min(1).max(254),
  name: z.string().trim().min(1).max(150),
  password: z.string().min(14, "14 caractères minimum").max(256),
});

async function setupMysqlAdmin(raw: unknown) {
  const x = mysqlSetupInput.parse(raw);
  const identifier = x.identifiant.toLowerCase();
  const created = await mysqlTransaction(async (conn) => {
    const [lock] = await conn.query(
      "SELECT GET_LOCK('gopermis_initial_admin', 10) AS acquired",
    );
    if (Number((lock as Record<string, unknown>[])[0]?.acquired) !== 1)
      throw new HttpError(503, "Réessayez dans quelques secondes.");
    try {
      const [admins] = await conn.query(
        "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1",
      );
      if ((admins as unknown[]).length > 0) return false;
      const [taken] = await conn.execute(
        "SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1",
        [identifier],
      );
      if ((taken as unknown[]).length > 0)
        throw new HttpError(409, "Cet identifiant est déjà utilisé. Choisissez-en un autre.");
      const id = randomUUID();
      const { firstName, lastName } = splitFullName(x.name);
      await conn.execute(
        `INSERT INTO users (id, first_name, last_name, name, email, password_hash, role, role_preset, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 'admin', 'admin', 1)`,
        [id, firstName, lastName, x.name, identifier, hashPassword(x.password)],
      );
      await conn.execute(
        "INSERT IGNORE INTO user_permissions (id, user_id, permission_name) VALUES (?, ?, 'admin.full')",
        [randomUUID(), id],
      );
      return true;
    } finally {
      await conn.query("SELECT RELEASE_LOCK('gopermis_initial_admin')");
    }
  });
  if (!created)
    throw new HttpError(
      409,
      "Un compte existe déjà. Connectez-vous avec son identifiant et son mot de passe.",
    );
  return { ok: true };
}
