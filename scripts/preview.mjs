// Explicit private preview: never connects to a configured team/production database.
import { spawn } from "node:child_process";
import { once } from "node:events";
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "0.0.0.0",
    "--port",
    process.env.PORT || "3000",
  ],
  {
    env: {
      ...process.env,
      APP_ENV: "preview",
      DATABASE_MODE: "pglite",
      DATABASE_URL: "",
      APP_ORIGIN: "",
      ALLOW_PREVIEW_SETUP: "1",
      BOOTSTRAP_PASSWORD: "",
      BOOTSTRAP_IDENTIFIER: "",
      BOOTSTRAP_EMAIL: "",
    },
    stdio: "inherit",
  },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
const [code] = await once(child, "exit");
process.exitCode = code ?? 0;
