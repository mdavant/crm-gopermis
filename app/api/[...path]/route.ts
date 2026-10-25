import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
import { db } from "../../../server/db";
import {
  requireUser,
  digest,
  HttpError,
  checkOrigin,
} from "../../../server/auth";
import {
  catalog,
  listClients,
  createClient,
  detail,
  createService,
  recordPayment,
  transaction,
  audit,
} from "../../../server/crm";
import {
  resources,
  createResource,
  archiveResource,
  createBlock,
  releaseBlock,
  listBookings,
  createBooking,
  completeBooking,
} from "../../../server/scheduling";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  req: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await context.params).path;
    const route = path.join("/");
    const isPost = req.method === "POST";
    if (isPost) checkOrigin(req);
    const json = async () => {
      const body = await req.text();
      if (body.length > 16000)
        throw new HttpError(413, "Requête trop volumineuse");
      try {
        return JSON.parse(body);
      } catch {
        throw new HttpError(400, "JSON invalide");
      }
    };
    if (route === "login" && isPost) {
      const x = z
        .object({
          email: z.email().max(254),
          password: z.string().min(1).max(256),
        })
        .parse(await json());
      const key = digest(x.email.toLowerCase());
      const attempt = await db().query(
        `INSERT INTO login_attempt(key,attempts) VALUES($1,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempt.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempt.attempts+1 END,window_start=CASE WHEN login_attempt.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempt.window_start END RETURNING attempts`,
        [key],
      );
      if (attempt.rows[0].attempts > 10)
        throw new HttpError(
          429,
          "Trop de tentatives. Réessayez dans 15 minutes.",
        );
      const found = await db().query(
        "SELECT * FROM app_user WHERE email=$1 AND active",
        [x.email.toLowerCase()],
      );
      const u = found.rows[0];
      const [salt, hash] = (
        u?.password_hash ??
        "00000000000000000000000000000000:" + "0".repeat(128)
      ).split(":");
      const computed = scryptSync(x.password, salt, 64);
      if (!timingSafeEqual(computed, Buffer.from(hash, "hex")) || !u)
        throw new HttpError(401, "Identifiants incorrects");
      const token = randomBytes(32).toString("hex");
      await db().query(
        "INSERT INTO auth_session(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
        [digest(token), u.id],
      );
      (await cookies()).set("gopermis_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 28800,
      });
      return NextResponse.json({ ok: true });
    }
    if (route === "me" && !isPost)
      return NextResponse.json(await requireUser());
    if (route === "logout" && isPost) {
      const token = (await cookies()).get("gopermis_session")?.value;
      if (token)
        await db().query("DELETE FROM auth_session WHERE token_hash=$1", [
          digest(token),
        ]);
      (await cookies()).delete("gopermis_session");
      return NextResponse.json({ ok: true });
    }
    if (route === "catalog" && !isPost) {
      await requireUser("clients.read");
      return NextResponse.json(await catalog());
    }
    if (route === "clients") {
      const u = await requireUser(isPost ? "clients.write" : "clients.read");
      return NextResponse.json(
        isPost
          ? await createClient(await json(), u.id)
          : await listClients(new URL(req.url).searchParams.get("q") ?? ""),
        { status: isPost ? 201 : 200 },
      );
    }
    if (path[0] === "clients" && path.length === 2 && !isPost) {
      const u = await requireUser("clients.read");
      return NextResponse.json(
        await detail(
          path[1],
          u.permissions.includes("payments.read"),
          u.permissions.includes("audit.read"),
        ),
      );
    }
    if (
      path[0] === "clients" &&
      path[2] === "services" &&
      path.length === 3 &&
      isPost
    ) {
      const u = await requireUser("services.write");
      return NextResponse.json(
        await createService(path[1], await json(), u.id),
        { status: 201 },
      );
    }
    if (
      path[0] === "clients" &&
      path[2] === "notes" &&
      path.length === 3 &&
      isPost
    ) {
      const u = await requireUser("clients.write");
      const id = z.uuid().parse(path[1]);
      const x = z
        .object({ body: z.string().trim().min(1).max(5000) })
        .parse(await json());
      await transaction(async (c) => {
        await c.query(
          "INSERT INTO note(client_id,body,created_by) VALUES($1,$2,$3)",
          [id, x.body, u.id],
        );
        await audit(c, u.id, "note.created", id);
      });
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    if (
      path[0] === "services" &&
      path[2] === "payments" &&
      path.length === 3 &&
      isPost
    ) {
      const u = await requireUser("payments.write");
      return NextResponse.json(
        await recordPayment(path[1], await json(), u.id),
        { status: 201 },
      );
    }
    if (route === "resources") {
      const u = await requireUser(isPost ? "resources.write" : "schedule.read");
      return NextResponse.json(
        isPost ? await createResource(await json(), u.id) : await resources(),
        { status: isPost ? 201 : 200 },
      );
    }
    if (route === "resources/archive" && isPost) {
      const u = await requireUser("resources.write");
      return NextResponse.json(await archiveResource(await json(), u.id));
    }
    if (route === "unavailability" && isPost) {
      const u = await requireUser("resources.write");
      return NextResponse.json(await createBlock(await json(), u.id), {
        status: 201,
      });
    }
    if (
      path[0] === "unavailability" &&
      path[2] === "release" &&
      path.length === 3 &&
      isPost
    ) {
      const u = await requireUser("resources.write");
      return NextResponse.json(await releaseBlock(path[1], u.id));
    }
    if (route === "bookings" && !isPost) {
      await requireUser("schedule.read");
      return NextResponse.json(
        await listBookings(
          new URL(req.url).searchParams.get("clientId") ?? undefined,
        ),
      );
    }
    if (
      path[0] === "services" &&
      path[2] === "bookings" &&
      path.length === 3 &&
      isPost
    ) {
      const u = await requireUser("schedule.write");
      return NextResponse.json(
        await createBooking(path[1], await json(), u.id),
        { status: 201 },
      );
    }
    if (
      path[0] === "bookings" &&
      path[2] === "complete" &&
      path.length === 3 &&
      isPost
    ) {
      const u = await requireUser("sessions.complete");
      return NextResponse.json(await completeBooking(path[1], u.id));
    }
    throw new HttpError(404, "Route introuvable");
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json(
        { error: "Données invalides", issues: e.issues },
        { status: 422 },
      );
    if (e instanceof HttpError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("API failure", {
      type: e instanceof Error ? e.name : "Unknown",
    });
    return NextResponse.json(
      {
        error:
          "Service indisponible. Vérifiez la configuration et la connexion PostgreSQL.",
      },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
