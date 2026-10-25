import pg from "pg";
import { scryptSync, randomBytes } from "node:crypto";
const { DATABASE_URL, BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD, BOOTSTRAP_NAME } =
  process.env;
if (
  !DATABASE_URL ||
  !BOOTSTRAP_EMAIL ||
  !BOOTSTRAP_NAME ||
  !BOOTSTRAP_PASSWORD ||
  BOOTSTRAP_PASSWORD.length < 14
)
  throw Error(
    "Définir DATABASE_URL, BOOTSTRAP_EMAIL, BOOTSTRAP_NAME et BOOTSTRAP_PASSWORD (14 caractères minimum)",
  );
const salt = randomBytes(16).toString("hex");
const hash =
  salt + ":" + scryptSync(BOOTSTRAP_PASSWORD, salt, 64).toString("hex");
const c = new pg.Client({ connectionString: DATABASE_URL });
await c.connect();
try {
  await c.query("BEGIN");
  const u = await c.query(
    "INSERT INTO app_user(email,name,password_hash) VALUES($1,$2,$3) RETURNING id",
    [BOOTSTRAP_EMAIL.toLowerCase(), BOOTSTRAP_NAME, hash],
  );
  await c.query("INSERT INTO user_role VALUES($1,'technical_admin')", [
    u.rows[0].id,
  ]);
  await c.query("COMMIT");
  console.log("Compte créé");
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  await c.end();
}
