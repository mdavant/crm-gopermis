import pg from "pg";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { migrate } from "../scripts/migrations.mjs";
import { accountInput, createAccount } from "./accounts.mjs";

const key = Symbol.for("gopermis.database");
const state = globalThis[key] ?? (globalThis[key] = {});

async function initialise(bootstrap) {
  let pool, embedded, socket;
  try {
    const rawUrl = process.env.DATABASE_URL?.trim();
    const isPlaceholder =
      rawUrl && (rawUrl.includes("change-me") || rawUrl.includes("localhost:5432"));
    const url = isPlaceholder ? "" : rawUrl;

    let mode =
      process.env.DATABASE_MODE ??
      (url
        ? "postgres"
        : "pglite");

    if (mode === "postgres") {
      try {
        pool = new pg.Pool({
          connectionString: url,
          max: Number(process.env.DB_POOL_SIZE ?? 10),
          connectionTimeoutMillis: 3000,
        });
        await pool.query("SELECT 1");
      } catch (e) {
        console.warn("PostgreSQL connection failed, falling back to embedded PGlite:", e.message);
        await pool?.end().catch(() => {});
        pool = undefined;
        mode = "pglite";
      }
    }

    if (mode === "pglite") {
      const [{ PGlite }, { btree_gist }, { PGLiteSocketServer }] =
        await Promise.all([
          import("@electric-sql/pglite"),
          import("@electric-sql/pglite/contrib/btree_gist"),
          import("@electric-sql/pglite-socket"),
        ]);
      const dataDir = resolve(process.env.PGLITE_DATA_DIR ?? ".data/preview");
      await mkdir(dataDir, { recursive: true });
      embedded = await PGlite.create({ dataDir, extensions: { btree_gist } });
      socket = new PGLiteSocketServer({
        db: embedded,
        port: Number(process.env.PGLITE_PORT ?? 0),
        host: "127.0.0.1",
        maxConnections: 1,
      });
      await socket.start();
      pool = new pg.Pool({
        connectionString: `postgres://preview:preview@${socket.getServerConn()}/postgres`,
        max: 1,
        connectionTimeoutMillis: 5000,
      });
      const client = await pool.connect();
      try {
        await migrate(client);
      } finally {
        client.release();
      }
    }

    if (bootstrap) {
      const client = await pool.connect();
      try {
        const hasUsers = (await client.query("SELECT 1 FROM app_user LIMIT 1")).rowCount;
        if (!hasUsers) {
          const bootstrapData = process.env.BOOTSTRAP_PASSWORD
            ? accountInput()
            : {
                identifier: (process.env.BOOTSTRAP_IDENTIFIER || "admin").toLowerCase(),
                name: process.env.BOOTSTRAP_NAME || "Administrateur GoPermis",
                password: process.env.BOOTSTRAP_PASSWORD || "GoPermis2026!Admin",
              };
          await createAccount(client, bootstrapData, { initialOnly: true });
        }

        // Seed demo data for initial exploration if empty
        const adminRes = await client.query("SELECT id FROM app_user LIMIT 1");
        if (adminRes.rowCount) {
          const adminId = adminRes.rows[0].id;
          const vCount = (await client.query("SELECT 1 FROM vehicle LIMIT 1")).rowCount;
          if (!vCount) {
            await client.query(
              "INSERT INTO vehicle(model_id, label, created_by) VALUES($1, $2, $3), ($4, $5, $6), ($7, $8, $9) ON CONFLICT DO NOTHING",
              [
                "clio-manual", "Clio V Manuelle (01)", adminId,
                "clio-auto", "Clio V Automatique (02)", adminId,
                "rs3", "Audi RS3 Sportback (03)", adminId
              ]
            );
          }
        }
      } catch (err) {
        console.warn("Bootstrap admin notice:", err.message);
      } finally {
        client.release();
      }
    }

    state.pool = pool;
    state.embedded = embedded;
    state.socket = socket;
    return pool;
  } catch (e) {
    await pool?.end().catch(() => {});
    await socket?.stop().catch(() => {});
    if (socket) await new Promise((r) => setTimeout(r, 200));
    await embedded?.close().catch(() => {});
    throw e;
  }
}

export async function database({ bootstrap = true } = {}) {
  if (state.pool) return state.pool;
  if (!state.pending)
    state.pending = initialise(bootstrap).catch((e) => {
      state.pending = undefined;
      throw e;
    });
  return state.pending;
}

export async function closeDatabase() {
  await state.pool?.end();
  await state.socket?.stop();
  if (state.socket) await new Promise((r) => setTimeout(r, 200));
  await state.embedded?.close();
  delete globalThis[key];
  state.pool = undefined;
  state.pending = undefined;
  state.socket = undefined;
  state.embedded = undefined;
}
