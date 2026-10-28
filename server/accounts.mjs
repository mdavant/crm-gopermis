import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
export function accountInput() {
  const identifier = (
    process.env.BOOTSTRAP_IDENTIFIER ??
    process.env.BOOTSTRAP_EMAIL ??
    ""
  )
    .trim()
    .toLowerCase();
  const password = process.env.BOOTSTRAP_PASSWORD;
  const name = (process.env.BOOTSTRAP_NAME ?? "").trim();
  if (
    !identifier ||
    identifier.length > 254 ||
    !name ||
    name.length > 150 ||
    !password ||
    password.length < 14 ||
    password.length > 256
  )
    throw Error(
      "Définir BOOTSTRAP_IDENTIFIER, BOOTSTRAP_NAME et BOOTSTRAP_PASSWORD (14 à 256 caractères) dans la configuration privée.",
    );
  return { identifier, password, name };
}
export async function createAccount(
  client,
  { identifier, password, name },
  { initialOnly = false } = {},
) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(781235)");
    if (
      initialOnly &&
      (await client.query("SELECT 1 FROM app_user LIMIT 1")).rowCount
    ) {
      await client.query("COMMIT");
      return false;
    }
    if (
      (
        await client.query("SELECT 1 FROM app_user WHERE lower(email)=$1", [
          identifier,
        ])
      ).rowCount
    )
      throw Error(
        "Cet identifiant existe déjà. Le compte et son mot de passe sont conservés.",
      );
    const salt = randomBytes(16).toString("hex");
    const hash = salt + ":" + scryptSync(password, salt, 64).toString("hex");
    const u = await client.query(
      "INSERT INTO app_user(email,name,password_hash) VALUES($1,$2,$3) RETURNING id",
      [identifier, name, hash],
    );
    await client.query(
      "INSERT INTO user_role(user_id,role_id) VALUES($1,'technical_admin')",
      [u.rows[0].id],
    );
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
}

export function verifyPassword(password, encoded) {
  const valid =
    typeof encoded === "string" &&
    /^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(encoded);
  const [salt, hash] = (
    valid ? encoded : "0".repeat(32) + ":" + "0".repeat(128)
  ).split(":");
  const computed = scryptSync(password, salt, 64);
  return timingSafeEqual(computed, Buffer.from(hash, "hex")) && valid;
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
