import { Pool, type PoolClient, type QueryResult, type QueryResultRow, type QueryConfig } from "pg";
import { scryptSync, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

interface GlobalDatabaseState {
  _dbPool?: Pool;
  _dbInitPromise?: Promise<Pool>;
  _pgliteServer?: PGLiteSocketServer;
}

const state = globalThis as unknown as GlobalDatabaseState;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}

async function seedAdmin(client: PoolClient, identifier: string, password: string, name: string) {
  const idLower = identifier.trim().toLowerCase();
  const existing = await client.query("SELECT id FROM app_user WHERE lower(email)=$1", [idLower]);
  const hash = hashPassword(password);
  let userId: string;

  if (existing.rowCount && existing.rowCount > 0) {
    userId = existing.rows[0].id;
    await client.query("UPDATE app_user SET password_hash=$1, active=true WHERE id=$2", [hash, userId]);
  } else {
    const res = await client.query(
      "INSERT INTO app_user(email, name, password_hash) VALUES($1, $2, $3) RETURNING id",
      [idLower, name, hash]
    );
    userId = res.rows[0].id;
  }

  await client.query(
    "INSERT INTO user_role(user_id, role_id) VALUES($1, 'technical_admin') ON CONFLICT DO NOTHING",
    [userId]
  );
  return userId;
}

async function bootstrapDatabase(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migration(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())"
    );

    const migrationsDir = join(process.cwd(), "db", "migrations");
    const migrationFiles = ["001_core.sql", "002_history_guards.sql", "003_schedule.sql"];

    for (const name of migrationFiles) {
      const check = await client.query("SELECT 1 FROM schema_migration WHERE name=$1", [name]);
      if (check.rowCount && check.rowCount > 0) continue;

      const sql = await readFile(join(migrationsDir, name), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migration(name) VALUES($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Migration failed:", name, err);
        throw err;
      }
    }

    // Seed administrator accounts with full permissions
    const adminId = await seedAdmin(client, "admin", "GoPermis2026!Admin", "Administrateur GoPermis");
    await seedAdmin(client, "contact.gopermis31@gmail.com", "GoPermis2026!Admin", "Contact GoPermis");

    // Seed sample resources and clients if empty for immediate usability in preview
    const vehicles = await client.query("SELECT id FROM vehicle LIMIT 1");
    if (!vehicles.rowCount || vehicles.rowCount === 0) {
      await client.query(
        "INSERT INTO vehicle(model_id, label, created_by) VALUES($1, $2, $3), ($4, $5, $6) ON CONFLICT DO NOTHING",
        ["clio-manual", "Clio V Manuelle (01)", adminId, "clio-auto", "Clio V Automatique (02)", adminId]
      );
    }

    const instructors = await client.query("SELECT id FROM instructor LIMIT 1");
    if (!instructors.rowCount || instructors.rowCount === 0) {
      await client.query(
        "INSERT INTO instructor(name, created_by) VALUES($1, $2), ($3, $4)",
        ["Marc Moniteur", adminId, "Sarah Monitrice", adminId]
      );
    }

    const clients = await client.query("SELECT id FROM client LIMIT 1");
    if (!clients.rowCount || clients.rowCount === 0) {
      await client.query(
        "INSERT INTO client(first_name, last_name, phone, email, source, status) VALUES($1, $2, $3, $4, $5, $6)",
        ["Thomas", "Martin", "06 12 34 56 78", "thomas.martin@example.fr", "Site web", "Actif"]
      );
    }
  } finally {
    client.release();
  }
}

async function getPool(): Promise<Pool> {
  if (state._dbPool) return state._dbPool;
  if (state._dbInitPromise) return state._dbInitPromise;

  state._dbInitPromise = (async () => {
    let pool: Pool | null = null;
    const envUrl = process.env.DATABASE_URL;

    if (envUrl && !envUrl.includes("change-me") && !envUrl.includes("localhost:5432")) {
      try {
        const candidatePool = new Pool({
          connectionString: envUrl,
          max: Number(process.env.DB_POOL_SIZE ?? 10),
          connectionTimeoutMillis: 1500,
        });
        await candidatePool.query("SELECT 1");
        pool = candidatePool;
      } catch (err) {
        console.warn("External DATABASE_URL failed, falling back to embedded PGlite:", err);
      }
    }

    if (!pool) {
      const pglite = await PGlite.create({
        extensions: { btree_gist },
      });

      const port = Number(process.env.PGLITE_PORT || 55436);
      try {
        const server = new PGLiteSocketServer({
          db: pglite,
          port,
          host: "127.0.0.1",
        });
        await server.start();
        state._pgliteServer = server;
      } catch (err: unknown) {
        const isAddrInUse =
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "EADDRINUSE";
        if (!isAddrInUse) throw err;
      }

      process.env.DATABASE_URL = `postgres://test:test@127.0.0.1:${port}/postgres`;
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1,
      });
    }

    try {
      await bootstrapDatabase(pool);
    } catch (e) {
      console.warn("Bootstrap database warning:", e);
    }

    state._dbPool = pool;
    return pool;
  })();

  return state._dbInitPromise;
}

export function db() {
  return {
    async query<R extends QueryResultRow = QueryResultRow>(
      queryTextOrConfig: string | QueryConfig,
      values?: unknown[]
    ): Promise<QueryResult<R>> {
      const pool = await getPool();
      if (typeof queryTextOrConfig === "string") {
        return pool.query<R>(queryTextOrConfig, values);
      }
      return pool.query<R>(queryTextOrConfig);
    },
    async connect(): Promise<PoolClient> {
      const pool = await getPool();
      return pool.connect();
    },
    async end(): Promise<void> {
      const pool = await getPool();
      return pool.end();
    },
  };
}
