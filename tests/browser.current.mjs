import pg from "pg";
// Called only by test-native.mjs --browser with a fresh, disposable DB.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const url = process.env.NATIVE_TEST_DATABASE_URL;
assert.ok(url, "Run npm run test:browser (isolated test database required)");
const origin = "http://localhost:3101";
const password = randomBytes(24).toString("hex");
const env = {
  ...process.env,
  DATABASE_URL: url,
  APP_ORIGIN: origin,
  NEXT_TELEMETRY_DISABLED: "1",
};
async function run(args, extra = {}) {
  const p = spawn("node", args, {
    env: { ...env, ...extra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  p.stdout.on("data", (b) => (out += b));
  p.stderr.on("data", (b) => (out += b));
  const [code] = await once(p, "exit");
  assert.equal(code, 0, out);
}
await run(["scripts/migrate.mjs"]);
await run(["scripts/create-user.mjs"], {
  BOOTSTRAP_IDENTIFIER: "browser-admin",
  BOOTSTRAP_NAME: "TEST Navigateur",
  BOOTSTRAP_PASSWORD: password,
});
const fixtures = new pg.Pool({ connectionString: url });
try {
  await fixtures.query(
    "INSERT INTO client(first_name,last_name,phone,source) SELECT 'TEST Pagination','N° '||n,'078'||lpad(n::text,7,'0'),'TEST navigateur' FROM generate_series(1,26) n",
  );
} finally {
  await fixtures.end();
}
const app = spawn(
  "node",
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3101",
  ],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
app.stdout.on("data", (b) => (logs += b));
app.stderr.on("data", (b) => (logs += b));
let browser;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, logs);
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Europe/Paris",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page.getByLabel("Identifiant",{exact:true}).fill("browser-admin");
  assert.equal(await page.getByLabel("Mot de passe",{exact:true}).inputValue(),"");
  await page.getByLabel("Mot de passe",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Se connecter",exact:true}).click();
  await page.getByRole("heading",{name:"Tableau de bord",exact:true}).waitFor();
  assert.equal(await page.locator(".dockRail").count(),1);
  assert.equal(await page.locator(".sidebar").count(),0);
  await page.getByRole("button",{name:"Nouveau client",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Prénom",{exact:true}).fill("TEST");
  await dialog.getByLabel("Nom",{exact:true}).fill("Compatibilité");
  await dialog.getByLabel("Téléphone",{exact:true}).fill("0600000088");
  await dialog.getByRole("button",{name:"Créer la fiche",exact:true}).click();
  await dialog.waitFor({state:"hidden"});
  await page.getByRole("heading",{name:"TEST Compatibilité",exact:true}).waitFor();
  await page.getByRole("button",{name:"Modifier les coordonnées",exact:true}).click();
  await page.getByRole("dialog").getByLabel("Téléphone").fill("0600000089");
  await page.getByRole("dialog").getByRole("button",{name:"Enregistrer les coordonnées"}).click();
  await page.getByRole("dialog").waitFor({state:"hidden"});
  await mkdir("artifacts/browser",{recursive:true});
  for(const [title,file] of [["Accueil & Tableau de bord","home"],["Planning & Calendrier","planning"],["Clients & Dossiers","clients"],["Tarifs & Offres","pricing"],["Véhicules & Moniteurs","resources"],["Notifications","notifications"]]) {
    await page.getByRole("button",{name:title,exact:true}).click();
    await page.screenshot({path:`artifacts/browser/current-${file}.png`,fullPage:true});
    if(file==="notifications") { assert.equal(await page.locator(".notifCard").count(),0); }
  }
  await page.locator(".dockUserAvatar").click();
  await page.getByLabel("Nom complet affiché").fill("Michel TEST");
  await page.getByRole("button",{name:"Enregistrer les modifications"}).click();
  await page.getByText("Votre profil a été mis à jour avec succès.").waitFor();
  await page.getByRole("button",{name:"Accueil & Tableau de bord",exact:true}).click();
  await page.getByText("Bonjour, Michel TEST",{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:"artifacts/browser/current-mobile.png",fullPage:true});
  assert.deepEqual(errors,[],"Browser JS errors");
  console.log("Browser: original design, single navigation, login, client creation/editing, all views, fictitious notifications removed, profile rename and mobile rendering verified.");
} catch (e) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) {
    await mkdir("artifacts/browser", { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "artifacts/browser/failure.png",
      fullPage: true,
    });
    console.error((await page.locator("body").innerText()).slice(0, 6000));
  }
  throw e;
} finally {
  await browser?.close();
  app.kill("SIGTERM");
  if (app.exitCode === null) await once(app, "exit");
}
