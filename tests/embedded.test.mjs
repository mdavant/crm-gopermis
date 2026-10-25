import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { embeddedPool } from "../server/embedded-pool.mjs";
test("adaptateur local : résultats SELECT/RETURNING et transactions concurrentes isolées", async () => {
  const pool = embeddedPool(await PGlite.create());
  try {
    await pool.query("CREATE TABLE balance(value integer CHECK(value>=0))");
    assert.equal(
      (await pool.query("INSERT INTO balance VALUES(2)")).rowCount,
      1,
    );
    assert.equal((await pool.query("SELECT * FROM balance")).rowCount, 1);
    assert.equal(
      (await pool.query("SELECT * FROM balance WHERE false")).rowCount,
      0,
    );
    async function spend() {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const n = (await c.query("SELECT value FROM balance")).rows[0].value;
        await c.query("UPDATE balance SET value=$1", [n - 1]);
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }
    await Promise.all([spend(), spend()]);
    assert.equal(
      (await pool.query("SELECT value FROM balance")).rows[0].value,
      0,
    );
  } finally {
    await pool.end();
  }
});
