import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quote,
  eligibleCompanion,
  normalizeSearch,
} from "../domain/pricing.ts";
const rates = [
  {
    id: "v1",
    model: "clio",
    support: "GoPermis",
    cents: 3500,
    validFrom: "2026-01-01",
    validTo: "2027-01-01",
  },
  {
    id: "v2",
    model: "clio",
    support: "GoPermis",
    cents: 4000,
    validFrom: "2027-01-01",
    validTo: null,
  },
  {
    id: "rs3",
    model: "rs3",
    support: "GoPermis",
    cents: 7000,
    validFrom: "2026-01-01",
    validTo: null,
  },
];
const offers = [
  { id: "10+1", paidMinutes: 600, bonusMinutes: 60, singlePayment: true },
  { id: "20+2", paidMinutes: 1200, bonusMinutes: 120, singlePayment: true },
];
const base = {
  model: "clio",
  support: "GoPermis",
  minutes: 600,
  date: "2026-10-25",
};
test("10 payées + 1 offerte, tarif exact en centimes", () => {
  const q = quote(rates, offers, { ...base, offerId: "10+1" });
  assert.equal(q.totalCents, 35000);
  assert.equal(q.paidMinutes + q.potentialBonusMinutes, 660);
  assert.equal(q.singlePayment, true);
});
test("20 payées + 2 offertes", () => {
  const q = quote(rates, offers, { ...base, minutes: 1200, offerId: "20+2" });
  assert.equal(q.totalCents, 70000);
  assert.equal(q.potentialBonusMinutes, 120);
});
test("RS3 personnel impossible sans tarif autorisé", () =>
  assert.throws(() =>
    quote(rates, offers, { ...base, model: "rs3", support: "Personnel" }),
  ));
test("snapshot conserve son prix après changement de grille", () => {
  const q = quote(rates, offers, base);
  rates[0].cents = 3600;
  assert.equal(q.unitCents, 3500);
  rates[0].cents = 3500;
  assert.equal(
    quote(rates, offers, { ...base, date: "2027-01-01" }).unitCents,
    4000,
  );
});
test("forfait incompatible et offre inconnue refusés", () => {
  assert.throws(() =>
    quote(rates, offers, { ...base, minutes: 60, offerId: "10+1" }),
  );
  assert.throws(() => quote(rates, offers, { ...base, offerId: "unknown" }));
});
test("durées négatives, fractionnaires et excessives refusées", () => {
  for (const minutes of [-1, 0, 1.2, Infinity, 60001])
    assert.throws(() => quote(rates, offers, { ...base, minutes }));
});
test("cinq ans révolus au jour exact", () => {
  assert.equal(eligibleCompanion("2021-10-26", "2026-10-25"), false);
  assert.equal(eligibleCompanion("2021-10-25", "2026-10-25"), true);
  assert.equal(eligibleCompanion("2021-02-31", "2026-10-25"), false);
});
test("recherche normalise accents et téléphone", () => {
  assert.equal(normalizeSearch("Raphaël DUPONT"), "raphaeldupont");
  assert.equal(normalizeSearch("06 12.34-56 78"), "0612345678");
});
