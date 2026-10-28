// Dedicated disposable database only. Never uses or resets DATABASE_URL.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import pg from "pg";
const dir = await mkdtemp(join(tmpdir(), "gopermis-native-"));
const name = "gopermis-test-" + randomBytes(6).toString("hex");
async function run(cmd, args, env = {}) {
  const p = spawn(cmd, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  p.stdout.on("data", (b) => (out += b));
  p.stderr.on("data", (b) => (out += b));
  const [code] = await once(p, "exit");
  if (code !== 0) throw Error(`${cmd} failed (${code}): ${out}`);
  return out.trim();
}
let pool;
try {
  const password = randomBytes(24).toString("hex");
  const envPath = join(dir, "postgres.env");
  await writeFile(
    envPath,
    `POSTGRES_PASSWORD=${password}\nPOSTGRES_USER=test\nPOSTGRES_DB=gopermis_test\n`,
    { mode: 0o600 },
  );
  await run("docker", [
    "run",
    "-d",
    "--name",
    name,
    "--env-file",
    envPath,
    "-p",
    "127.0.0.1::5432",
    "postgres:17",
  ]);
  const port = await run("docker", [
    "inspect",
    "--format",
    '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
    name,
  ]);
  const url = `postgres://test:${password}@127.0.0.1:${port}/gopermis_test`;
  pool = new pg.Pool({ connectionString: url });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      await pool.query("SELECT 1");
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  assert.ok(ready, "PostgreSQL did not start");
  console.log(
    "PostgreSQL native:",
    (await pool.query("SHOW server_version")).rows[0].server_version,
  );
  console.log(
    await run(
      "node",
      process.argv.includes("--browser")
        ? ["tests/browser.current.mjs"]
        : ["--import", "tsx", "--test", "tests/crm.integration.mjs"],
      { NATIVE_TEST_DATABASE_URL: url },
    ),
  );
  // Exercise real pg_dump / pg_restore on a separate database, never a production DB.
  await run("docker", [
    "exec",
    name,
    "pg_dump",
    "-U",
    "test",
    "-d",
    "gopermis_test",
    "-Fc",
    "-f",
    "/tmp/backup.dump",
  ]);
  await run("docker", [
    "exec",
    name,
    "createdb",
    "-U",
    "test",
    "restore_check",
  ]);
  await run("docker", [
    "exec",
    name,
    "pg_restore",
    "-U",
    "test",
    "-d",
    "restore_check",
    "--exit-on-error",
    "/tmp/backup.dump",
  ]);
  const restored = new pg.Pool({
    connectionString: url.replace("/gopermis_test", "/restore_check"),
  });
  try {
    for (const table of [
      "schema_migration",
      "booking",
      "hour_ledger",
      "payment",
      "audit_event",
      "calendar_occupancy",
    ]) {
      const original = await pool.query(
        `SELECT count(*)::integer AS n FROM ${table}`,
      );
      const copy = await restored.query(
        `SELECT count(*)::integer AS n FROM ${table}`,
      );
      assert.equal(copy.rows[0].n, original.rows[0].n, table);
    }
    if (Number((await restored.query("SELECT count(*) AS n FROM hour_ledger")).rows[0].n))
      await assert.rejects(restored.query("DELETE FROM hour_ledger"));
    if (Number((await restored.query("SELECT count(*) AS n FROM booking")).rows[0].n))
      await assert.rejects(restored.query("UPDATE booking SET starts_at=starts_at+interval '1 day'"));
    console.log(
      "pg_dump / pg_restore: counts and applicable history guards verified on restored test database.",
    );
  } finally {
    await restored.end();
  }
} finally {
  await pool?.end();
  await run("docker", ["rm", "-f", "-v", name]).catch(() => {});
  await rm(dir, { recursive: true, force: true });
}
