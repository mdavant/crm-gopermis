import { spawn } from "node:child_process";
import { cp, mkdir, stat } from "node:fs/promises";
import { once } from "node:events";
import { resolve } from "node:path";

const port = process.env.PORT || "3000";
const hostname = process.env.HOSTNAME || "0.0.0.0";

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const standaloneServer = resolve(process.cwd(), ".next/standalone/server.js");
let args;

if (await exists(standaloneServer)) {
  const staticSrc = resolve(process.cwd(), ".next/static");
  const staticDest = resolve(process.cwd(), ".next/standalone/.next/static");
  if (await exists(staticSrc)) {
    await mkdir(resolve(process.cwd(), ".next/standalone/.next"), { recursive: true });
    await cp(staticSrc, staticDest, { recursive: true, force: true });
  }
  const publicSrc = resolve(process.cwd(), "public");
  const publicDest = resolve(process.cwd(), ".next/standalone/public");
  if (await exists(publicSrc)) {
    await cp(publicSrc, publicDest, { recursive: true, force: true });
  }
  // Les migrations SQL sont lues au démarrage (création automatique des tables).
  const dbSrc = resolve(process.cwd(), "db");
  if (await exists(dbSrc)) {
    await cp(dbSrc, resolve(process.cwd(), ".next/standalone/db"), {
      recursive: true,
      force: true,
    });
  }
  args = [standaloneServer];
} else {
  args = ["node_modules/next/dist/bin/next", "start", "--hostname", hostname, "--port", port];
}

const child = spawn(process.execPath, args, {
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: hostname,
  },
  stdio: "inherit",
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => child.kill(signal));
}

const [code] = await once(child, "exit");
process.exitCode = code ?? 0;
