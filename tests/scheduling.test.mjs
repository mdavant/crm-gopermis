import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionMinutes, parisDate } from "../domain/scheduling.ts";
import { eligibleCompanion } from "../domain/pricing.ts";
test("durée réelle, intervalles invalides et minutes entières", () => {
  assert.equal(
    sessionMinutes("2026-10-25T02:00:00+02:00", "2026-10-25T02:00:00+01:00"),
    60,
  );
  for (const [a, b] of [
    ["invalid", "invalid"],
    ["2026-01-01T10:00Z", "2026-01-01T09:00Z"],
    ["2026-01-01T10:00:00Z", "2026-01-01T10:00:30Z"],
    ["2026-01-01T10:00Z", "2026-01-01T10:00Z"],
  ])
    assert.throws(() => sessionMinutes(a, b));
});
test("ancienneté permis : dates invalides, avenir, anniversaire et année bissextile", () => {
  for (const [license, on] of [
    ["2021-01-01", "2026-02-31"],
    ["2021-01-01", "2026-13-01"],
    ["2027-01-01", "2026-01-01"],
    ["9999-01-01", "2026-01-01"],
    ["invalid", "2026-01-01"],
    ["2020-02-29", "2025-02-28"],
  ])
    assert.equal(eligibleCompanion(license, on), false);
  assert.equal(eligibleCompanion("2020-02-29", "2025-03-01"), true);
  assert.equal(eligibleCompanion("2021-01-01", "2026-01-01"), true);
  assert.equal(parisDate("2026-01-01T23:30:00Z"), "2026-01-02");
});
