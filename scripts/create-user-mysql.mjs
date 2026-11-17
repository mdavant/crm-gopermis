import { randomUUID } from "node:crypto";
import { getMysqlPool, closeMysqlPool } from "../server/mysql.mjs";
import { hashPassword, isValidEmail, normalizeEmail, splitFullName } from "../server/accounts.mjs";

const email = normalizeEmail(process.env.BOOTSTRAP_EMAIL ?? process.env.BOOTSTRAP_IDENTIFIER ?? "");
const name = (process.env.BOOTSTRAP_NAME ?? "Administrateur GoPermis").trim();
const password = process.env.BOOTSTRAP_PASSWORD ?? "";
const role = ["admin", "manager", "instructor", "staff"].includes(process.env.BOOTSTRAP_ROLE ?? "")
  ? process.env.BOOTSTRAP_ROLE
  : "admin";

if (!isValidEmail(email)) {
  console.error("BOOTSTRAP_EMAIL doit être une adresse e-mail valide.");
  process.exit(1);
}
if (!password || password.length < 14 || password.length > 256) {
  console.error("BOOTSTRAP_PASSWORD doit contenir entre 14 et 256 caractères.");
  process.exit(1);
}

try {
  const pool = await getMysqlPool();
  const [existing] = await pool.execute(
    "SELECT id FROM users WHERE LOWER(email) = ?",
    [email],
  );
  if (Array.isArray(existing) && existing.length > 0) {
    console.log("Un utilisateur avec cet e-mail existe déjà ; compte conservé sans modification.");
  } else {
    const id = randomUUID();
    const { firstName, lastName } = splitFullName(name);
    const hash = hashPassword(password);
    await pool.execute(
      `INSERT INTO users (id, first_name, last_name, name, email, password_hash, role, role_preset, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, firstName, lastName, name, email, hash, role, role === "admin" ? "admin" : role],
    );
    if (role === "admin") {
      await pool.execute(
        "INSERT IGNORE INTO user_permissions (id, user_id, permission_name) VALUES (?, ?, 'admin.full')",
        [randomUUID(), id],
      );
    }
    console.log(`Utilisateur ${role} créé avec succès (id=${id}).`);
  }
} finally {
  await closeMysqlPool();
}
