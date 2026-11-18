import { randomUUID } from "node:crypto";
import { migrateMysql } from "../scripts/migrations-mysql.mjs";
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  splitFullName,
} from "./accounts.mjs";

/**
 * Préparation automatique de la base MySQL au premier accès :
 *  1. applique les migrations manquantes (idempotent, verrou GET_LOCK) ;
 *  2. si AUCUN utilisateur n'existe et que BOOTSTRAP_EMAIL/BOOTSTRAP_PASSWORD
 *     sont fournis, crée le premier compte administrateur (admin.full).
 * Aucun compte existant n'est jamais modifié.
 * Désactivable avec DB_AUTO_MIGRATE=0.
 */
export async function prepareMysql(pool) {
  if ((process.env.DB_AUTO_MIGRATE ?? "1").trim() === "0") return;
  const { applied } = await migrateMysql(pool);
  if (applied.length)
    console.log(`MySQL : migrations appliquées -> ${applied.join(", ")}`);
  await bootstrapAdmin(pool);
}

async function bootstrapAdmin(pool) {
  const email = normalizeEmail(
    process.env.BOOTSTRAP_EMAIL ?? process.env.BOOTSTRAP_IDENTIFIER ?? "",
  );
  const password = process.env.BOOTSTRAP_PASSWORD ?? "";
  if (!email && !password) return;
  if (!isValidEmail(email) || password.length < 14 || password.length > 256) {
    console.error(
      "Bootstrap admin ignoré : BOOTSTRAP_EMAIL doit être un e-mail valide et BOOTSTRAP_PASSWORD contenir 14 à 256 caractères.",
    );
    return;
  }
  const [rows] = await pool.query("SELECT COUNT(*) AS n FROM users");
  if (Number(rows[0]?.n ?? 0) > 0) return;

  const name = (process.env.BOOTSTRAP_NAME ?? "Administrateur").trim() || "Administrateur";
  const { firstName, lastName } = splitFullName(name);
  const id = randomUUID();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Re-vérifie sous verrou pour éviter deux créations concurrentes.
    const [again] = await conn.query("SELECT COUNT(*) AS n FROM users FOR UPDATE");
    if (Number(again[0]?.n ?? 0) > 0) {
      await conn.rollback();
      return;
    }
    await conn.execute(
      `INSERT INTO users (id, first_name, last_name, name, email, password_hash, role, role_preset, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 'admin', 'admin', 1)`,
      [id, firstName, lastName, name, email, hashPassword(password)],
    );
    await conn.execute(
      "INSERT IGNORE INTO user_permissions (id, user_id, permission_name) VALUES (?, ?, 'admin.full')",
      [randomUUID(), id],
    );
    await conn.commit();
    console.log(`MySQL : compte administrateur initial créé (${email}).`);
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}
