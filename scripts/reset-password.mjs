// Server-operator recovery only. Never expose this command as a public endpoint.
import { database, closeDatabase } from "../server/database.mjs";
import { hashPassword } from "../server/accounts.mjs";
import { createHash } from "node:crypto";
const identifier = process.env.RESET_IDENTIFIER?.trim().toLowerCase();
const password = process.env.RESET_PASSWORD;
if (!identifier || !password || password.length < 14 || password.length > 256)
  throw Error(
    "Fournir RESET_IDENTIFIER et RESET_PASSWORD (14 à 256 caractères) par la configuration privée.",
  );
try {
  const client = await (await database({ bootstrap: false })).connect();
  try {
    await client.query("BEGIN");
    const rows = (
      await client.query(
        "SELECT id FROM app_user WHERE lower(email)=$1 FOR UPDATE",
        [identifier],
      )
    ).rows;
    if (rows.length !== 1)
      throw Error(
        "Identifiant absent ou ambigu. Aucun compte créé ou modifié.",
      );
    const id = rows[0].id;
    await client.query("UPDATE app_user SET password_hash=$2 WHERE id=$1", [
      id,
      hashPassword(password),
    ]);
    await client.query("DELETE FROM auth_session WHERE user_id=$1", [id]);
    await client.query("DELETE FROM login_attempt WHERE key=$1", [
      createHash("sha256").update(identifier).digest("hex"),
    ]);
    await client.query(
      "INSERT INTO audit_event(actor_id,action,resource_id,details) VALUES($1,'account.password_recovered',$1,$2)",
      [
        id,
        JSON.stringify({
          initiator: "local-server-operator",
          sessionsRevoked: true,
        }),
      ],
    );
    await client.query("COMMIT");
    console.log(
      "Mot de passe rétabli ; toutes les sessions ont été révoquées. Aucun droit ou état de compte modifié.",
    );
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
} finally {
  await closeDatabase();
}
