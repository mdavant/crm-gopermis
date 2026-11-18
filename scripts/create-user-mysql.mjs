import { randomUUID } from "node:crypto";
import { mysqlTransaction, closeMysqlPool } from "../server/mysql.mjs";
import {
  accountInput,
  hashPassword,
  splitFullName,
} from "../server/accounts.mjs";

// Login already accepts a username or email stored in the historical email column.
const { identifier, name, password } = accountInput({
  ...process.env,
  BOOTSTRAP_NAME: process.env.BOOTSTRAP_NAME ?? "Administrateur GoPermis",
});
const role = ["admin", "manager", "instructor", "staff"].includes(
  process.env.BOOTSTRAP_ROLE ?? "",
)
  ? process.env.BOOTSTRAP_ROLE
  : "admin";

try {
  const createdId = await mysqlTransaction(async (conn) => {
    const [existing] = await conn.execute(
      "SELECT id FROM users WHERE LOWER(email) = ?",
      [identifier],
    );
    if (Array.isArray(existing) && existing.length > 0) {
      return null;
    } else {
      const id = randomUUID();
      const { firstName, lastName } = splitFullName(name);
      const hash = hashPassword(password);
      await conn.execute(
        `INSERT INTO users (id, first_name, last_name, name, email, password_hash, role, role_preset, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          firstName,
          lastName,
          name,
          identifier,
          hash,
          role,
          role === "admin" ? "admin" : role,
        ],
      );
      if (role === "admin") {
        await conn.execute(
          "INSERT IGNORE INTO user_permissions (id, user_id, permission_name) VALUES (?, ?, 'admin.full')",
          [randomUUID(), id],
        );
      }
      return id;
    }
  });
  console.log(
    createdId
      ? `Utilisateur ${role} créé avec succès (id=${createdId}).`
      : "Un utilisateur avec cet identifiant existe déjà ; compte conservé sans modification.",
  );
} finally {
  await closeMysqlPool();
}
