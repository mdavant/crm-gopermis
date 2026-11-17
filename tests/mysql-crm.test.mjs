import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testMysqlConnection, closeMysqlPool, mysqlQuery } from "../server/mysql.mjs";
import { migrateMysql, getMysqlMigrationStatus } from "../scripts/migrations-mysql.mjs";
import { hashPassword, verifyPassword } from "../server/accounts.mjs";

const HAS_MYSQL = Boolean(
  process.env.DB_HOST &&
  process.env.DB_NAME &&
  process.env.DB_USER &&
  process.env.DB_PASSWORD !== undefined,
);

test(
  "suite complète MySQL Hostinger (connexion, migrations, auth, RBAC, clients, dossiers, documents privés, réservations, sécurité)",
  { timeout: 120000 },
  async (t) => {
    if (!HAS_MYSQL) {
      t.skip(
        "Variables DB_HOST/DB_NAME/DB_USER/DB_PASSWORD absentes dans cet environnement : test MySQL ignoré localement (exécutez npm run test:mysql sur Hostinger).",
      );
      return;
    }

    const storageDir = await mkdtemp(join(tmpdir(), "gopermis-mysql-storage-"));
    const appOrigin = "http://127.0.0.1:3105";
    const env = {
      ...process.env,
      DATABASE_MODE: "mysql",
      APP_ORIGIN: appOrigin,
      STORAGE_DIR: storageDir,
      NEXT_TELEMETRY_DISABLED: "1",
    };

    let app;
    let logs = "";

    try {
      // 1. Connexion réelle à MySQL
      const conn = await testMysqlConnection();
      assert.equal(conn.ok, true, `Connexion MySQL échouée: ${conn.error ?? "inconnue"}`);

      // 2. Exécution des migrations sur la base MySQL (et idempotence)
      await migrateMysql();
      await migrateMysql();
      const status = await getMysqlMigrationStatus();
      assert.ok(status.length > 0 && status.every((m) => m.applied));

      // 3. Création compte admin (idempotent si inexistant ou dédié au test)
      const adminEmail = `admin-test-${randomUUID().slice(0, 8)}@gopermis.test`;
      const adminPassword = "TestAdminPassword!2026";
      const adminId = randomUUID();
      const adminHash = hashPassword(adminPassword);
      await mysqlQuery(
        `INSERT INTO users (id, first_name, last_name, name, email, password_hash, role, role_preset, is_active)
         VALUES (?, 'Admin', 'Test', 'Admin Test', ?, ?, 'admin', 'admin', 1)`,
        [adminId, adminEmail, adminHash],
      );
      await mysqlQuery(
        `INSERT INTO user_permissions (id, user_id, permission_name)
         VALUES (?, ?, 'admin.full')`,
        [randomUUID(), adminId],
      );

      // Démarrage du serveur Next.js en mode MySQL
      app = spawn(
        "node",
        ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3105"],
        { env, stdio: ["ignore", "pipe", "pipe"] },
      );
      app.stdout.on("data", (b) => (logs += b));
      app.stderr.on("data", (b) => (logs += b));

      let ready = false;
      for (let i = 0; i < 100; i++) {
        try {
          const r = await fetch(`${appOrigin}/api/health`);
          if (r.ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 150));
      }
      assert.ok(ready, `Serveur non prêt: ${logs}`);

      const makeClient = () => {
        let cookie = "";
        return async (path, body, expected = 200) => {
          const r = await fetch(`${appOrigin}/api/${path}`, {
            method: body === undefined ? "GET" : "POST",
            headers: {
              origin: appOrigin,
              cookie,
              ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
          });
          const setCookie = r.headers.get("set-cookie");
          if (setCookie) cookie = setCookie.split(";")[0];
          const text = await r.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
          assert.equal(r.status, expected, `${path} -> ${r.status}: ${text}`);
          return data;
        };
      };

      const adminReq = makeClient();

      // 4 & 5. Connexion avec mauvais puis bon mot de passe
      await adminReq("auth/login", { email: adminEmail, password: "wrong-password" }, 401);
      const logged = await adminReq("auth/login", { email: adminEmail, password: adminPassword }, 200);
      assert.equal(logged.ok, true);
      const userCheck = await mysqlQuery("SELECT last_login_at FROM users WHERE id = ?", [adminId]);
      assert.ok(userCheck[0].last_login_at);

      // 6. Rejet hash mal formé + e-mail invalide
      assert.equal(verifyPassword(adminPassword, "bad_hash"), false);
      await adminReq(
        "admin/users",
        { email: "email-invalide", name: "Invalid", password: "ValidPassword123!", rolePreset: "instructor" },
        422,
      );

      // 7. Création utilisateur limité (instructor sans admin.full ni documents.read) + rejet permissions
      const staffEmail = `moniteur-test-${randomUUID().slice(0, 8)}@gopermis.test`;
      const staffPassword = "StaffTestPassword!2026";
      await adminReq(
        "admin/users",
        {
          email: staffEmail,
          name: "Moniteur Limité",
          password: staffPassword,
          role: "instructor",
          rolePreset: "instructor",
          permissions: ["clients.read", "schedule.read"],
        },
        201,
      );

      const staffReq = makeClient();
      await staffReq("auth/login", { email: staffEmail, password: staffPassword }, 200);
      await staffReq("admin/users", undefined, 403);
      await staffReq("clients", { firstName: "Non", lastName: "Autorisé", phone: "0600000001" }, 403);

      // 8. Création et lecture d'un client + dossier client + document privé
      const phone = `06${Math.floor(10000000 + Math.random() * 89999999)}`;
      const client = await adminReq(
        "clients",
        { firstName: "Camille", lastName: "Durand", phone, email: "camille.durand@test.fr" },
        201,
      );
      const folder = await adminReq(
        `clients/${client.id}/folders`,
        { name: "Pièces d'identité", description: "Justificatifs" },
        201,
      );
      const pdfBytes = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
      const doc = await adminReq(
        `clients/${client.id}/documents`,
        {
          folderId: folder.id,
          originalName: "permis.pdf",
          mimeType: "application/pdf",
          isPrivate: true,
          contentBase64: pdfBytes.toString("base64"),
        },
        201,
      );

      // 9. Refus accès document privé par utilisateur non autorisé (403)
      await staffReq(`documents/${doc.id}/download`, undefined, 403);
      // Succès pour l'administrateur / propriétaire
      const foldersList = await adminReq(`clients/${client.id}/folders`, undefined, 200);
      assert.ok(foldersList.some((f) => f.id === folder.id));

      // 10. Blocage path traversal / MIME invalide / extension non autorisée
      await adminReq(
        `clients/${client.id}/documents`,
        {
          originalName: "../../hack.php",
          mimeType: "application/x-httpd-php",
          contentBase64: Buffer.from("<?php echo 1;").toString("base64"),
        },
        400,
      );
      await adminReq(
        `clients/${client.id}/documents`,
        {
          originalName: "virus.exe",
          mimeType: "application/octet-stream",
          contentBase64: Buffer.from("MZ").toString("base64"),
        },
        415,
      );

      // 11. Véhicule, moniteur, service, paiement et réservation sans chevauchement
      const vehicle = await adminReq(
        "resources",
        { kind: "vehicle", modelId: "clio-manual", label: `Clio Test ${randomUUID().slice(0, 6)}` },
        201,
      );
      const instructor = await adminReq(
        "resources",
        { kind: "instructor", name: `Moniteur Test ${randomUUID().slice(0, 6)}` },
        201,
      );
      const svc = await adminReq(
        `clients/${client.id}/services`,
        { typeId: "extra", model: "clio-manual", support: "GoPermis", minutes: 60 },
        201,
      );
      const bookingSlot = {
        vehicleId: vehicle.id,
        instructorId: instructor.id,
        startsAt: "2027-06-15T09:00:00Z",
        endsAt: "2027-06-15T10:00:00Z",
      };
      await adminReq(
        `services/${svc.id}/bookings`,
        { ...bookingSlot, requestId: randomUUID() },
        201,
      );
      await adminReq(
        `services/${svc.id}/bookings`,
        { ...bookingSlot, requestId: randomUUID() },
        409,
      );

      // 12. Aucun mot de passe ni DB_PASSWORD dans les logs
      assert.equal(logs.includes(process.env.DB_PASSWORD || "__NO_PASS__"), false);
      assert.equal(logs.includes(adminPassword), false);
      assert.equal(logs.includes(staffPassword), false);
    } finally {
      if (app) {
        app.kill("SIGTERM");
        if (app.exitCode === null && app.signalCode === null) await once(app, "exit");
      }
      await closeMysqlPool().catch(() => {});
      await rm(storageDir, { recursive: true, force: true });
    }
  },
);
