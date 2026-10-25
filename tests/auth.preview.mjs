import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
test(
  "connexion identifiant en aperçu PGlite : initialisation, session, redémarrage et conservation du compte",
  { timeout: 120000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "gopermis-auth-"));
    const origin = "http://127.0.0.1:3102";
    const password = randomBytes(24).toString("hex");
    const changedPassword = randomBytes(24).toString("hex");
    const env = {
      ...process.env,
      DATABASE_MODE: "pglite",
      DATABASE_URL: "",
      PGLITE_DATA_DIR: dir,
      APP_ORIGIN: origin,
      BOOTSTRAP_IDENTIFIER: "",
      BOOTSTRAP_EMAIL: "",
      BOOTSTRAP_NAME: "",
      BOOTSTRAP_PASSWORD: "",
      ALLOW_PREVIEW_SETUP: "1",
      NEXT_TELEMETRY_DISABLED: "1",
    };
    let app,
      cookie = "",
      logs = "";
    async function stop() {
      if (app && app.exitCode === null && app.signalCode === null) {
        const exit = once(app, "exit");
        app.kill("SIGTERM");
        await exit;
      }
    }
    async function start(overrides = {}) {
      logs = "";
      app = spawn(
        "node",
        [
          "node_modules/next/dist/bin/next",
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          "3102",
        ],
        { env: { ...env, ...overrides }, stdio: ["ignore", "pipe", "pipe"] },
      );
      app.stdout.on("data", (b) => (logs += b));
      app.stderr.on("data", (b) => (logs += b));
      let ready = false;
      for (let i = 0; i < 150; i++) {
        try {
          if ((await fetch(origin)).ok) {
            ready = true;
            break;
          }
        } catch {}
        if (app.exitCode !== null) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.ok(ready, logs);
    }
    async function request(path, body, status = 200, requestOrigin = origin) {
      const r = await fetch(origin + "/api/" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          ...(requestOrigin ? { origin: requestOrigin } : {}),
          cookie,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      assert.ok(
        r.headers.get("content-type")?.includes("application/json"),
        `Expected JSON, got HTTP ${r.status}`,
      );
      const data = await r.json();
      assert.equal(r.status, status, JSON.stringify(data));
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      return data;
    }
    try {
      await start();
      await request("me", undefined, 401);
      await request("login", { identifiant: "admin", password }, 403, null);
      await request(
        "login",
        { identifiant: "admin", password },
        403,
        "http://localhost:9999",
      );
      assert.equal((await request("setup")).required, true);
      if (process.env.PREVIEW_BROWSER === "1") {
        const { chromium } = await import("playwright");
        const browser = await chromium.launch({
          headless: true,
          ...(process.env.CHROMIUM_EXECUTABLE_PATH
            ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
            : {}),
          args: ["--no-sandbox"],
        });
        try {
          const page = await browser.newPage();
          const errors = [];
          page.on("pageerror", (e) => errors.push(e.message));
          await page.goto(origin);
          await page
            .getByRole("heading", { name: "Créer votre accès." })
            .waitFor();
          await page.getByLabel("Nom affiché").fill("TEST Admin aperçu");
          await page.getByLabel("Identifiant", { exact: true }).fill("admin");
          assert.equal(await page.getByLabel("Mot de passe").inputValue(), "");
          await page.getByLabel("Mot de passe").fill(password);
          await page
            .getByRole("button", {
              name: "Créer mon compte et me connecter",
              exact: true,
            })
            .click();
          await page
            .getByRole("heading", { name: "Clients", exact: true })
            .waitFor();
          await page
            .getByRole("button", { name: "Se déconnecter", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Se connecter", exact: true })
            .waitFor();
          await page.route("**/api/login", (r) =>
            r.fulfill({
              status: 502,
              contentType: "text/html",
              body: "<html><head>upstream failure</head></html>",
            }),
          );
          await page.getByLabel("Identifiant", { exact: true }).fill("admin");
          await page.getByLabel("Mot de passe").fill(password);
          await page
            .getByRole("button", { name: "Se connecter", exact: true })
            .click();
          await page
            .getByRole("alert")
            .filter({ hasText: "ne répond pas en JSON (HTTP 502)" })
            .waitFor();
          assert.ok(
            !(await page.locator("body").innerText()).includes(
              "Unexpected token",
            ),
          );
          await page.unroute("**/api/login");
          await page
            .getByRole("button", { name: "Se connecter", exact: true })
            .click();
          await page
            .getByRole("heading", { name: "Clients", exact: true })
            .waitFor();
          const cookies = await page.context().cookies();
          cookie =
            "gopermis_session=" +
            cookies.find((c) => c.name === "gopermis_session").value;
          assert.deepEqual(errors, []);
          console.log(
            "Preview browser: first admin creation, login, HTML 502 error handling and subsequent real login verified.",
          );
        } finally {
          await browser.close();
        }
      } else {
        await request(
          "setup",
          { identifiant: "admin", name: "TEST Admin aperçu", password },
          201,
        );
      }
      assert.equal((await request("setup")).required, false);
      await request(
        "setup",
        { identifiant: "admin", name: "Different", password: changedPassword },
        409,
      );
      await request("login", null, 422);
      await request("login", { identifiant: "   ", password }, 422);
      await request(
        "login",
        { identifiant: "admin", password: changedPassword },
        401,
      );
      await request("login", { identifiant: " ADMIN ", password });
      assert.equal((await request("me")).name, "TEST Admin aperçu");
      assert.equal((await request("clients")).length, 0);
      assert.equal((await request("resources")).vehicles.length, 0);
      // Restart using a different bootstrap value: existing account/session must survive.
      await stop();
      await start({
        BOOTSTRAP_IDENTIFIER: "",
        BOOTSTRAP_NAME: "",
        BOOTSTRAP_PASSWORD: changedPassword,
      });
      assert.equal((await request("me")).name, "TEST Admin aperçu");
      await request(
        "login",
        { username: "admin", password: changedPassword },
        401,
      );
      await request("login", { username: "admin", password });
      await request("logout", {});
      await request("me", undefined, 401);
      // An unreachable configured PostgreSQL must return JSON failure, never create a new preview DB.
      await stop();
      await start({
        DATABASE_MODE: "postgres",
        DATABASE_URL: "postgres://test:test@127.0.0.1:1/missing",
      });
      await request("login", { identifiant: "admin", password }, 503);
      console.log(
        "Preview auth: identifier, cold database, no sample data, strict Origin, persisted session/account and unavailable PostgreSQL verified.",
      );
    } catch (e) {
      console.error(logs);
      throw e;
    } finally {
      await stop();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
