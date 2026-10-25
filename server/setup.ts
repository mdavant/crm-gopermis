import { z } from "zod";
import { db } from "./db";
import { HttpError } from "./auth";
import { createAccount } from "./accounts.mjs";
/** Initial setup is for private development previews only, never PostgreSQL/team deployments. */
function allowed() {
  const isPlaceholder = Boolean(
    process.env.DATABASE_URL &&
      (process.env.DATABASE_URL.includes("change-me") ||
        process.env.DATABASE_URL.includes("localhost:5432")),
  );
  const embedded =
    process.env.DATABASE_MODE === "pglite" ||
    (!process.env.DATABASE_MODE && !process.env.DATABASE_URL) ||
    isPlaceholder ||
    Boolean((globalThis as Record<symbol, any>)[Symbol.for("gopermis.database")]?.embedded);
  return (
    embedded &&
    (process.env.NODE_ENV !== "production" ||
      process.env.ALLOW_PREVIEW_SETUP === "1" ||
      isPlaceholder)
  );
}
export async function setupStatus() {
  if (!allowed()) return { required: false };
  return {
    required: !(await db().query("SELECT 1 FROM app_user LIMIT 1")).rowCount,
  };
}
export async function setupAccount(raw: unknown) {
  if (!allowed())
    throw new HttpError(403, "Création initiale réservée à l’aperçu privé.");
  const x = z
    .object({
      identifiant: z.string().trim().min(1).max(254),
      name: z.string().trim().min(1).max(150),
      password: z.string().min(14, "14 caractères minimum").max(256),
    })
    .parse(raw);
  const c = await db().connect();
  try {
    const created = await createAccount(
      c,
      {
        identifier: x.identifiant.toLowerCase(),
        name: x.name,
        password: x.password,
      },
      { initialOnly: true },
    );
    if (!created)
      throw new HttpError(
        409,
        "Un compte existe déjà. Connectez-vous avec son identifiant et son mot de passe.",
      );
    return { ok: true };
  } finally {
    c.release();
  }
}
