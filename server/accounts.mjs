import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  return trimmed.length >= 3 && trimmed.length <= 254 && EMAIL_REGEX.test(trimmed);
}

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function splitFullName(name) {
  const clean = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return { firstName: "Utilisateur", lastName: "" };
  const parts = clean.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function redactSensitive(input) {
  let out = String(input ?? "");
  const secrets = [
    process.env.DB_PASSWORD,
    process.env.BOOTSTRAP_PASSWORD,
    process.env.RESET_PASSWORD,
    process.env.POSTGRES_PASSWORD,
  ].filter((v) => typeof v === "string" && v.length >= 3);
  for (const s of secrets) {
    out = out.split(s).join("[REDACTED]");
  }
  out = out.replace(/(password|password_hash|token|secret)\s*[:=]\s*["']?[^"'\s,;]+/gi, "$1=[REDACTED]");
  return out;
}

export function hashPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Mot de passe requis pour le hachage.");
  }
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password, encoded) {
  if (typeof password !== "string" || typeof encoded !== "string" || !encoded) {
    return false;
  }
  if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(encoded)) {
    return bcrypt.compareSync(password, encoded);
  }
  const valid = /^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(encoded);
  const [salt, hash] = (
    valid ? encoded : "0".repeat(32) + ":" + "0".repeat(128)
  ).split(":");
  const computed = scryptSync(password, salt, 64);
  return timingSafeEqual(computed, Buffer.from(hash, "hex")) && valid;
}

export function accountInput(env = process.env) {
  const identifier = (env.BOOTSTRAP_IDENTIFIER ?? env.BOOTSTRAP_EMAIL ?? "")
    .trim()
    .toLowerCase();
  const password = env.BOOTSTRAP_PASSWORD;
  const name = (env.BOOTSTRAP_NAME ?? "").trim();
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
    const hash = hashPassword(password);
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

export function generateTokenHex(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}
