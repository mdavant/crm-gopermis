import pg from "pg";
import { test } from "node:test";
import assert from "node:assert/strict";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
const run = async (cmd, args, env) => {
  const p = spawn(cmd, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  p.stdout.on("data", (b) => (output += b));
  p.stderr.on("data", (b) => (output += b));
  const [code] = await once(p, "exit");
  assert.equal(code, 0, output);
  return output;
};
test(
  "migrations, auth, permissions, clients, paiements, réservations, réalisation et concurrence native",
  { timeout: 120000 },
  async () => {
    const native = process.env.NATIVE_TEST_DATABASE_URL;
    const db = native
      ? new pg.Pool({ connectionString: native, max: 10 })
      : await PGlite.create({ extensions: { btree_gist, pg_trgm } });
    const socket = native
      ? null
      : new PGLiteSocketServer({ db, port: 55432, host: "127.0.0.1" });
    if (socket) await socket.start();
    const env = {
      DATABASE_URL: native ?? "postgres://test:test@127.0.0.1:55432/postgres",
      APP_ORIGIN: "http://127.0.0.1:3100",
      NEXT_TELEMETRY_DISABLED: "1",
      DB_POOL_SIZE: native ? "10" : "1",
    };
    let app;
    let logs = "";
    try {
      await run("node", ["scripts/migrate.mjs"], env);
      await run("node", ["scripts/migrate.mjs"], env);
      await run("node", ["scripts/create-user.mjs"], {
        ...env,
        BOOTSTRAP_EMAIL: "admin@example.test",
        BOOTSTRAP_NAME: "Admin fictif",
        BOOTSTRAP_PASSWORD: "fictitious-test-password",
      });
      app = spawn(
        "node",
        [
          "node_modules/next/dist/bin/next",
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          "3100",
        ],
        { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] },
      );
      app.stdout.on("data", (b) => (logs += b));
      app.stderr.on("data", (b) => (logs += b));
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try {
          const r = await fetch(env.APP_ORIGIN);
          if (r.ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.ok(ready, logs);
      let cookie = "";
      async function request(
        path,
        body,
        expected = 200,
        origin = env.APP_ORIGIN,
      ) {
        const r = await fetch(env.APP_ORIGIN + "/api/" + path, {
          method: body === undefined ? "GET" : "POST",
          headers: { origin, cookie, "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const value = await r.json();
        if (expected === "conflict-or-created")
          assert.ok([201, 409].includes(r.status), JSON.stringify(value));
        else if (expected === "edit-race")
          assert.ok([200, 409].includes(r.status), JSON.stringify(value));
        else if (expected === "completion-race")
          assert.ok([200, 422].includes(r.status), JSON.stringify(value));
        else assert.equal(r.status, expected, JSON.stringify(value));
        if (typeof expected === "string") value.httpStatus = r.status;
        const c = r.headers.get("set-cookie");
        if (c) cookie = c.split(";")[0];
        return value;
      }
      await request("clients", undefined, 401);
      await request(
        "login",
        { email: "admin@example.test", password: "wrong" },
        401,
      );
      const authenticated = await request("login", {
        email: "admin@example.test",
        password: "fictitious-test-password",
      });
      assert.equal(
        authenticated.session,
        undefined,
        "Production never exposes session tokens in JSON",
      );
      const bearerOnly = await fetch(env.APP_ORIGIN + "/api/me", {
        headers: { Authorization: "Bearer " + cookie.split("=")[1] },
      });
      assert.equal(
        bearerOnly.status,
        401,
        "Production ignores preview bearer transport",
      );
      await request("catalog/update", {kind:"offer",id:"10+1",label:"10 h + 1 h offerte",paidMinutes:600,bonusMinutes:60});
      await request("me/update", {name:"TEST Profil"});
      assert.equal((await request("me")).name,"TEST Profil");
      await request("me/update", {name:"TEST Profil",password:"fictitious-changed-password"},422);
      const archived=await request("clients",{firstName:"TEST",lastName:"Archivage",phone:"0600000099"},201);
      await request("clients/delete",{id:archived.id});
      assert.equal((await request("clients/"+archived.id)).client.status,"Archivé");
      await request("resources/update",{kind:"vehicle",id:randomUUID(),label:"TEST inconnu"},404);
      await request(
        "clients",
        { firstName: "Fail", lastName: "Origin", phone: "0600000000" },
        403,
        "https://attacker.example",
      );
      const client = await request(
        "clients",
        { firstName: "Élodie", lastName: "Fictive", phone: "0600000011" },
        201,
      );
      await request(
        "clients",
        { firstName: "Double", lastName: "Fictive", phone: "06 00 00 00 11" },
        409,
      );
      assert.equal((await request("clients?q=elodie")).length, 1);
      await request("clients/not-a-uuid", undefined, 422);
      await request(
        "clients/" + client.id + "/services",
        { typeId: "extra", model: "rs3", support: "Personnel", minutes: 600 },
        422,
      );
      await request(
        "clients/" + client.id + "/services",
        {
          typeId: "vtc",
          model: "clio-auto",
          support: "GoPermis",
          minutes: 600,
        },
        422,
      );
      const service = await request(
        "clients/" + client.id + "/services",
        {
          typeId: "extra",
          model: "clio-manual",
          support: "GoPermis",
          minutes: 600,
          offerId: "10+1",
        },
        201,
      );
      let d = await request("clients/" + client.id);
      assert.equal(d.ledger.length, 0);
      const payment = {
        amountCents: 35000,
        method: "Carte",
        requestId: randomUUID(),
      };
      await request("services/" + service.id + "/payments", payment, 201);
      await request("services/" + service.id + "/payments", payment, 201);
      d = await request("clients/" + client.id);
      assert.equal(d.payments.length, 1);
      assert.equal(
        d.ledger.reduce((n, l) => n + l.minutes, 0),
        660,
      );
      assert.equal(
        d.history.filter((a) => a.action === "payment.recorded").length,
        1,
      );
      await request(
        "services/" + service.id + "/payments",
        { ...payment, requestId: randomUUID(), amountCents: 1 },
        422,
      );
      const second = await request(
        "clients/" + client.id + "/services",
        {
          typeId: "extra",
          model: "clio-auto",
          support: "Personnel",
          minutes: 1200,
          offerId: "20+2",
        },
        201,
      );
      for (const amountCents of [30000, 30000])
        await request(
          "services/" + second.id + "/payments",
          { amountCents, method: "Virement", requestId: randomUUID() },
          201,
        );
      d = await request("clients/" + client.id);
      assert.equal(d.services.length, 2);
      assert.equal(
        d.ledger
          .filter((l) => l.service_id === second.id)
          .reduce((n, l) => n + l.minutes, 0),
        1200,
      );
      await request(
        "clients/" + client.id + "/notes",
        { body: "Note fictive de test" },
        201,
      );
      d = await request("clients/" + client.id);
      assert.equal(d.notes.length, 1);
      // Rate changes cannot rewrite sold service snapshots.
      await db.query(
        "UPDATE tariff_version SET cents=5000 WHERE model='clio-manual' AND support='GoPermis'",
      );
      d = await request("clients/" + client.id);
      assert.equal(
        d.services.find((s) => s.id === service.id).price_snapshot.unitCents,
        3500,
      );
      await assert.rejects(db.query("DELETE FROM hour_ledger"));
      await assert.rejects(db.query("DELETE FROM audit_event"));
      await assert.rejects(db.query("DELETE FROM payment"));
      await assert.rejects(
        db.query("UPDATE service SET price_snapshot='{}'::jsonb"),
      );
      await schedulingScenario(request, db, service, second, client, !!native);
      await directoryScenario(request, db, client, !!native);
      // Remove role while session exists: server must immediately deny access.
      await db.query("DELETE FROM user_role");
      await request("clients", undefined, 403);
      await request("logout", {});
      await request("me", undefined, 401);
      console.log(
        native
          ? "Parcours HTTP et concurrence vérifiés sur PostgreSQL natif."
          : "Parcours HTTP vérifié sur PGlite (sans garantie de concurrence native).",
      );
    } catch (e) {
      console.error(logs);
      throw e;
    } finally {
      if (app) {
        app.kill("SIGTERM");
        if (app.exitCode === null && app.signalCode === null)
          await once(app, "exit");
      }
      if (socket) await socket.stop();
      // Socket detach rolls back asynchronously; drain it before terminating WASM.
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (native) await db.end();
      else await db.close();
    }
  },
);

async function schedulingScenario(
  request,
  db,
  service,
  personal,
  client,
  native,
) {
  const vehicle = await request(
    "resources",
    { kind: "vehicle", modelId: "clio-manual", label: "TEST FICTIF Clio M" },
    201,
  );
  const other = await request(
    "resources",
    { kind: "vehicle", modelId: "clio-manual", label: "TEST FICTIF Clio M2" },
    201,
  );
  const auto = await request(
    "resources",
    { kind: "vehicle", modelId: "clio-auto", label: "TEST FICTIF Clio A" },
    201,
  );
  const instructor = await request(
    "resources",
    { kind: "instructor", name: "TEST FICTIF moniteur" },
    201,
  );
  const instructor2 = await request(
    "resources",
    { kind: "instructor", name: "TEST FICTIF moniteur 2" },
    201,
  );
  const slot = {
    startsAt: "2026-01-10T10:00:00Z",
    endsAt: "2026-01-10T11:00:00Z",
  };
  const book = (sid, data, status = 201) =>
    request(
      "services/" + sid + "/bookings",
      {
        ...slot,
        vehicleId: vehicle.id,
        instructorId: instructor.id,
        requestId: randomUUID(),
        ...data,
      },
      status,
    );
  await book(service.id, { endsAt: slot.startsAt }, 422);
  await book(service.id, { vehicleId: auto.id }, 422);
  await book(service.id, { instructorId: null }, 422);
  await book(
    personal.id,
    {
      vehicleId: auto.id,
      instructorId: null,
      companionName: "TEST accompagnateur",
      companionLicenseDate: "2025-01-01",
    },
    422,
  );
  const unavail = await request(
    "unavailability",
    {
      kind: "vehicle",
      resourceId: vehicle.id,
      ...slot,
      reason: "TEST entretien fictif",
    },
    201,
  );
  await book(service.id, {}, 409);
  await request("unavailability/" + unavail.id + "/release", {});
  await request("unavailability/" + unavail.id + "/release", {});
  const key = randomUUID();
  const b = await book(service.id, { requestId: key });
  assert.equal((await book(service.id, { requestId: key })).id, b.id);
  await book(
    service.id,
    { requestId: key, endsAt: "2026-01-10T12:00:00Z" },
    409,
  );
  await book(
    service.id,
    { vehicleId: other.id, instructorId: instructor2.id },
    409,
  ); // client conflict
  await request(
    "unavailability",
    {
      kind: "instructor",
      resourceId: instructor.id,
      ...slot,
      reason: "TEST bloc",
    },
    409,
  );
  await request(
    "unavailability",
    { kind: "client", resourceId: client.id, ...slot, reason: "TEST absence" },
    409,
  );
  const c2 = await request(
    "clients",
    { firstName: "TEST", lastName: "Planning", phone: "0600000042" },
    201,
  );
  const unpaid = await request(
    "clients/" + c2.id + "/services",
    { typeId: "extra", model: "clio-manual", support: "GoPermis", minutes: 60 },
    201,
  );
  await book(unpaid.id, {}, 409); // vehicle
  await book(unpaid.id, { vehicleId: other.id }, 409); // instructor
  const noCredit = await book(unpaid.id, {
    vehicleId: other.id,
    instructorId: instructor2.id,
  });
  await request("bookings/" + noCredit.id + "/complete", {}, 422);
  assert.equal((await request("clients/" + c2.id)).ledger.length, 0);
  assert.equal(
    (await request("bookings?clientId=" + c2.id))[0].status,
    "confirmed",
  );
  const retryPayment = {
    amountCents: unpaid.price_snapshot.totalCents,
    method: "Carte",
    requestId: randomUUID(),
  };
  if (native)
    await Promise.all([
      request("services/" + unpaid.id + "/payments", retryPayment, 201),
      request("services/" + unpaid.id + "/payments", retryPayment, 201),
    ]);
  else await request("services/" + unpaid.id + "/payments", retryPayment, 201);
  const complete = () => request("bookings/" + b.id + "/complete", {});
  if (native) await Promise.all([complete(), complete(), complete()]);
  else {
    await complete();
    await complete();
  }
  let d = await request("clients/" + client.id);
  const debits = d.ledger.filter((l) => l.booking_id === b.id);
  assert.equal(debits.length, 1);
  assert.equal(debits[0].minutes, -60);
  assert.equal(
    d.history.filter((h) => h.action === "session.completed").length,
    1,
  );
  assert.equal(
    d.ledger
      .filter((l) => l.service_id === service.id)
      .reduce((n, l) => n + l.minutes, 0),
    600,
  );
  await assert.rejects(db.query("DELETE FROM booking WHERE id=$1", [b.id]));
  await assert.rejects(
    db.query(
      "UPDATE booking SET starts_at=starts_at+interval '1 day' WHERE id=$1",
      [b.id],
    ),
  );
  // Adjacent intervals and personal accompaniment, including date roundtrip on retry.
  const personalBody = {
    vehicleId: auto.id,
    instructorId: null,
    startsAt: "2026-01-10T11:00:00Z",
    endsAt: "2026-01-10T12:00:00Z",
    companionName: "TEST accompagnateur",
    companionLicenseDate: "2010-01-01",
    requestId: randomUUID(),
  };
  const pb = await book(personal.id, personalBody);
  assert.equal((await book(personal.id, personalBody)).id, pb.id);
  const future = {
    startsAt: "2099-01-10T11:00:00Z",
    endsAt: "2099-01-10T12:00:00Z",
  };
  const futureBooking = await book(service.id, future);
  await request("bookings/" + futureBooking.id + "/complete", {}, 422);
  const todayOnly = await request("bookings?date=2026-01-10");
  assert.ok(todayOnly.some((x) => x.id === b.id));
  assert.ok(!todayOnly.some((x) => x.id === futureBooking.id));
  assert.ok(
    (await request("bookings?date=2099-01-10")).some(
      (x) => x.id === futureBooking.id,
    ),
  );
  await request("bookings?date=2026-02-31", undefined, 422);

  await request("resources/archive", { kind: "vehicle", id: vehicle.id }, 409);
  const ended = await request(
    "clients/" + c2.id + "/services",
    { typeId: "extra", model: "clio-manual", support: "GoPermis", minutes: 60 },
    201,
  );
  await db.query("UPDATE service SET status='Terminée' WHERE id=$1", [
    ended.id,
  ]);
  await book(
    ended.id,
    { startsAt: "2026-02-01T10:00:00Z", endsAt: "2026-02-01T11:00:00Z" },
    422,
  );
  if (native) {
    // Prove PostgreSQL exclusions independently of application resource locks.
    for (const [column, resourceId, constraint] of [
      ["vehicle_id", vehicle.id, "vehicle_busy"],
      ["instructor_id", instructor.id, "instructor_busy"],
      ["client_id", client.id, "client_busy"],
    ]) {
      const actor = (await db.query("SELECT id FROM app_user LIMIT 1")).rows[0]
        .id;
      const refs = (
        await db.query(
          "INSERT INTO unavailability(reason,starts_at,ends_at,created_by) VALUES('TEST SQL','2026-06-01T10:00Z','2026-06-01T11:00Z',$1),('TEST SQL concurrent','2026-06-01T10:00Z','2026-06-01T11:00Z',$1) RETURNING id",
          [actor],
        )
      ).rows;
      const a = await db.connect(),
        b = await db.connect();
      try {
        await a.query("BEGIN");
        await b.query("BEGIN");
        const sql = `INSERT INTO calendar_occupancy(${column},starts_at,ends_at,unavailability_id) VALUES($1,'2026-06-01T10:00Z','2026-06-01T11:00Z',$2)`;
        await a.query(sql, [resourceId, refs[0].id]);
        const pending = assert.rejects(
          b.query(sql, [resourceId, refs[1].id]),
          (e) => e.code === "23P01" && e.constraint === constraint,
        );
        await a.query("COMMIT");
        await pending;
        await b.query("ROLLBACK");
      } finally {
        await a.query("ROLLBACK");
        await b.query("ROLLBACK");
        a.release();
        b.release();
      }
    }
    // Different services/clients: exclusion constraints arbitrate overlapping resources.
    async function raceRequest(sid, body) {
      // request() asserts status, so ask for either then inspect via raw adapter below.
      return request(
        "services/" + sid + "/bookings",
        body,
        "conflict-or-created",
      );
    }
    const race = {
      vehicleId: vehicle.id,
      instructorId: instructor.id,
      startsAt: "2026-03-01T10:00:00Z",
      endsAt: "2026-03-01T11:00:00Z",
    };
    const raceResults = await Promise.all([
      raceRequest(service.id, { ...race, requestId: randomUUID() }),
      raceRequest(unpaid.id, { ...race, requestId: randomUUID() }),
    ]);
    assert.deepEqual(raceResults.map((r) => r.httpStatus).sort(), [201, 409]);
    // Two sessions, one hour of credit: concurrent completions cannot overdraft.
    const second = await book(unpaid.id, {
      vehicleId: other.id,
      instructorId: instructor2.id,
      startsAt: "2026-04-01T10:00:00Z",
      endsAt: "2026-04-01T11:00:00Z",
    });
    const results = await Promise.all([
      request("bookings/" + noCredit.id + "/complete", {}, "completion-race"),
      request("bookings/" + second.id + "/complete", {}, "completion-race"),
    ]);
    assert.deepEqual(results.map((r) => r.httpStatus).sort(), [200, 422]);
    const dd = await request("clients/" + c2.id);
    assert.equal(
      dd.ledger
        .filter((l) => l.service_id === unpaid.id)
        .reduce((n, l) => n + l.minutes, 0),
      0,
    );
    assert.equal(dd.payments.length, 1);
  }
  // Existing session, revoked permissions must be effective immediately.
  await db.query(
    "DELETE FROM role_permission WHERE permission_id IN ('schedule.write','sessions.complete','resources.write')",
  );
  await book(
    service.id,
    { startsAt: "2026-05-01T10:00:00Z", endsAt: "2026-05-01T11:00:00Z" },
    403,
  );
  await request("bookings/" + b.id + "/complete", {}, 403);
  await request("resources", { kind: "instructor", name: "Unauthorized" }, 403);
}

async function directoryScenario(request, db, client, native) {
  const before = await request("clients/" + client.id);
  const data = {
    firstName: "Élodie",
    lastName: "Fictive actualisée",
    phone: "+33 6 00 00 00 11",
    email: "elodie.maj@example.test",
    source: "TEST mise à jour",
    version: before.client.version,
  };
  const changed = await request("clients/" + client.id, data);
  assert.equal(changed.version, before.client.version + 1);
  await request("clients/" + client.id, { ...data, lastName: "Stale" }, 409);
  await request(
    "clients/" + client.id,
    { ...data, version: changed.version, phone: "0600000042" },
    409,
  );
  await request(
    "clients",
    { firstName: "TEST", lastName: "Double", phone: "0033600000011" },
    409,
  );
  const after = await request("clients/" + client.id);
  assert.equal(after.client.last_name, data.lastName);
  assert.deepEqual(
    after.services.map((s) => s.price_snapshot),
    before.services.map((s) => s.price_snapshot),
  );
  assert.deepEqual(
    after.ledger.map((l) => l.id),
    before.ledger.map((l) => l.id),
  );
  assert.equal(
    after.history.filter((a) => a.action === "client.updated").length,
    1,
  );
  await db.query(
    "INSERT INTO client(first_name,last_name,phone,source) SELECT 'TEST Répertoire','Paginé '||n,'07'||lpad(n::text,8,'0'),'TEST SQL' FROM generate_series(1,2105) n",
  );
  await db.query(
    "INSERT INTO client(first_name,last_name,phone,created_at,source) VALUES('TEST Horsfenêtre','Ancien','0800000000','1990-01-01','TEST SQL')",
  );
  assert.equal((await request("clients/search?q=horsfenetre")).total, 1);
  const one = await request(
    "clients/search?q=repertoire%20pagine&page=1&pageSize=25&status=Prospect",
  );
  const two = await request(
    "clients/search?q=répertoire%20paginé&page=2&pageSize=25",
  );
  assert.equal(one.total, 2105);
  assert.equal(one.pages, 85);
  assert.equal(one.items.length, 25);
  assert.equal(two.items.length, 25);
  assert.ok(!one.items.some((a) => two.items.some((b) => a.id === b.id)));
  assert.equal(
    (await request("clients/search?q=repertoire%20pagine&page=86")).items
      .length,
    0,
  );
  await request("clients/search?page=0", undefined, 422);
  await request("clients/search?pageSize=101", undefined, 422);
  assert.equal((await request("clients?q=horsfenetre")).length, 1);
  const index = (
    await db.query(
      "SELECT indexname FROM pg_indexes WHERE tablename='client' AND indexname='client_search_trgm'",
    )
  ).rows;
  assert.equal(index.length, 1);
  if (native) {
    const duplicate = {
      firstName: "TEST",
      lastName: "Concurrent",
      phone: "0699999911",
    };
    const results = await Promise.all([
      request("clients", duplicate, "conflict-or-created"),
      request(
        "clients",
        { ...duplicate, phone: "+33 6 99 99 99 11" },
        "conflict-or-created",
      ),
    ]);
    assert.deepEqual(results.map((r) => r.httpStatus).sort(), [201, 409]);
    const a = { ...data, version: changed.version };
    const updates = await Promise.all([
      request(
        "clients/" + client.id,
        { ...a, lastName: "Concurrent A" },
        "edit-race",
      ),
      request(
        "clients/" + client.id,
        { ...a, lastName: "Concurrent B" },
        "edit-race",
      ),
    ]);
    assert.deepEqual(updates.map((r) => r.httpStatus).sort(), [200, 409]);
  }
}
