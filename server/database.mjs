import pg from "pg";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { embeddedPool } from "./embedded-pool.mjs";
import { migrate } from "../scripts/migrations.mjs";
import { accountInput, createAccount } from "./accounts.mjs";
// Shared across Next HMR/module reloads; a failed init can be retried.
const key = Symbol.for("gopermis.database");
const state = globalThis[key] ?? (globalThis[key] = {});
async function initialise(bootstrap) {
  let pool, embedded, socket;
  try {
    const rawUrl = process.env.DATABASE_URL?.trim();
    const isPlaceholder = Boolean(rawUrl && (rawUrl.includes("change-me") || rawUrl.includes("localhost:5432")));
    const url = isPlaceholder ? "" : rawUrl;
    let mode = process.env.DATABASE_MODE ?? (url ? "postgres" : "pglite");
    if (isPlaceholder && process.env.DATABASE_MODE === "postgres") {
      mode = "pglite";
    }

    if (mode === "postgres" && url) {
      try {
        pool = new pg.Pool({
          connectionString: url,
          max: Number(process.env.DB_POOL_SIZE ?? 10),
          connectionTimeoutMillis: 3000,
        });
        await pool.query("SELECT 1");
      } catch (err) {
        console.warn("PostgreSQL unreachable, falling back to embedded PGlite:", err?.message || err);
        await pool?.end().catch(() => {});
        pool = null;
        mode = "pglite";
      }
    }

    if (mode === "pglite" || !pool) {
      const [{ PGlite }, { btree_gist }, { pg_trgm }] = await Promise.all([
        import("@electric-sql/pglite"),
        import("@electric-sql/pglite/contrib/btree_gist"),
        import("@electric-sql/pglite/contrib/pg_trgm"),
      ]);
      const dataDir = resolve(process.env.PGLITE_DATA_DIR ?? ".data/preview");
      await mkdir(dataDir, { recursive: true });
      embedded = await PGlite.create({
        dataDir,
        extensions: { btree_gist, pg_trgm },
      });
      pool = embeddedPool(embedded);
      const client = await pool.connect();
      try {
        await migrate(client);
      } finally {
        client.release();
      }
    }
    if (bootstrap && process.env.BOOTSTRAP_PASSWORD) {
      const client = await pool.connect();
      try {
        if (!(await client.query("SELECT 1 FROM app_user LIMIT 1")).rowCount)
          await createAccount(client, accountInput(), { initialOnly: true });
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
    if (!pool) await embedded?.close().catch(() => {});
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
  if (!state.pool) await state.embedded?.close();
  delete globalThis[key];
  state.pool = undefined;
  state.pending = undefined;
  state.socket = undefined;
  state.embedded = undefined;
}
