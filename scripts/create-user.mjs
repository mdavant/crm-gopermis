import { database, closeDatabase } from "../server/database.mjs";
import { accountInput, createAccount } from "../server/accounts.mjs";
const input = accountInput();
try {
  const pool = await database({ bootstrap: false });
  const client = await pool.connect();
  try {
    await createAccount(client, input);
    console.log("Compte créé");
  } finally {
    client.release();
  }
} finally {
  await closeDatabase();
}
