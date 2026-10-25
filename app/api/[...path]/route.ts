import {
  authenticationStatus,
  loginAccount,
  registerAccount,
  logoutAccount,
  changePassword,
} from "../../../server/authentication";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser, HttpError, checkOrigin } from "../../../server/auth";
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
    if (route === "auth/status" && !isPost)
      return NextResponse.json(await authenticationStatus());
    if ((route === "login" || route === "auth/login") && isPost)
      return NextResponse.json(await loginAccount(await json(), req));
    if (route === "auth/register" && isPost)
      return NextResponse.json(await registerAccount(await json(), req), {
        status: 201,
      });
    if ((route === "logout" || route === "auth/logout") && isPost)
      return NextResponse.json(await logoutAccount());
    if (route === "auth/password" && isPost)
      return NextResponse.json(await changePassword(await json()));
    if (route === "me" && !isPost)
      return NextResponse.json(await requireUser());
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
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    console.error("API failure", {
      type: e instanceof Error ? e.name : "Unknown",
    });
    return NextResponse.json(
      {
        error:
          "Le stockage du CRM est indisponible. Actualisez la connexion ; vos données n’ont pas été réinitialisées.",
        code: "DATABASE_UNAVAILABLE",
      },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
