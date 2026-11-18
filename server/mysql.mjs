import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  redactSensitive,
  splitFullName,
} from "./accounts.mjs";

const key = Symbol.for("gopermis.mysql");
const state = globalThis[key] ?? (globalThis[key] = {});

export function isMysqlMode() {
  const mode = (process.env.DATABASE_MODE ?? "").trim().toLowerCase();
  if (mode === "mysql") return true;
  if (mode === "pglite" || mode === "postgres") return false;
  return Boolean(process.env.DB_HOST?.trim() && process.env.DB_NAME?.trim());
}

export function getMysqlConfig() {
  const host = (process.env.DB_HOST ?? "").trim();
  const port = Number(process.env.DB_PORT || "3306");
  const database = (process.env.DB_NAME ?? "").trim();
  const user = (process.env.DB_USER ?? "").trim();
  const password = process.env.DB_PASSWORD ?? "";

  if (!host || !database || !user) {
    throw new Error(
      "Configuration MySQL incomplète : DB_HOST, DB_NAME, DB_USER et DB_PASSWORD sont requis.",
    );
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("DB_PORT invalide.");
  }

  return {
    host,
    port,
    database,
    user,
    password,
    waitForConnections: true,
    connectionLimit: Math.max(1, Number(process.env.DB_POOL_SIZE || 10)),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    timezone: "Z",
    charset: "utf8mb4",
    multipleStatements: false,
  };
}

export async function getMysqlPool() {
  if (state.pool) return state.pool;
  if (!state.pending) {
    state.pending = (async () => {
      const config = getMysqlConfig();
      const pool = mysql.createPool(config);
      try {
        const conn = await pool.getConnection();
        try {
          await conn.execute("SELECT 1 AS ok");
        } finally {
          conn.release();
        }
        state.pool = pool;
        return pool;
      } catch (err) {
        await pool.end().catch(() => {});
        const msg = redactSensitive(
          err instanceof Error ? err.message : "Erreur de connexion MySQL",
        );
        throw new Error(`Connexion MySQL impossible : ${msg}`);
      }
    })().catch((err) => {
      state.pending = undefined;
      throw err;
    });
  }
  return state.pending;
}

/**
 * Applique automatiquement les migrations MySQL (idempotentes) une seule fois
 * par processus. Sur Hostinger, aucune commande manuelle n'est donc requise :
 * les tables sont créées au premier appel. Désactivable via MYSQL_AUTO_MIGRATE=0.
 */
export async function ensureMysqlSchema() {
  if ((process.env.MYSQL_AUTO_MIGRATE ?? "1").trim() === "0") return;
  if (state.migrated) return state.migrated;
  state.migrated = (async () => {
    await getMysqlPool();
    const { migrateMysql } = await import("../scripts/migrations-mysql.mjs");
    const result = await migrateMysql();
    if (result.applied.length)
      console.log(`MySQL : migrations appliquées -> ${result.applied.join(", ")}`);
    if (result.repaired?.length)
      console.log(`MySQL : colonnes ajoutées -> ${result.repaired.join(", ")}`);
    if (result.repairFailed?.length)
      console.error("MySQL : colonnes impossibles à ajouter", result.repairFailed);
    state.schemaIssues = result.repairFailed ?? [];
    await bootstrapMysqlAdmin();
  })().catch((err) => {
    state.migrated = undefined;
    throw err;
  });
  return state.migrated;
}

/**
 * Crée le premier administrateur à partir de BOOTSTRAP_EMAIL / BOOTSTRAP_NAME /
 * BOOTSTRAP_PASSWORD, uniquement si aucun administrateur actif n'existe. Aucun compte
 * existant n'est jamais modifié ni réinitialisé.
 */
async function bootstrapMysqlAdmin() {
  const password = process.env.BOOTSTRAP_PASSWORD ?? "";
  if (!password) return;
  const email = normalizeEmail(
    process.env.BOOTSTRAP_EMAIL ?? process.env.BOOTSTRAP_IDENTIFIER ?? "",
  );
  if (!isValidEmail(email) || password.length < 14 || password.length > 256) {
    console.error(
      "Compte initial ignoré : BOOTSTRAP_EMAIL valide et BOOTSTRAP_PASSWORD de 14 caractères minimum requis.",
    );
    return;
  }
  const name = (process.env.BOOTSTRAP_NAME ?? "Administrateur GoPermis").trim();
  const pool = state.pool;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Création uniquement si aucun administrateur actif n'existe (base vide ou
    // table héritée d'une ancienne version sans rôle admin). Aucun compte
    // existant n'est modifié.
    const [admins] = await conn.query(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1 FOR UPDATE",
    );
    if (Array.isArray(admins) && admins.length > 0) {
      await conn.rollback();
      return;
    }
    const [taken] = await conn.execute(
      "SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1",
      [email],
    );
    if (Array.isArray(taken) && taken.length > 0) {
      await conn.rollback();
      console.error(
        "Compte initial ignoré : BOOTSTRAP_EMAIL est déjà utilisé par un compte existant non administrateur. Choisissez une autre adresse.",
      );
      return;
    }
    const id = randomUUID();
    const { firstName, lastName } = splitFullName(name);
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
    console.log("MySQL : compte administrateur initial créé.");
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

async function readyPool() {
  const pool = await getMysqlPool();
  await ensureMysqlSchema();
  return pool;
}

export async function mysqlQuery(sql, params = []) {
  const pool = await readyPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function mysqlTransaction(fn) {
  const pool = await readyPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

export async function testMysqlConnection() {
  try {
    const pool = await readyPool();
    const [rows] = await pool.execute(
      "SELECT 1 AS ok, DATABASE() AS database_name, VERSION() AS server_version",
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    return {
      ok: Boolean(row && Number(row.ok) === 1),
      schemaIssues: state.schemaIssues ?? [],
      database: row?.database_name ? String(row.database_name) : null,
      version: row?.server_version ? String(row.server_version) : null,
    };
  } catch (err) {
    return {
      ok: false,
      database: null,
      version: null,
      error: redactSensitive(
        err instanceof Error ? err.message : "Erreur MySQL inconnue",
      ),
    };
  }
}

export async function closeMysqlPool() {
  if (state.pool) {
    try {
      await state.pool.end();
    } finally {
      state.pool = undefined;
      state.pending = undefined;
      state.migrated = undefined;
      delete globalThis[key];
    }
  }
}
