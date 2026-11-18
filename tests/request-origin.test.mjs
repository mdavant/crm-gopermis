import { test } from "node:test";
import assert from "node:assert/strict";
import { productionOriginAllowed } from "../server/request-origin.mjs";

const publicOrigin = "https://awake-darkslateblue-rabbit-60.hostingersite.com";
const request = (origin = publicOrigin, extraHeaders = {}) =>
  new Request("http://127.0.0.1:3000/api/auth/login", {
    method: "POST",
    headers: { ...(origin === undefined ? {} : { origin }), ...extraHeaders },
  });

test("Hostinger : l'origine publique fonctionne derrière le proxy avec une URL canonique ou copiée", () => {
  for (const configured of [
    publicOrigin,
    `${publicOrigin}/`,
    `  ${publicOrigin}/  `,
    "https://AWake-darkslateblue-rabbit-60.hostingersite.com:443/",
  ])
    assert.equal(productionOriginAllowed(request(), configured), true);
});

test("les origines étrangères, absentes, nulles et les autres ports restent refusés", () => {
  for (const origin of [
    "https://attacker.example",
    `${publicOrigin}.attacker.example`,
    publicOrigin.replace("https:", "http:"),
    `${publicOrigin}:8443`,
    "null",
    "",
  ])
    assert.equal(productionOriginAllowed(request(origin), publicOrigin), false);
  assert.equal(
    productionOriginAllowed(
      new Request(`${publicOrigin}/api/auth/login`),
      publicOrigin,
    ),
    false,
  );
});

test("des en-têtes de proxy et same-origin ne remplacent jamais l'origine configurée", () => {
  assert.equal(
    productionOriginAllowed(
      request("https://attacker.example", {
        "x-forwarded-host": "attacker.example",
        "x-forwarded-proto": "https",
        host: "attacker.example",
        "sec-fetch-site": "same-origin",
      }),
      publicOrigin,
    ),
    false,
  );
  assert.equal(
    productionOriginAllowed(request(), "https://another.example"),
    false,
  );
});

test("une configuration explicite invalide échoue sans repli permissif", () => {
  for (const configured of [
    " ",
    "invalid",
    "null",
    "ftp://example.test",
    `${publicOrigin}/login`,
    `${publicOrigin}?debug=1`,
    `${publicOrigin}#fragment`,
    "https://user:password@example.test",
  ])
    assert.equal(productionOriginAllowed(request(), configured), false);
});

test("sans configuration explicite, seule l'origine de l'URL de la requête est acceptée", () => {
  assert.equal(
    productionOriginAllowed(
      new Request(`${publicOrigin}/api/auth/login`, {
        headers: { origin: publicOrigin },
      }),
    ),
    true,
  );
  assert.equal(productionOriginAllowed(request()), false);
});
