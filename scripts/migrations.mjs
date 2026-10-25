import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
/** Apply migrations under the same lock for CLI and embedded preview startup. */
export async function migrate(client) {
  await client.query("SELECT pg_advisory_lock(781234)");
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migration(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
    );
    for (const name of (await readdir(join(process.cwd(), "db", "migrations")))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      if (
        (
          await client.query("SELECT 1 FROM schema_migration WHERE name=$1", [
            name,
          ])
        ).rowCount
      )
        continue;
      await client.query("BEGIN");
      try {
        await client.query(
          await readFile(join(process.cwd(), "db", "migrations", name), "utf8"),
        );
        await client.query("INSERT INTO schema_migration(name) VALUES($1)", [
          name,
        ]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(781234)");
  }
}
