import { migrateMysql } from "./migrations-mysql.mjs";
import { testMysqlConnection, closeMysqlPool } from "../server/mysql.mjs";

try {
  const health = await testMysqlConnection();
  if (!health.ok) {
    console.error("Échec connexion MySQL:", health.error);
    process.exitCode = 1;
  } else {
    const result = await migrateMysql();
    if (result.applied.length === 0) {
      console.log(`MySQL (${health.database}) : toutes les migrations sont déjà à jour.`);
    } else {
      console.log(
        `MySQL (${health.database}) : migrations appliquées -> ${result.applied.join(", ")}`,
      );
    }
  }
} finally {
  await closeMysqlPool();
}
