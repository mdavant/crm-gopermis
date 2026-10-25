import pg from "pg";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { migrate } from "../scripts/migrations.mjs";
import { accountInput, createAccount } from "./accounts.mjs";
// Shared across Next HMR/module reloads; a failed init can be retried.
const key = Symbol.for("gopermis.database");
const state = globalThis[key] ?? (globalThis[key] = {});
async function initialise(bootstrap) {
  let pool, embedded, socket;
  try {
    const url = process.env.DATABASE_URL?.trim();
    const mode =
      process.env.DATABASE_MODE ??
      (url
        ? "postgres"
        : process.env.NODE_ENV === "production"
          ? "postgres"
          : "pglite");
    if (mode === "postgres") {
      if (!url)
        throw Error(
          "DATABASE_URL requise en mode PostgreSQL. Pour une prévisualisation locale, configurer DATABASE_MODE=pglite.",
        );
      pool = new pg.Pool({
        connectionString: url,
        max: Number(process.env.DB_POOL_SIZE ?? 10),
        connectionTimeoutMillis: 5000,
      });
      // A configured DB failure must never redirect users to another database.
      await pool.query("SELECT 1");
    } else if (mode === "pglite") {
      if (url)
        throw Error(
          "Choisir une seule base : DATABASE_MODE=pglite requiert DATABASE_URL vide.",
        );
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
      await socket.start(); // Never attach to a different process on EADDRINUSE.
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
    } else throw Error("DATABASE_MODE invalide : postgres ou pglite attendu.");
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
