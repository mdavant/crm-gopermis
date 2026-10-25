import type { QueryConfig, QueryResult, QueryResultRow } from "pg";
import { database, closeDatabase } from "./database.mjs";
export function db() {
  return {
    async query<R extends QueryResultRow = QueryResultRow>(
      query: string | QueryConfig,
      values?: unknown[],
    ): Promise<QueryResult<R>> {
      const pool = await database();
      return typeof query === "string"
        ? pool.query<R>(query, values)
        : pool.query<R>(query);
    },
    async connect() {
      return (await database()).connect();
    },
    end: closeDatabase,
  };
}
