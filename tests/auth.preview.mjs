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
        process.env.PREVIEW_DEV === "1"
          ? ["scripts/preview.mjs"]
          : [
              "node_modules/next/dist/bin/next",
              "start",
              "--hostname",
              "127.0.0.1",
              "--port",
              "3102",
            ],
        {
          env: { ...env, PORT: "3102", ...overrides },
          stdio: ["ignore", "pipe", "pipe"],
        },
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
        let page;
        try {
          page = await browser.newPage();
          const errors = [];
          page.on("pageerror", (e) => errors.push(e.message));
          let bearerRequests = 0;
          await page.route("**/api/**", async (route) => {
            const headers = { ...route.request().headers() };
            delete headers.cookie;
            if (headers.authorization) bearerRequests++;
            await route.continue({ headers });
          });
          await page.goto(origin);
          await page
            .getByRole("heading", { name: "Créer votre accès." })
            .waitFor();
          await page.getByLabel("Nom affiché").fill("TEST Admin aperçu");
          await page.getByLabel("Identifiant", { exact: true }).fill("admin");
          assert.equal(
            await page.getByLabel("Mot de passe", { exact: true }).inputValue(),
            "",
          );
          await page.getByLabel("Mot de passe", { exact: true }).fill(password);
          if (await page.getByLabel(/^Confirmer le mot de passe/).count())
            await page.getByLabel(/^Confirmer le mot de passe/).fill(password);
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
          await page.route("**/api/auth/login", (r) =>
            r.fulfill({
              status: 502,
              contentType: "text/html",
              body: "<html><head>upstream failure</head></html>",
            }),
          );
          await page.getByLabel("Identifiant", { exact: true }).fill("admin");
          await page.getByLabel("Mot de passe", { exact: true }).fill(password);
          if (await page.getByLabel(/^Confirmer le mot de passe/).count())
            await page.getByLabel(/^Confirmer le mot de passe/).fill(password);
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
          await page.unroute("**/api/auth/login");
          await page
            .getByRole("button", { name: "Se connecter", exact: true })
            .click();
          await page
            .getByRole("heading", { name: "Clients", exact: true })
            .waitFor();
          await page.reload();
          await page
            .getByRole("heading", { name: "Clients", exact: true })
            .waitFor();
          assert.ok(
            bearerRequests > 0,
            "Preview works without cookies using its scoped session token",
          );
          const cookies = await page.context().cookies();
          cookie =
            "gopermis_session=" +
            cookies.find((c) => c.name === "gopermis_session").value;
          assert.deepEqual(errors, []);
          console.log(
            "Preview browser: first admin creation, login, HTML 502 error handling and subsequent real login verified.",
          );
        } catch (e) {
          if (page)
            console.error(
              (await page.locator("body").innerText()).slice(0, 4000),
            );
          throw e;
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
      const client = await request(
        "clients",
        { firstName: "TEST", lastName: "Direct", phone: "0600000077" },
        201,
      );
      const service = await request(
        "clients/" + client.id + "/services",
        {
          typeId: "extra",
          model: "clio-manual",
          support: "GoPermis",
          minutes: 60,
        },
        201,
      );
      const vehicle = await request(
        "resources",
        {
          kind: "vehicle",
          label: "TEST direct preview",
          modelId: "clio-manual",
        },
        201,
      );
      const instructor = await request(
        "resources",
        { kind: "instructor", name: "TEST direct preview" },
        201,
      );
      const booking = await request(
        "services/" + service.id + "/bookings",
        {
          vehicleId: vehicle.id,
          instructorId: instructor.id,
          startsAt: "2026-01-01T10:00:00Z",
          endsAt: "2026-01-01T11:00:00Z",
          requestId: crypto.randomUUID(),
        },
        201,
      );
      await request("bookings/" + booking.id + "/complete", {}, 422);
      await request(
        "services/" + service.id + "/payments",
        { amountCents: 3500, method: "Carte", requestId: crypto.randomUUID() },
        201,
      );
      await Promise.all(
        [1, 2, 3].map(() =>
          request("bookings/" + booking.id + "/complete", {}),
        ),
      );
      const detail = await request("clients/" + client.id);
      assert.equal(detail.ledger.filter((l) => l.kind === "session").length, 1);
      assert.equal(
        detail.ledger.reduce((n, l) => n + l.minutes, 0),
        0,
      );
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
      await request("login", { identifiant: "admin", password });
      await request(
        "auth/password",
        {
          currentPassword: changedPassword + "wrong",
          newPassword: changedPassword,
        },
        401,
      );
      await request("auth/password", {
        currentPassword: password,
        newPassword: changedPassword,
      });
      await request("me", undefined, 401);
      await request("login", { identifiant: "admin", password }, 401);
      const logged = await request("auth/login", {
        identifiant: "admin",
        password: changedPassword,
      });
      assert.ok(
        logged.session?.token,
        "Preview exposes only its preview-scoped session",
      );
      const bearerCheck = await fetch(origin + "/api/me", {
        headers: { Authorization: "Bearer " + logged.session.token },
      });
      assert.equal(bearerCheck.status, 200);
      await request("logout", {});
      assert.equal(
        (
          await fetch(origin + "/api/me", {
            headers: { Authorization: "Bearer " + logged.session.token },
          })
        ).status,
        401,
      );
      await stop();
      const recovery = spawn("node", ["scripts/reset-password.mjs"], {
        env: { ...env, RESET_IDENTIFIER: "admin", RESET_PASSWORD: password },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let recoveryLog = "";
      recovery.stdout.on("data", (b) => (recoveryLog += b));
      recovery.stderr.on("data", (b) => (recoveryLog += b));
      const [recoveryCode] = await once(recovery, "exit");
      assert.equal(recoveryCode, 0, recoveryLog);
      await start();
      await request(
        "login",
        { identifiant: "admin", password: changedPassword },
        401,
      );
      await request("login", { identifiant: "admin", password });
      if (process.env.PREVIEW_DEV !== "1") {
        // An unreachable configured PostgreSQL must return JSON failure, never create a new preview DB.
        await stop();
        await start({
          DATABASE_MODE: "postgres",
          DATABASE_URL: "postgres://test:test@127.0.0.1:1/missing",
        });
        await request("login", { identifiant: "admin", password }, 503);
      }
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
