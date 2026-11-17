import { getMysqlMigrationStatus } from "./migrations-mysql.mjs";
import { testMysqlConnection, closeMysqlPool } from "../server/mysql.mjs";

try {
  const health = await testMysqlConnection();
  if (!health.ok) {
    console.error("Connexion MySQL impossible:", health.error);
    process.exitCode = 1;
  } else {
    console.log(`Connexion MySQL OK — base: ${health.database} (version ${health.version})`);
    const list = await getMysqlMigrationStatus();
    for (const item of list) {
      console.log(
        `  ${item.applied ? "[APPLIQUÉE]" : "[EN ATTENTE]"} ${item.name}${item.appliedAt ? ` (${new Date(item.appliedAt).toISOString()})` : ""}`,
      );
    }
    if (list.some((x) => !x.applied)) {
      process.exitCode = 2;
    }
  }
} finally {
  await closeMysqlPool();
}
