import { Pool } from "pg";
const globalDb = globalThis as unknown as { pool?: Pool };
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL non configurée");
  return (globalDb.pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_SIZE ?? 10),
  }));
}
