import mysql from "mysql2/promise";
import { redactSensitive } from "./accounts.mjs";

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
      } catch (err) {
        await pool.end().catch(() => {});
        const msg = redactSensitive(
          err instanceof Error ? err.message : "Erreur de connexion MySQL",
        );
        const e = new Error(`Connexion MySQL impossible : ${msg}`);
        e.code = err?.code;
        console.error(e.message);
        throw e;
      }
      try {
        const { prepareMysql } = await import("./mysql-setup.mjs");
        await prepareMysql(pool);
      } catch (err) {
        await pool.end().catch(() => {});
        const msg = redactSensitive(
          err instanceof Error ? err.message : "Erreur d'initialisation MySQL",
        );
        const e = new Error(`Initialisation MySQL impossible : ${msg}`);
        e.code = err?.code;
        console.error(e.message);
        throw e;
      }
      state.pool = pool;
      return pool;
    })().catch((err) => {
      state.pending = undefined;
      throw err;
    });
  }
  return state.pending;
}

export async function mysqlQuery(sql, params = []) {
  const pool = await getMysqlPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function mysqlTransaction(fn) {
  const pool = await getMysqlPool();
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
    const pool = await getMysqlPool();
    const [rows] = await pool.execute(
      "SELECT 1 AS ok, DATABASE() AS database_name, VERSION() AS server_version",
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    return {
      ok: Boolean(row && Number(row.ok) === 1),
      database: row?.database_name ? String(row.database_name) : null,
      version: row?.server_version ? String(row.server_version) : null,
    };
  } catch (err) {
    return {
      ok: false,
      database: null,
      version: null,
      code: err?.code ?? null,
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
      delete globalThis[key];
    }
  }
}
