import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { verifyPassword, hashPassword } from "../../../server/accounts.mjs";
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
  updateCatalog,
  deleteClient,
} from "../../../server/crm";
import {
  resources,
  createResource,
  archiveResource,
  updateResource,
  createBlock,
  releaseBlock,
  listBookings,
  createBooking,
  completeBooking,
} from "../../../server/scheduling";
import { setupStatus, setupAccount } from "../../../server/setup";
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
    if (route === "setup")
      return NextResponse.json(
        isPost ? await setupAccount(await json()) : await setupStatus(),
        { status: isPost ? 201 : 200 },
      );
    if (route === "login" && isPost) {
      const body = z.record(z.string(), z.unknown()).parse(await json());
      const rawIdentifier = body.identifiant || body.username || body.email;
      const x = z
        .object({
          identifiant: z.string().trim().min(1, "Identifiant requis").max(254),
          password: z.string().min(1, "Mot de passe requis").max(256),
        })
        .parse({
          identifiant: typeof rawIdentifier === "string" ? rawIdentifier : "",
          password: body.password,
        });
      const identifier = x.identifiant.trim().toLowerCase();
      const key = digest(identifier);
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
        "SELECT * FROM app_user WHERE lower(email)=$1 AND active",
        [identifier],
      );
      const u = found.rows[0];
      if (!verifyPassword(x.password, u?.password_hash) || !u)
        throw new HttpError(401, "Identifiants incorrects");
      const token = randomBytes(32).toString("hex");
      await db().query(
        "INSERT INTO auth_session(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
        [digest(token), u.id],
      );
      (await cookies()).set("gopermis_session", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 28800,
      });
      const perms = await db().query(
        "SELECT DISTINCT permission_id FROM user_role ur JOIN role_permission rp ON rp.role_id=ur.role_id WHERE ur.user_id=$1",
        [u.id],
      );
      const permissions = perms.rows.map((r) => r.permission_id as string);
      return NextResponse.json({
        ok: true,
        token,
        user: { id: u.id, name: u.name, permissions },
      });
    }
    if (route === "me" && !isPost)
      return NextResponse.json(await requireUser(undefined, req));
    if (route === "me/update" && isPost) {
      const u = await requireUser(undefined, req);
      const body = z
        .object({
          name: z.string().trim().min(1).max(150).optional(),
          password: z.string().min(8).max(256).optional(),
        })
        .parse(await json());
      if (body.name) {
        await db().query("UPDATE app_user SET name = $1 WHERE id = $2", [
          body.name,
          u.id,
        ]);
      }
      if (body.password) {
        const hash = hashPassword(body.password);
        await db().query(
          "UPDATE app_user SET password_hash = $1 WHERE id = $2",
          [hash, u.id],
        );
      }
      return NextResponse.json({ ok: true, name: body.name ?? u.name });
    }
    if (route === "logout" && isPost) {
      let token = (await cookies()).get("gopermis_session")?.value;
      if (!token) {
        const auth = req.headers.get("authorization");
        if (auth?.startsWith("Bearer ")) token = auth.slice(7).trim();
        if (!token) token = req.headers.get("x-session-token")?.trim();
      }
      if (token)
        await db().query("DELETE FROM auth_session WHERE token_hash=$1", [
          digest(token),
        ]);
      (await cookies()).delete("gopermis_session");
      return NextResponse.json({ ok: true });
    }
    if (route === "catalog" && !isPost) {
      await requireUser("clients.read", req);
      return NextResponse.json(await catalog());
    }
    if (route === "catalog/update" && isPost) {
      const u = await requireUser("clients.write", req);
      return NextResponse.json(await updateCatalog(await json(), u.id));
    }
    if (route === "clients/delete" && isPost) {
      const u = await requireUser("clients.write", req);
      const b = z.object({ id: z.string().uuid() }).parse(await json());
      return NextResponse.json(await deleteClient(b.id, u.id));
    }
    if (route === "clients") {
      const u = await requireUser(
        isPost ? "clients.write" : "clients.read",
        req,
      );
      return NextResponse.json(
        isPost
          ? await createClient(await json(), u.id)
          : await listClients(new URL(req.url).searchParams.get("q") ?? ""),
        { status: isPost ? 201 : 200 },
      );
    }
    if (path[0] === "clients" && path.length === 2 && !isPost) {
      const u = await requireUser("clients.read", req);
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
      const u = await requireUser("services.write", req);
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
      const u = await requireUser("clients.write", req);
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
      const u = await requireUser("payments.write", req);
      return NextResponse.json(
        await recordPayment(path[1], await json(), u.id),
        { status: 201 },
      );
    }
    if (route === "resources") {
      const u = await requireUser(
        isPost ? "resources.write" : "schedule.read",
        req,
      );
      return NextResponse.json(
        isPost ? await createResource(await json(), u.id) : await resources(),
        { status: isPost ? 201 : 200 },
      );
    }
    if (route === "resources/archive" && isPost) {
      const u = await requireUser("resources.write", req);
      return NextResponse.json(await archiveResource(await json(), u.id));
    }
    if (route === "resources/update" && isPost) {
      const u = await requireUser("resources.write", req);
      return NextResponse.json(await updateResource(await json(), u.id));
    }
    if (route === "unavailability" && isPost) {
      const u = await requireUser("resources.write", req);
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
      const u = await requireUser("resources.write", req);
      return NextResponse.json(await releaseBlock(path[1], u.id));
    }
    if (route === "bookings" && !isPost) {
      await requireUser("schedule.read", req);
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
      const u = await requireUser("schedule.write", req);
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
      const u = await requireUser("sessions.complete", req);
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
    console.error("API failure:", e);
    return NextResponse.json(
      {
        error:
          "Service indisponible. Vérifiez la configuration et la connexion PostgreSQL.",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
