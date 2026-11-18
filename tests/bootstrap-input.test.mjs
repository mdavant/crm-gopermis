import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { accountInput } from "../server/accounts.mjs";

const base = {
  BOOTSTRAP_NAME: "Administrateur GoPermis",
  BOOTSTRAP_PASSWORD: randomBytes(24).toString("hex"),
};

test("le bootstrap accepte et normalise un identifiant sans e-mail", () => {
  assert.deepEqual(
    accountInput({ ...base, BOOTSTRAP_IDENTIFIER: "  Admin  " }),
    {
      identifier: "admin",
      name: base.BOOTSTRAP_NAME,
      password: base.BOOTSTRAP_PASSWORD,
    },
  );
});

test("l'ancien e-mail reste accepté et l'identifiant explicite est prioritaire", () => {
  assert.equal(
    accountInput({ ...base, BOOTSTRAP_EMAIL: " ADMIN@EXAMPLE.TEST " })
      .identifier,
    "admin@example.test",
  );
  assert.equal(
    accountInput({
      ...base,
      BOOTSTRAP_IDENTIFIER: "admin",
      BOOTSTRAP_EMAIL: "legacy@example.test",
    }).identifier,
    "admin",
  );
});

test("les valeurs absentes ou hors limites sont rejetées sans révéler le secret", () => {
  const valid = { ...base, BOOTSTRAP_IDENTIFIER: "admin" };
  for (const invalid of [
    { BOOTSTRAP_IDENTIFIER: " " },
    { BOOTSTRAP_IDENTIFIER: "a".repeat(255) },
    { BOOTSTRAP_NAME: " " },
    { BOOTSTRAP_NAME: "a".repeat(151) },
    { BOOTSTRAP_PASSWORD: undefined },
    { BOOTSTRAP_PASSWORD: "a".repeat(13) },
    { BOOTSTRAP_PASSWORD: "a".repeat(257) },
  ]) {
    assert.throws(
      () => accountInput({ ...valid, ...invalid }),
      (error) => {
        assert.ok(!error.message.includes(base.BOOTSTRAP_PASSWORD));
        return /configuration privée/.test(error.message);
      },
    );
  }
});
