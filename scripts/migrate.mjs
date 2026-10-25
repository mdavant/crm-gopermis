import pg from "pg";
import { migrate } from "./migrations.mjs";
if (!process.env.DATABASE_URL)
  throw Error(
    "DATABASE_URL requise ; le mode PGlite de prévisualisation applique ses migrations au démarrage.",
  );
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await migrate(client);
  console.log("Migrations à jour");
} finally {
  await client.end();
}
