import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  hashPassword,
  verifyPassword,
  isValidEmail,
  normalizeEmail,
  redactSensitive,
} from "../server/accounts.mjs";
import { splitSqlStatements } from "../scripts/migrations-mysql.mjs";
import { getMysqlConfig, isMysqlMode } from "../server/mysql.mjs";
import {
  savePrivateFile,
  readPrivateFile,
  deletePrivateFile,
  resolveSafeStoragePath,
  validateFilePayload,
  getStorageRoot,
} from "../server/storage.ts";

test("bcrypt hachage sécurisé, validation e-mail et masquage des secrets", () => {
  const secretPass = "MotDePasseTest!2026#Secure";
  const hashed = hashPassword(secretPass);
  assert.match(hashed, /^\$2[aby]\$12\$/);
  assert.notEqual(hashed, secretPass);
  assert.equal(verifyPassword(secretPass, hashed), true);
  assert.equal(verifyPassword("mauvais-mot-de-passe", hashed), false);
  assert.equal(verifyPassword(secretPass, "$2b$12$malformed"), false);

  assert.equal(isValidEmail("admin@gopermis.fr"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("bad@@domain.com"), false);
  assert.equal(normalizeEmail("  Admin@GoPermis.FR "), "admin@gopermis.fr");

  const oldPass = process.env.DB_PASSWORD;
  process.env.DB_PASSWORD = "SuperSecretMysqlPassword99";
  try {
    const leaked = redactSensitive(
      "Erreur MySQL password=SuperSecretMysqlPassword99 token=abc123def",
    );
    assert.equal(leaked.includes("SuperSecretMysqlPassword99"), false);
    assert.equal(leaked.includes("abc123def"), false);
  } finally {
    if (oldPass === undefined) delete process.env.DB_PASSWORD;
    else process.env.DB_PASSWORD = oldPass;
  }
});

test("stockage privé hors public/, validation MIME/signatures et blocage path traversal", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "gopermis-storage-"));
  const prevDir = process.env.STORAGE_DIR;
  const prevMax = process.env.MAX_UPLOAD_BYTES;
  process.env.STORAGE_DIR = tempRoot;
  process.env.MAX_UPLOAD_BYTES = "1024";

  try {
    const publicDir = resolve(process.cwd(), "public");
    assert.equal(getStorageRoot().startsWith(publicDir), false);

    // Refus si STORAGE_DIR pointe dans public/
    process.env.STORAGE_DIR = join(publicDir, "uploads");
    assert.throws(() => getStorageRoot(), (e) => e.status === 500);
    process.env.STORAGE_DIR = tempRoot;

    // Upload PDF valide
    const pdfPayload = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
    const saved = await savePrivateFile("contrat_eleve.pdf", "application/pdf", pdfPayload, "clients-test");
    assert.equal(saved.originalName, "contrat_eleve.pdf");
    assert.equal(saved.storagePath.includes(".."), false);

    const diskPath = resolveSafeStoragePath(saved.storagePath);
    const st = await stat(diskPath);
    assert.equal(st.isFile(), true);
    const readBack = await readPrivateFile(saved.storagePath);
    assert.deepEqual(readBack, pdfPayload);

    // Rejets sécurité fichiers
    assert.throws(
      () => validateFilePayload("../etc/passwd.pdf", "application/pdf", pdfPayload),
      (e) => e.status === 400,
    );
    assert.throws(
      () => validateFilePayload("shell.php", "application/x-httpd-php", Buffer.from("<?php")),
      (e) => e.status === 415,
    );
    assert.throws(
      () => validateFilePayload("faux.pdf", "image/png", pdfPayload),
      (e) => e.status === 415,
    );
    assert.throws(
      () => validateFilePayload("faux_contenu.pdf", "application/pdf", Buffer.from("NOT_A_PDF")),
      (e) => e.status === 415,
    );
    assert.throws(
      () => validateFilePayload("vide.pdf", "application/pdf", Buffer.alloc(0)),
      (e) => e.status === 400,
    );
    assert.throws(
      () => validateFilePayload("trop_gros.txt", "text/plain", Buffer.alloc(2048, 65)),
      (e) => e.status === 413,
    );
    assert.throws(
      () => resolveSafeStoragePath("../../secrets.txt"),
      (e) => e.status === 400 || e.status === 403,
    );

    await deletePrivateFile(saved.storagePath);
    await assert.rejects(() => readPrivateFile(saved.storagePath), (e) => e.status === 404);
  } finally {
    if (prevDir === undefined) delete process.env.STORAGE_DIR;
    else process.env.STORAGE_DIR = prevDir;
    if (prevMax === undefined) delete process.env.MAX_UPLOAD_BYTES;
    else process.env.MAX_UPLOAD_BYTES = prevMax;
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("migration MySQL versionnée : tables obligatoires présentes et aucune instruction destructive", async () => {
  const sql = await readFile(
    resolve(process.cwd(), "db/migrations-mysql/001_init_mysql.sql"),
    "utf8",
  );
  const statements = splitSqlStatements(sql);
  assert.ok(statements.length >= 20);
  for (const stmt of statements) {
    assert.equal(/\bDROP\s+(DATABASE|SCHEMA)\b/i.test(stmt), false);
  }

  for (const table of [
    "users",
    "clients",
    "client_folders",
    "vehicles",
    "instructors",
    "bookings",
    "documents",
    "user_permissions",
    "audit_logs",
    "auth_sessions",
    "login_attempts",
  ]) {
    assert.ok(
      statements.some((s) => new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, "i").test(s)),
      `Table manquante dans 001_init_mysql.sql: ${table}`,
    );
  }
});

test("détection de mode MySQL et validation stricte de configuration", () => {
  const prevMode = process.env.DATABASE_MODE;
  const prevHost = process.env.DB_HOST;
  const prevName = process.env.DB_NAME;
  const prevUser = process.env.DB_USER;
  try {
    delete process.env.DATABASE_MODE;
    delete process.env.DB_HOST;
    delete process.env.DB_NAME;
    assert.equal(isMysqlMode(), false);

    process.env.DATABASE_MODE = "mysql";
    assert.equal(isMysqlMode(), true);
    assert.throws(() => getMysqlConfig(), /Configuration MySQL incomplète/);

    process.env.DB_HOST = "127.0.0.1";
    process.env.DB_NAME = "u949783941_awakecrm";
    process.env.DB_USER = "u949783941_awakecrm_user";
    const cfg = getMysqlConfig();
    assert.equal(cfg.host, "127.0.0.1");
    assert.equal(cfg.port, 3306);
    assert.equal(cfg.multipleStatements, false);
  } finally {
    if (prevMode === undefined) delete process.env.DATABASE_MODE;
    else process.env.DATABASE_MODE = prevMode;
    if (prevHost === undefined) delete process.env.DB_HOST;
    else process.env.DB_HOST = prevHost;
    if (prevName === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = prevName;
    if (prevUser === undefined) delete process.env.DB_USER;
    else process.env.DB_USER = prevUser;
  }
});
