import type { Pool } from "pg";
export function database(options?: { bootstrap?: boolean }): Promise<Pool>;
export function closeDatabase(): Promise<void>;
