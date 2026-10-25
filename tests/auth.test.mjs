import { test } from "node:test";
import assert from "node:assert/strict";
import { readApiResponse } from "../lib/http.ts";
test("une page HTML ne provoque pas une erreur JSON et son contenu reste privé", async () => {
  for (const status of [200, 404, 500, 502])
    await assert.rejects(
      readApiResponse(
        new Response("<html><head>private-server-detail</head></html>", {
          status,
          headers: { "Content-Type": "text/html" },
        }),
      ),
      (e) =>
        e.message.includes("ne répond pas en JSON") &&
        e.message.includes(String(status)) &&
        !e.message.includes("private-server-detail") &&
        !e.message.includes("Unexpected token"),
    );
});
test("erreurs JSON, contenu invalide et réponses applicatives", async () => {
  assert.deepEqual(await readApiResponse(Response.json({ ok: true })), {
    ok: true,
  });
  await assert.rejects(
    readApiResponse(
      Response.json({ error: "Identifiants incorrects" }, { status: 401 }),
    ),
    /Identifiants incorrects/,
  );
  await assert.rejects(
    readApiResponse(
      new Response("<html>", {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    ),
    /JSON illisible/,
  );
  await assert.rejects(
    readApiResponse(Response.json(null, { status: 503 })),
    /Erreur du serveur/,
  );
});

import { verifyPassword } from "../server/accounts.mjs";
import { randomBytes, scryptSync } from "node:crypto";
test("mot de passe correct, incorrect et hash incomplet refusé sans exception", () => {
  const salt = randomBytes(16).toString("hex");
  const password = randomBytes(24).toString("hex");
  const hash = salt + ":" + scryptSync(password, salt, 64).toString("hex");
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword(password + "x", hash), false);
  for (const invalid of [
    null,
    undefined,
    "",
    "invalid",
    "x:y",
    "0".repeat(32) + ":00",
  ])
    assert.equal(verifyPassword(password, invalid), false);
});
