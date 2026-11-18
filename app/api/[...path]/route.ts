import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { authenticationStatus, loginAccount, registerAccount, logoutAccount, changePassword } from "../../../server/authentication";
import { listClients, createClient, searchClients, updateClient } from "../../../server/clients";
import { z, ZodError } from "zod";
import {
  requireUser,
  HttpError,
  checkOrigin,
} from "../../../server/auth";
import { isMysqlMode, mysqlTransaction, testMysqlConnection } from "../../../server/mysql.mjs";
import { db } from "../../../server/db";
import { redactSensitive, splitFullName } from "../../../server/accounts.mjs";
import {
  listClientFolders,
  createClientFolder,
  listDocuments,
  uploadDocument,
  getAuthorizedDocument,
  deleteDocument,
} from "../../../server/documents";
import {
  catalog,
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
  getHomeStats,
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
import {
  listDriveItems,
  createFolder,
  createFile,
  updateDriveItem,
  deleteDriveItem,
  getFolderTree,
} from "../../../server/drive";
import {
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
} from "../../../server/admin";
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
    const json = async (maxBytes = 32000) => {
      const body = await req.text();
      if (body.length > maxBytes)
        throw new HttpError(413, "Requête trop volumineuse");
      try {
        return JSON.parse(body);
      } catch {
        throw new HttpError(400, "JSON invalide");
      }
    };
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    if (route === "health" && !isPost) {
      if (isMysqlMode()) {
        const res = await testMysqlConnection();
        return NextResponse.json(
          {
            ok: res.ok,
            mode: "mysql",
            database: res.database,
            version: res.version,
            ...(res.schemaIssues?.length ? { schemaIssues: res.schemaIssues } : {}),
            ...(res.bootstrap ? { bootstrap: res.bootstrap } : {}),
            ...(res.ok ? {} : { error: res.error }),
          },
          { status: res.ok ? 200 : 503 },
        );
      }
      await db().query("SELECT 1");
      return NextResponse.json({ ok: true, mode: "postgres" });
    }
    if (route === "setup")
      return NextResponse.json(
        isPost ? await setupAccount(await json()) : await setupStatus(),
        { status: isPost ? 201 : 200 },
      );
    if (route === "auth/status" && !isPost) return NextResponse.json(await authenticationStatus());
    if ((route === "login" || route === "auth/login") && isPost) return NextResponse.json(await loginAccount(await json(), req));
    if (route === "auth/register" && isPost) return NextResponse.json(await registerAccount(await json(), req), {status:201});
    if ((route === "logout" || route === "auth/logout") && isPost) return NextResponse.json(await logoutAccount());
    if (route === "auth/password" && isPost) return NextResponse.json(await changePassword(await json()));
    if (route === "me" && !isPost) return NextResponse.json(await requireUser());
    if (route === "me/update" && isPost) {
      const u = await requireUser();
      const body = z.object({ name:z.string().trim().min(1).max(150), password:z.string().min(14).max(256).optional(), currentPassword:z.string().max(256).optional() }).strict().parse(await json());
      if (body.password) await changePassword({currentPassword:body.currentPassword, newPassword:body.password});
      if (isMysqlMode()) {
        const split = splitFullName(body.name);
        await mysqlTransaction(async (conn) => {
          await conn.execute(
            "UPDATE users SET first_name = ?, last_name = ?, name = ? WHERE id = ?",
            [split.firstName, split.lastName, body.name, u.id],
          );
          await conn.execute(
            "INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, 'account.profile_updated', 'user', ?, '{}', ?)",
            [randomUUID(), u.id, u.id, clientIp],
          );
        });
      } else {
        await transaction(async c => {
          await c.query("UPDATE app_user SET name=$1 WHERE id=$2",[body.name,u.id]);
          await audit(c,u.id,"account.profile_updated",u.id);
        });
      }
      return NextResponse.json({ok:true,name:body.name});
    }
    if (route === "clients/search" && !isPost) {
      await requireUser("clients.read");
      return NextResponse.json(await searchClients(Object.fromEntries(new URL(req.url).searchParams)));
    }
    if (path[0]==="clients" && path[1]!=="delete" && path.length===2 && isPost) {
      const u=await requireUser("clients.write");
      return NextResponse.json(await updateClient(path[1],await json(),u.id));
    }
    if (route === "catalog" && !isPost) {
      await requireUser("clients.read");
      return NextResponse.json(await catalog());
    }
    if (route === "catalog/update" && isPost) {
      const u = await requireUser("catalog.write");
      return NextResponse.json(await updateCatalog(await json(), u.id));
    }
    if (route === "clients/delete" && isPost) {
      const u = await requireUser("clients.write");
      const b = z.object({ id: z.string().uuid() }).parse(await json());
      return NextResponse.json(await deleteClient(b.id, u.id));
    }
    if (route === "clients") {
      const u = await requireUser(
        isPost ? "clients.write" : "clients.read",
      );
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
      const id = z.string().uuid().parse(path[1]);
      const x = z
        .object({ body: z.string().trim().min(1).max(5000) })
        .parse(await json());
      if (isMysqlMode()) {
        const noteId = randomUUID();
        await mysqlTransaction(async (conn) => {
          await conn.execute(
            "INSERT INTO client_notes (id, client_id, body, created_by) VALUES (?, ?, ?, ?)",
            [noteId, id, x.body, u.id],
          );
          await conn.execute(
            "INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, 'note.created', 'client', ?, '{}', ?)",
            [randomUUID(), u.id, id, clientIp],
          );
        });
      } else {
        await transaction(async (c) => {
          await c.query(
            "INSERT INTO note(client_id,body,created_by) VALUES($1,$2,$3)",
            [id, x.body, u.id],
          );
          await audit(c, u.id, "note.created", id);
        });
      }
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    if (
      path[0] === "clients" &&
      path[2] === "folders" &&
      path.length === 3
    ) {
      if (isPost) {
        const u = await requireUser("clients.write");
        const body = await json(64000);
        return NextResponse.json(
          await createClientFolder({ ...body, clientId: path[1] }, u.id, clientIp),
          { status: 201 },
        );
      }
      await requireUser("clients.read");
      return NextResponse.json(await listClientFolders(path[1]));
    }
    if (
      path[0] === "clients" &&
      path[2] === "documents" &&
      path.length === 3
    ) {
      if (isPost) {
        const u = await requireUser();
        const canWrite =
          u.permissions.includes("admin.full") ||
          u.permissions.includes("documents.write") ||
          u.permissions.includes("clients.write") ||
          u.roles.includes("admin");
        if (!canWrite) {
          throw new HttpError(403, "Permission clients.write ou documents.write requise.", "FORBIDDEN");
        }
        const ctype = req.headers.get("content-type") || "";
        let payload: unknown;
        if (ctype.includes("multipart/form-data")) {
          const form = await req.formData();
          const file = form.get("file");
          if (!(file instanceof File)) {
            throw new HttpError(400, "Fichier manquant.", "MISSING_FILE");
          }
          const buf = Buffer.from(await file.arrayBuffer());
          payload = {
            clientId: path[1],
            folderId: (form.get("folderId") as string | null) || null,
            originalName: file.name,
            mimeType: file.type || "application/octet-stream",
            isPrivate: form.get("isPrivate") !== "false",
            contentBase64: buf.toString("base64"),
          };
        } else {
          const body = await json(15 * 1024 * 1024);
          payload = { ...body, clientId: path[1] };
        }
        return NextResponse.json(
          await uploadDocument(payload, u, clientIp),
          { status: 201 },
        );
      }
      const u = await requireUser("clients.read");
      const url = new URL(req.url);
      return NextResponse.json(
        await listDocuments(u, {
          clientId: path[1],
          folderId: url.searchParams.get("folderId") ?? undefined,
        }),
      );
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
      const u = await requireUser(
        isPost ? "resources.write" : "schedule.read",
      );
      return NextResponse.json(
        isPost ? await createResource(await json(), u.id) : await resources(),
        { status: isPost ? 201 : 200 },
      );
    }
    if (route === "resources/archive" && isPost) {
      const u = await requireUser("resources.write");
      return NextResponse.json(await archiveResource(await json(), u.id));
    }
    if (route === "resources/update" && isPost) {
      const u = await requireUser("resources.write");
      return NextResponse.json(await updateResource(await json(), u.id));
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
    if (route === "stats/summary" && !isPost) {
      const u=await requireUser("clients.read");
      const stats=await getHomeStats();
      return NextResponse.json(u.permissions.includes("schedule.read") ? stats : {...stats,todayBookingsCount:null,todayMinutes:null,todayHours:null});
    }
    if (route === "bookings" && !isPost) {
      await requireUser("schedule.read");
      return NextResponse.json(
        await listBookings(
          new URL(req.url).searchParams.get("clientId") ?? undefined,
          new URL(req.url).searchParams.get("date") ?? undefined,
          new URL(req.url).searchParams.get("startDate") ?? undefined,
          new URL(req.url).searchParams.get("endDate") ?? undefined,
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
    if (route === "drive/items" && !isPost) {
      await requireUser();
      const url = new URL(req.url);
      const parentId = url.searchParams.get("parentId");
      const search = url.searchParams.get("q") ?? undefined;
      const filter = url.searchParams.get("filter") ?? undefined;
      const starredOnly = url.searchParams.get("starred") === "true";
      return NextResponse.json(
        await listDriveItems({ parentId, search, filter, starredOnly })
      );
    }
    if (route === "drive/folders-tree" && !isPost) {
      await requireUser();
      return NextResponse.json(await getFolderTree());
    }
    if (route === "drive/folder" && isPost) {
      const u = await requireUser();
      const body = await json(64000);
      return NextResponse.json(
        await createFolder({ ...body, userId: u.id }),
        { status: 201 }
      );
    }
    if (route === "drive/file" && isPost) {
      const u = await requireUser();
      const body = await json(35 * 1024 * 1024);
      return NextResponse.json(
        await createFile({ ...body, userId: u.id }),
        { status: 201 }
      );
    }
    if (route === "drive/update" && isPost) {
      const u = await requireUser();
      const body = await json(64000);
      return NextResponse.json(
        await updateDriveItem(body.id, body.updates, u.id)
      );
    }
    if (route === "drive/delete" && isPost) {
      const u = await requireUser();
      const body = await json(64000);
      return NextResponse.json(
        await deleteDriveItem(body.id, u.id)
      );
    }
    if (route === "documents") {
      if (isPost) {
        const u = await requireUser();
        const canWrite =
          u.permissions.includes("admin.full") ||
          u.permissions.includes("documents.write") ||
          u.permissions.includes("clients.write") ||
          u.roles.includes("admin");
        if (!canWrite) {
          throw new HttpError(403, "Permission documents.write requise.", "FORBIDDEN");
        }
        const ctype = req.headers.get("content-type") || "";
        let payload: unknown;
        if (ctype.includes("multipart/form-data")) {
          const form = await req.formData();
          const file = form.get("file");
          if (!(file instanceof File)) {
            throw new HttpError(400, "Fichier manquant.", "MISSING_FILE");
          }
          const buf = Buffer.from(await file.arrayBuffer());
          payload = {
            clientId: (form.get("clientId") as string | null) || null,
            folderId: (form.get("folderId") as string | null) || null,
            originalName: file.name,
            mimeType: file.type || "application/octet-stream",
            isPrivate: form.get("isPrivate") !== "false",
            contentBase64: buf.toString("base64"),
          };
        } else {
          payload = await json(15 * 1024 * 1024);
        }
        return NextResponse.json(await uploadDocument(payload, u, clientIp), { status: 201 });
      }
      const u = await requireUser();
      const url = new URL(req.url);
      return NextResponse.json(
        await listDocuments(u, {
          clientId: url.searchParams.get("clientId") ?? undefined,
          folderId: url.searchParams.get("folderId") ?? undefined,
        }),
      );
    }
    if (
      path[0] === "documents" &&
      path[2] === "download" &&
      path.length === 3 &&
      !isPost
    ) {
      const u = await requireUser();
      const { document, content } = await getAuthorizedDocument(path[1], u);
      const safeDownloadName = document.original_name.replace(/["\r\n]/g, "_");
      return new NextResponse(new Uint8Array(content), {
        status: 200,
        headers: {
          "Content-Type": document.mime_type,
          "Content-Length": String(content.byteLength),
          "Content-Disposition": `attachment; filename="${safeDownloadName}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (
      path[0] === "documents" &&
      path[2] === "delete" &&
      path.length === 3 &&
      isPost
    ) {
      const u = await requireUser();
      return NextResponse.json(await deleteDocument(path[1], u, clientIp));
    }
    if (route === "admin/users" && !isPost) {
      return NextResponse.json(await listAdminUsers());
    }
    if (route === "admin/users" && isPost) {
      const body = await json(64000);
      return NextResponse.json(await createAdminUser(body), { status: 201 });
    }
    if (route === "admin/users/update" && isPost) {
      const body = await json(64000);
      return NextResponse.json(await updateAdminUser(body));
    }
    if (route === "admin/users/delete" && isPost) {
      const body = await json(64000);
      return NextResponse.json(await deleteAdminUser(body));
    }
    throw new HttpError(404, "Route introuvable");
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json(
        { error: "Données invalides", issues: e.issues },
        { status: 422 },
      );
    if (e instanceof HttpError)
      return NextResponse.json({ error: e.message, code:e.code }, { status: e.status });
    console.error("API failure", {
      type: e instanceof Error ? e.name : "Unknown",
      message: redactSensitive(e instanceof Error ? e.message : ""),
    });
    return NextResponse.json(
      {
        error:
          "Service indisponible. Vérifiez la configuration et la connexion à la base de données.",
        ...(dbErrorCode(e) ? { code: dbErrorCode(e) } : {}),
      },
      { status: 503 },
    );
  }
}
/** Code d'erreur MySQL générique (ex. ER_BAD_FIELD_ERROR), sans message ni donnée. */
function dbErrorCode(e: unknown) {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^(ER_[A-Z0-9_]+|ECONNREFUSED|ETIMEDOUT|PROTOCOL_[A-Z_]+)$/.test(code)
    ? code
    : undefined;
}
export const GET = handle;
export const POST = handle;
