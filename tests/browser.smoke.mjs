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
  await page.getByLabel("Identifiant", { exact: true }).fill("browser-admin");
  assert.equal(await page.getByLabel("Mot de passe").inputValue(), "");
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.getByRole("heading", { name: "Clients", exact: true }).waitFor();
  await page.getByRole("button", { name: "Ressources", exact: true }).click();
  await page.getByLabel("Identifiant du véhicule").fill("TEST VISUEL Clio");
  await page.getByLabel("Modèle").selectOption("clio-manual");
  await page
    .getByRole("button", { name: "Ajouter le véhicule", exact: true })
    .click();
  await page.getByText("TEST VISUEL Clio", { exact: true }).first().waitFor();
  await page.getByLabel("Nom du moniteur").fill("TEST VISUEL Moniteur");
  await page
    .getByRole("button", { name: "Ajouter le moniteur", exact: true })
    .click();
  await page
    .getByText("TEST VISUEL Moniteur", { exact: true })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: "Nouveau client", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Prénom", { exact: true }).fill("TEST");
  await dialog.getByLabel("Nom", { exact: true }).fill("Navigateur");
  await dialog.getByLabel("Téléphone").fill("0600000088");
  await dialog.getByRole("button", { name: "Créer la fiche" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Modifier les coordonnées", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Téléphone").fill("0600000089");
  await dialog
    .getByRole("button", { name: "Enregistrer les coordonnées", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  await page
    .getByRole("status")
    .filter({ hasText: "Coordonnées mises à jour." })
    .waitFor();
  await page
    .getByRole("button", { name: "Nouvelle prestation", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Forfait").selectOption("");
  await dialog.getByLabel("Heures payantes").fill("1");
  await dialog.getByRole("button", { name: "Créer la prestation" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: /Réserver ·/ }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Véhicule physique")
    .selectOption({ label: "TEST VISUEL Clio · Clio manuelle" });
  await dialog
    .getByLabel(/^Moniteur/)
    .selectOption({ label: "TEST VISUEL Moniteur" });
  await dialog.getByLabel("Début", { exact: true }).fill("2026-01-12T10:00");
  await dialog.getByLabel("Fin", { exact: true }).fill("2026-01-12T11:00");
  // Keyboard stays inside the modal; Escape closes it without creating anything.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    assert.ok(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    );
  }
  await page.keyboard.press("Shift+Tab");
  assert.ok(await dialog.evaluate((el) => el.contains(document.activeElement)));
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: /Réserver ·/ }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Véhicule physique")
    .selectOption({ label: "TEST VISUEL Clio · Clio manuelle" });
  await dialog
    .getByLabel(/^Moniteur/)
    .selectOption({ label: "TEST VISUEL Moniteur" });
  await dialog.getByLabel("Début", { exact: true }).fill("2026-01-12T10:00");
  await dialog.getByLabel("Fin", { exact: true }).fill("2026-01-12T11:00");
  await dialog.getByRole("button", { name: "Vérifier et confirmer" }).click();
  await dialog.waitFor({ state: "hidden" });
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Marquer réalisée/ }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Crédit insuffisant" })
    .waitFor();
  await page
    .getByRole("button", { name: "Enregistrer un paiement", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Montant reçu (€)").fill("35");
  await dialog
    .getByRole("button", { name: "Confirmer le paiement reçu" })
    .click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: /Marquer réalisée/ }).click();
  await page
    .locator(".sessionRow")
    .getByText("Réalisée", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: /Marquer réalisée/ }).count(),
    0,
  );
  await mkdir("artifacts/browser", { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/browser/desktop-client.png",
    fullPage: true,
    animations: "disabled",
  });
  async function noOverflow() {
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "Horizontal viewport overflow",
    );
  }
  await noOverflow();
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/browser/mobile-client.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page.getByRole("button", { name: "Ressources", exact: true }).click();
  await noOverflow();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/browser/mobile-resources.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Clients", exact: true })
    .click();
  await page.getByRole("button", { name: /TEST Navigateur/ }).click();
  await page.getByRole("button", { name: /Réserver ·/ }).click();
  dialog = page.getByRole("dialog");
  await noOverflow();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/browser/mobile-booking.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Ouvrir le menu", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Clients", exact: true })
    .click();
  await page.getByLabel("Rechercher un client").fill("TEST Pagination");
  await page.getByRole("status").filter({ hasText: "Page 1 sur 2" }).waitFor();
  assert.equal(await page.locator(".clientRow").count(), 25);
  await page
    .getByRole("button", { name: "Page suivante", exact: true })
    .click();
  await page.getByRole("status").filter({ hasText: "Page 2 sur 2" }).waitFor();
  assert.equal(await page.locator(".clientRow").count(), 1);
  await page
    .getByRole("button", { name: "Page précédente", exact: true })
    .click();
  await page.getByRole("status").filter({ hasText: "Page 1 sur 2" }).waitFor();
  await noOverflow();
  await page
    .getByRole("button", { name: "Ouvrir le menu", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Planning", exact: true })
    .click();
  await page.getByLabel("Journée du planning").fill("2026-01-12");
  await page.locator(".sessionRow").waitFor();
  assert.equal(await page.locator(".sessionRow").count(), 1);
  await noOverflow();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/browser/mobile-planning.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.deepEqual(errors, [], "Browser JS errors");
  console.log(
    "Browser: desktop/mobile, resources, client, service, booking, insufficient credit, payment, completion, keyboard, overflow checks passed.",
  );
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
