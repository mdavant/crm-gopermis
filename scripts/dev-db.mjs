// Local development only. Does not overwrite configuration or create accounts.
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { parseEnv } from "node:util";
const name = "gopermis-pg-dev",
  port = 55433;
async function run(args, allowFailure = false) {
  const p = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  p.stdout.on("data", (b) => (out += b));
  p.stderr.on("data", (b) => (out += b));
  const [code] = await once(p, "exit");
  if (code !== 0 && !allowFailure)
    throw Error(`Docker failed (${code}): ${out}`);
  return { code, out: out.trim() };
}
let content;
try {
  content = await readFile(".env.local", "utf8");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
if (!content && !process.env.DATABASE_URL) {
  const password = randomBytes(24).toString("hex");
  content = `DATABASE_URL=postgres://gopermis:${password}@127.0.0.1:${port}/gopermis\nAPP_ORIGIN=http://localhost:3000\n`;
  await writeFile(".env.local", content, { mode: 0o600, flag: "wx" });
}
const dbUrl = process.env.DATABASE_URL ?? parseEnv(content ?? "").DATABASE_URL;
if (!dbUrl)
  throw Error(
    "DATABASE_URL absent from .env.local; configure it without overwriting existing values.",
  );
let url;
try {
  url = new URL(dbUrl);
} catch {
  throw Error("DATABASE_URL invalide (valeur masquée).");
}
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  url.port !== String(port) ||
  url.pathname !== "/gopermis" ||
  url.username !== "gopermis"
)
  throw Error(
    "Existing DATABASE_URL is custom. Start its database yourself; dev:db never changes it.",
  );
const existing = await run(
  [
    "inspect",
    "--format",
    '{{index .Config.Labels "dev.gopermis.local"}}',
    name,
  ],
  true,
);
if (existing.code === 0) {
  if (existing.out !== "true")
    throw Error(
      "Container name already exists without the local development label. No changes made.",
    );
  await run(["start", name]);
} else {
  const dir = await mkdtemp(join(tmpdir(), "gopermis-dev-"));
  try {
    const path = join(dir, "postgres.env");
    await writeFile(
      path,
      `POSTGRES_PASSWORD=${decodeURIComponent(url.password)}\nPOSTGRES_USER=gopermis\nPOSTGRES_DB=gopermis\n`,
      { mode: 0o600 },
    );
    await run([
      "run",
      "-d",
      "--name",
      name,
      "--label",
      "dev.gopermis.local=true",
      "--env-file",
      path,
      "-p",
      `127.0.0.1:${port}:5432`,
      "-v",
      "gopermis_dev_data:/var/lib/postgresql/data",
      "postgres:17",
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const pool = new pg.Pool({ connectionString: dbUrl });
try {
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
  if (!ready)
    throw Error(
      "Local PostgreSQL is not ready; check Docker and the local credentials.",
    );
  console.log(
    "Local development PostgreSQL ready (loopback only). Apply migrations next.",
  );
} finally {
  await pool.end();
}
