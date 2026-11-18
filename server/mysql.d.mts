import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";

export function isMysqlMode(): boolean;
export function getMysqlConfig(): Record<string, unknown>;
export function getMysqlPool(): Promise<Pool>;
export function mysqlQuery<T = RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: unknown[],
): Promise<T>;
export function mysqlTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T>;
export function testMysqlConnection(): Promise<{
  ok: boolean;
  database: string | null;
  version: string | null;
  code?: string | null;
  error?: string;
}>;
export function closeMysqlPool(): Promise<void>;
