/**
 * Réparation non destructive du schéma MySQL.
 *
 * Les migrations utilisent CREATE TABLE IF NOT EXISTS : une table créée par une
 * version précédente de l'application est conservée telle quelle, même s'il lui
 * manque des colonnes. Ce module compare chaque table attendue avec
 * information_schema et ajoute uniquement les colonnes absentes.
 * Rien n'est jamais supprimé, renommé ni modifié.
 */

const NON_COLUMN = /^(PRIMARY|UNIQUE|KEY|INDEX|CONSTRAINT|FOREIGN|FULLTEXT|SPATIAL|CHECK)\b/i;

function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      current += ch;
      if (ch === quote && body[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Extrait { table -> [{ name, definition }] } des CREATE TABLE d'une migration. */
export function parseExpectedColumns(statements) {
  const tables = new Map();
  for (const stmt of statements) {
    const m = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(([\s\S]*)\)\s*[^)]*$/i.exec(stmt.trim());
    if (!m) continue;
    const columns = [];
    for (const part of splitTopLevel(m[2])) {
      if (NON_COLUMN.test(part)) continue;
      const col = /^`?(\w+)`?\s+([\s\S]+)$/.exec(part);
      if (col) columns.push({ name: col[1], definition: col[2].trim() });
    }
    tables.set(m[1], columns);
  }
  return tables;
}

/** Définition utilisable dans ALTER TABLE ... ADD COLUMN (sans clé primaire en ligne). */
export function addableDefinition(definition) {
  return definition
    .replace(/\s+PRIMARY\s+KEY\b/i, "")
    .replace(/\s+UNIQUE(\s+KEY)?\b/i, "")
    .trim();
}

export async function repairMysqlSchema(conn, statements) {
  const expected = parseExpectedColumns(statements);
  const added = [];
  const failed = [];
  if (!expected.size) return { added, failed };

  const [rows] = await conn.query(
    `SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()`,
  );
  const existing = new Map();
  for (const r of rows) {
    const t = String(r.t).toLowerCase();
    if (!existing.has(t)) existing.set(t, new Set());
    existing.get(t).add(String(r.c).toLowerCase());
  }

  for (const [table, columns] of expected) {
    const present = existing.get(table.toLowerCase());
    if (!present) continue; // table absente : la migration l'a créée ou la créera
    for (const { name, definition } of columns) {
      if (present.has(name.toLowerCase())) continue;
      const def = addableDefinition(definition);
      try {
        await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${def}`);
        added.push(`${table}.${name}`);
      } catch {
        // Repli : colonne NULL si le remplissage des lignes existantes échoue.
        try {
          await conn.query(
            `ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${def.replace(/\bNOT\s+NULL\b/i, "NULL")}`,
          );
          added.push(`${table}.${name}`);
        } catch (err) {
          failed.push({ column: `${table}.${name}`, code: err?.code ?? "UNKNOWN" });
        }
      }
    }
  }
  return { added, failed };
}
