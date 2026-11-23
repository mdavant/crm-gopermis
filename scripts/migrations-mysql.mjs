import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getMysqlPool } from "../server/mysql.mjs";
import { repairMysqlSchema } from "./mysql-schema-repair.mjs";

/**
 * Découpe un fichier SQL en instructions individuelles en ignorant les
 * commentaires -- et les points-virgules à l'intérieur des chaînes SQL.
 */
export function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (ch === "-" && next === "-") {
        inLineComment = true;
        i++;
        continue;
      }
      if (ch === "/" && next === "*") {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    if (ch === "'" && !inDoubleQuote) {
      if (inSingleQuote && next === "'") {
        current += "''";
        i++;
        continue;
      }
      if (inSingleQuote && sql[i - 1] === "\\") {
        current += ch;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }

    if (ch === ";" && !inSingleQuote && !inDoubleQuote) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

function migrationsDir() {
  return join(process.cwd(), "db", "migrations-mysql");
}

async function ensureSchemaMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function getMysqlMigrationStatus() {
  const pool = await getMysqlPool();
  const conn = await pool.getConnection();
  try {
    await ensureSchemaMigrationsTable(conn);
    const [rows] = await conn.query(
      "SELECT name, applied_at FROM schema_migrations ORDER BY name ASC",
    );
    const appliedMap = new Map(
      rows.map((r) => [String(r.name), r.applied_at]),
    );

    const files = (await readdir(migrationsDir()))
      .filter((n) => n.endsWith(".sql"))
      .sort();

    return files.map((name) => ({
      name,
      applied: appliedMap.has(name),
      appliedAt: appliedMap.get(name) ?? null,
    }));
  } finally {
    conn.release();
  }
}

export async function migrateMysql() {
  const pool = await getMysqlPool();
  const conn = await pool.getConnection();
  const appliedNow = [];
  let repair = { added: [], failed: [] };
  try {
    const [lockRows] = await conn.query(
      "SELECT GET_LOCK('gopermis_crm_migrations', 30) AS acquired",
    );
    const acquired = Array.isArray(lockRows) && Number(lockRows[0]?.acquired) === 1;
    if (!acquired) {
      throw new Error("Impossible d'acquérir le verrou de migration MySQL.");
    }

    try {
      await ensureSchemaMigrationsTable(conn);
      const files = (await readdir(migrationsDir()))
        .filter((n) => n.endsWith(".sql"))
        .sort();

      // Colonnes des tables existantes ajoutées AVANT les migrations, qui peuvent s'en servir.
      const preStatements = [];
      for (const name of files) {
        preStatements.push(...splitSqlStatements(await readFile(join(migrationsDir(), name), "utf8")));
      }
      const pre = await repairMysqlSchema(conn, preStatements);

      for (const name of files) {
        const [existing] = await conn.execute(
          "SELECT 1 FROM schema_migrations WHERE name = ?",
          [name],
        );
        if (Array.isArray(existing) && existing.length > 0) continue;

        const sql = await readFile(join(migrationsDir(), name), "utf8");
        const statements = splitSqlStatements(sql);

        for (const stmt of statements) {
          if (/^\s*DROP\s+(DATABASE|SCHEMA)\b/i.test(stmt)) {
            throw new Error(`Instruction dangereuse refusée dans ${name}`);
          }
          await conn.query(stmt);
        }

        await conn.execute(
          "INSERT INTO schema_migrations (name) VALUES (?)",
          [name],
        );
        appliedNow.push(name);
      }

      // Tables héritées d'une ancienne version : ajoute les colonnes manquantes.
      const allStatements = [];
      for (const name of files) {
        allStatements.push(
          ...splitSqlStatements(await readFile(join(migrationsDir(), name), "utf8")),
        );
      }
      const post = await repairMysqlSchema(conn, allStatements);
      repair = { added: [...pre.added, ...post.added], failed: post.failed };
    } finally {
      await conn.query("SELECT RELEASE_LOCK('gopermis_crm_migrations')").catch(() => {});
    }
  } finally {
    conn.release();
  }
  return { applied: appliedNow, repaired: repair.added, repairFailed: repair.failed };
}
