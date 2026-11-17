import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isMysqlMode, mysqlQuery, mysqlTransaction } from "./mysql.mjs";
import { db } from "./db";
import { HttpError, type AuthenticatedUser } from "./auth";
import {
  decodeBase64DataUrl,
  deletePrivateFile,
  readPrivateFile,
  savePrivateFile,
} from "./storage";

export type ClientFolderRecord = {
  id: string;
  client_id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentRecord = {
  id: string;
  client_id: string | null;
  folder_id: string | null;
  uploaded_by: string;
  original_name: string;
  stored_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  is_private: boolean;
  created_at: string;
  updated_at: string;
};

const createFolderSchema = z.object({
  clientId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
});

const uploadDocumentSchema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  folderId: z.string().uuid().nullable().optional(),
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(150),
  isPrivate: z.boolean().optional().default(true),
  contentBase64: z.string().min(1),
});

export function canUserAccessDocument(
  user: AuthenticatedUser,
  doc: Pick<DocumentRecord, "uploaded_by" | "is_private">,
): boolean {
  const isAdmin =
    user.permissions.includes("admin.full") ||
    user.roles.includes("admin") ||
    user.roles.includes("technical_admin");
  if (isAdmin) return true;
  if (doc.uploaded_by === user.id) return true;
  if (!doc.is_private && user.permissions.includes("clients.read")) return true;
  return user.permissions.includes("documents.read");
}

export async function listClientFolders(clientId: string): Promise<ClientFolderRecord[]> {
  z.string().uuid().parse(clientId);
  if (isMysqlMode()) {
    const rows = (await mysqlQuery(
      `SELECT id, client_id, parent_id, name, description, created_by, created_at, updated_at
       FROM client_folders
       WHERE client_id = ?
       ORDER BY name ASC`,
      [clientId],
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      client_id: String(r.client_id),
      parent_id: r.parent_id ? String(r.parent_id) : null,
      name: String(r.name),
      description: r.description ? String(r.description) : null,
      created_by: r.created_by ? String(r.created_by) : null,
      created_at: new Date(r.created_at as string | Date).toISOString(),
      updated_at: new Date(r.updated_at as string | Date).toISOString(),
    }));
  }
  const res = await db().query(
    `SELECT id, client_id, parent_id, name, description, created_by, created_at, updated_at
     FROM client_folders
     WHERE client_id = $1
     ORDER BY name ASC`,
    [clientId],
  );
  return res.rows as ClientFolderRecord[];
}

export async function createClientFolder(
  raw: unknown,
  actorId: string,
  ipAddress: string | null = null,
): Promise<ClientFolderRecord> {
  const input = createFolderSchema.parse(raw);
  const id = randomUUID();

  if (isMysqlMode()) {
    return mysqlTransaction(async (conn) => {
      const [clients] = await conn.execute(
        "SELECT id FROM clients WHERE id = ? LIMIT 1",
        [input.clientId],
      );
      if (!Array.isArray(clients) || clients.length === 0) {
        throw new HttpError(404, "Client introuvable", "CLIENT_NOT_FOUND");
      }
      if (input.parentId) {
        const [parents] = await conn.execute(
          "SELECT id FROM client_folders WHERE id = ? AND client_id = ? LIMIT 1",
          [input.parentId, input.clientId],
        );
        if (!Array.isArray(parents) || parents.length === 0) {
          throw new HttpError(404, "Dossier parent introuvable", "FOLDER_NOT_FOUND");
        }
      }
      await conn.execute(
        `INSERT INTO client_folders (id, client_id, parent_id, name, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.clientId,
          input.parentId ?? null,
          input.name,
          input.description ?? null,
          actorId,
        ],
      );
      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, 'client_folder.created', 'client_folder', ?, ?, ?)`,
        [
          randomUUID(),
          actorId,
          id,
          JSON.stringify({ clientId: input.clientId, name: input.name }),
          ipAddress,
        ],
      );
      const [created] = await conn.execute(
        "SELECT * FROM client_folders WHERE id = ?",
        [id],
      );
      const row = (created as Record<string, unknown>[])[0];
      return {
        id: String(row.id),
        client_id: String(row.client_id),
        parent_id: row.parent_id ? String(row.parent_id) : null,
        name: String(row.name),
        description: row.description ? String(row.description) : null,
        created_by: row.created_by ? String(row.created_by) : null,
        created_at: new Date(row.created_at as string | Date).toISOString(),
        updated_at: new Date(row.updated_at as string | Date).toISOString(),
      };
    });
  }

  const c = await db().connect();
  try {
    await c.query("BEGIN");
    const cl = await c.query("SELECT id FROM client WHERE id = $1", [input.clientId]);
    if (!cl.rowCount) throw new HttpError(404, "Client introuvable", "CLIENT_NOT_FOUND");
    if (input.parentId) {
      const pf = await c.query(
        "SELECT id FROM client_folders WHERE id = $1 AND client_id = $2",
        [input.parentId, input.clientId],
      );
      if (!pf.rowCount) throw new HttpError(404, "Dossier parent introuvable", "FOLDER_NOT_FOUND");
    }
    const r = await c.query(
      `INSERT INTO client_folders (id, client_id, parent_id, name, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, input.clientId, input.parentId ?? null, input.name, input.description ?? null, actorId],
    );
    await c.query(
      "INSERT INTO audit_event (actor_id, action, resource_id, details) VALUES ($1, $2, $3, $4)",
      [actorId, "client_folder.created", id, JSON.stringify({ clientId: input.clientId })],
    );
    await c.query("COMMIT");
    return r.rows[0] as ClientFolderRecord;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

export async function listDocuments(
  user: AuthenticatedUser,
  options: { clientId?: string; folderId?: string } = {},
): Promise<DocumentRecord[]> {
  if (options.clientId) z.string().uuid().parse(options.clientId);
  if (options.folderId) z.string().uuid().parse(options.folderId);

  let rows: DocumentRecord[] = [];
  if (isMysqlMode()) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (options.clientId) {
      clauses.push("client_id = ?");
      params.push(options.clientId);
    }
    if (options.folderId) {
      clauses.push("folder_id = ?");
      params.push(options.folderId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const raw = (await mysqlQuery(
      `SELECT id, client_id, folder_id, uploaded_by, original_name, stored_name, storage_path, mime_type, file_size, is_private, created_at, updated_at
       FROM documents ${where}
       ORDER BY created_at DESC`,
      params,
    )) as Record<string, unknown>[];
    rows = raw.map((r) => ({
      id: String(r.id),
      client_id: r.client_id ? String(r.client_id) : null,
      folder_id: r.folder_id ? String(r.folder_id) : null,
      uploaded_by: String(r.uploaded_by),
      original_name: String(r.original_name),
      stored_name: String(r.stored_name),
      storage_path: String(r.storage_path),
      mime_type: String(r.mime_type),
      file_size: Number(r.file_size),
      is_private: Boolean(r.is_private),
      created_at: new Date(r.created_at as string | Date).toISOString(),
      updated_at: new Date(r.updated_at as string | Date).toISOString(),
    }));
  } else {
    const res = await db().query(
      `SELECT id, client_id, folder_id, uploaded_by, original_name, stored_name, storage_path, mime_type, file_size, is_private, created_at, updated_at
       FROM documents
       WHERE ($1::uuid IS NULL OR client_id = $1)
         AND ($2::uuid IS NULL OR folder_id = $2)
       ORDER BY created_at DESC`,
      [options.clientId ?? null, options.folderId ?? null],
    );
    rows = res.rows.map((r) => ({
      ...(r as DocumentRecord),
      file_size: Number(r.file_size),
      is_private: Boolean(r.is_private),
    }));
  }

  return rows.filter((d) => canUserAccessDocument(user, d));
}

export async function uploadDocument(
  raw: unknown,
  user: AuthenticatedUser,
  ipAddress: string | null = null,
): Promise<DocumentRecord> {
  const input = uploadDocumentSchema.parse(raw);
  const { buffer, detectedMime } = decodeBase64DataUrl(input.contentBase64);
  const effectiveMime = detectedMime || input.mimeType;

  const saved = await savePrivateFile(
    input.originalName,
    effectiveMime,
    buffer,
    input.clientId ? `clients/${input.clientId}` : "documents",
  );

  const id = randomUUID();

  try {
    if (isMysqlMode()) {
      return await mysqlTransaction(async (conn) => {
        if (input.clientId) {
          const [cl] = await conn.execute("SELECT id FROM clients WHERE id = ? LIMIT 1", [
            input.clientId,
          ]);
          if (!Array.isArray(cl) || cl.length === 0) {
            throw new HttpError(404, "Client introuvable", "CLIENT_NOT_FOUND");
          }
        }
        if (input.folderId) {
          const [fl] = await conn.execute(
            "SELECT id, client_id FROM client_folders WHERE id = ? LIMIT 1",
            [input.folderId],
          );
          const folder = (fl as Record<string, unknown>[])[0];
          if (!folder) {
            throw new HttpError(404, "Dossier introuvable", "FOLDER_NOT_FOUND");
          }
          if (input.clientId && folder.client_id !== input.clientId) {
            throw new HttpError(422, "Le dossier n'appartient pas à ce client.");
          }
        }

        await conn.execute(
          `INSERT INTO documents (id, client_id, folder_id, uploaded_by, original_name, stored_name, storage_path, mime_type, file_size, is_private)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            input.clientId ?? null,
            input.folderId ?? null,
            user.id,
            saved.originalName,
            saved.storedName,
            saved.storagePath,
            saved.mimeType,
            saved.fileSize,
            input.isPrivate ? 1 : 0,
          ],
        );

        await conn.execute(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
           VALUES (?, ?, 'document.uploaded', 'document', ?, ?, ?)`,
          [
            randomUUID(),
            user.id,
            id,
            JSON.stringify({
              clientId: input.clientId ?? null,
              folderId: input.folderId ?? null,
              originalName: saved.originalName,
              fileSize: saved.fileSize,
            }),
            ipAddress,
          ],
        );

        const [rows] = await conn.execute("SELECT * FROM documents WHERE id = ?", [id]);
        const r = (rows as Record<string, unknown>[])[0];
        return {
          id: String(r.id),
          client_id: r.client_id ? String(r.client_id) : null,
          folder_id: r.folder_id ? String(r.folder_id) : null,
          uploaded_by: String(r.uploaded_by),
          original_name: String(r.original_name),
          stored_name: String(r.stored_name),
          storage_path: String(r.storage_path),
          mime_type: String(r.mime_type),
          file_size: Number(r.file_size),
          is_private: Boolean(r.is_private),
          created_at: new Date(r.created_at as string | Date).toISOString(),
          updated_at: new Date(r.updated_at as string | Date).toISOString(),
        };
      });
    }

    const c = await db().connect();
    try {
      await c.query("BEGIN");
      if (input.clientId) {
        const cl = await c.query("SELECT id FROM client WHERE id = $1", [input.clientId]);
        if (!cl.rowCount) throw new HttpError(404, "Client introuvable", "CLIENT_NOT_FOUND");
      }
      if (input.folderId) {
        const fl = await c.query("SELECT id, client_id FROM client_folders WHERE id = $1", [
          input.folderId,
        ]);
        if (!fl.rowCount) throw new HttpError(404, "Dossier introuvable", "FOLDER_NOT_FOUND");
        if (input.clientId && fl.rows[0].client_id !== input.clientId) {
          throw new HttpError(422, "Le dossier n'appartient pas à ce client.");
        }
      }
      const res = await c.query(
        `INSERT INTO documents (id, client_id, folder_id, uploaded_by, original_name, stored_name, storage_path, mime_type, file_size, is_private)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          id,
          input.clientId ?? null,
          input.folderId ?? null,
          user.id,
          saved.originalName,
          saved.storedName,
          saved.storagePath,
          saved.mimeType,
          saved.fileSize,
          input.isPrivate,
        ],
      );
      await c.query(
        "INSERT INTO audit_event (actor_id, action, resource_id, details) VALUES ($1, $2, $3, $4)",
        [
          user.id,
          "document.uploaded",
          id,
          JSON.stringify({ originalName: saved.originalName, fileSize: saved.fileSize }),
        ],
      );
      await c.query("COMMIT");
      return {
        ...(res.rows[0] as DocumentRecord),
        file_size: Number(res.rows[0].file_size),
        is_private: Boolean(res.rows[0].is_private),
      };
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  } catch (err) {
    await deletePrivateFile(saved.storagePath);
    throw err;
  }
}

export async function getAuthorizedDocument(
  documentId: string,
  user: AuthenticatedUser,
): Promise<{ document: DocumentRecord; content: Buffer }> {
  z.string().uuid().parse(documentId);
  let doc: DocumentRecord | undefined;

  if (isMysqlMode()) {
    const rows = (await mysqlQuery(
      "SELECT * FROM documents WHERE id = ? LIMIT 1",
      [documentId],
    )) as Record<string, unknown>[];
    if (rows[0]) {
      const r = rows[0];
      doc = {
        id: String(r.id),
        client_id: r.client_id ? String(r.client_id) : null,
        folder_id: r.folder_id ? String(r.folder_id) : null,
        uploaded_by: String(r.uploaded_by),
        original_name: String(r.original_name),
        stored_name: String(r.stored_name),
        storage_path: String(r.storage_path),
        mime_type: String(r.mime_type),
        file_size: Number(r.file_size),
        is_private: Boolean(r.is_private),
        created_at: new Date(r.created_at as string | Date).toISOString(),
        updated_at: new Date(r.updated_at as string | Date).toISOString(),
      };
    }
  } else {
    const res = await db().query("SELECT * FROM documents WHERE id = $1", [documentId]);
    if (res.rows[0]) {
      doc = {
        ...(res.rows[0] as DocumentRecord),
        file_size: Number(res.rows[0].file_size),
        is_private: Boolean(res.rows[0].is_private),
      };
    }
  }

  if (!doc) {
    throw new HttpError(404, "Document introuvable", "DOCUMENT_NOT_FOUND");
  }

  if (!canUserAccessDocument(user, doc)) {
    throw new HttpError(
      403,
      "Accès refusé à ce document privé.",
      "DOCUMENT_FORBIDDEN",
    );
  }

  const content = await readPrivateFile(doc.storage_path);
  return { document: doc, content };
}

export async function deleteDocument(
  documentId: string,
  user: AuthenticatedUser,
  ipAddress: string | null = null,
): Promise<{ ok: boolean }> {
  z.string().uuid().parse(documentId);

  if (isMysqlMode()) {
    const storagePath = await mysqlTransaction(async (conn) => {
      const [rows] = await conn.execute(
        "SELECT * FROM documents WHERE id = ? FOR UPDATE",
        [documentId],
      );
      const r = (rows as Record<string, unknown>[])[0];
      if (!r) throw new HttpError(404, "Document introuvable", "DOCUMENT_NOT_FOUND");

      const canDelete =
        user.permissions.includes("admin.full") ||
        user.roles.includes("admin") ||
        user.roles.includes("manager") ||
        String(r.uploaded_by) === user.id ||
        user.permissions.includes("documents.write");
      if (!canDelete) {
        throw new HttpError(403, "Permission insuffisante pour supprimer ce document.", "FORBIDDEN");
      }

      await conn.execute("DELETE FROM documents WHERE id = ?", [documentId]);
      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, 'document.deleted', 'document', ?, ?, ?)`,
        [
          randomUUID(),
          user.id,
          documentId,
          JSON.stringify({ originalName: r.original_name }),
          ipAddress,
        ],
      );
      return String(r.storage_path);
    });
    await deletePrivateFile(storagePath);
    return { ok: true };
  }

  const c = await db().connect();
  let storagePath = "";
  try {
    await c.query("BEGIN");
    const res = await c.query("SELECT * FROM documents WHERE id = $1 FOR UPDATE", [documentId]);
    if (!res.rowCount) throw new HttpError(404, "Document introuvable", "DOCUMENT_NOT_FOUND");
    const r = res.rows[0];
    const canDelete =
      user.permissions.includes("admin.full") ||
      user.roles.includes("admin") ||
      user.roles.includes("technical_admin") ||
      String(r.uploaded_by) === user.id ||
      user.permissions.includes("documents.write");
    if (!canDelete) {
      throw new HttpError(403, "Permission insuffisante pour supprimer ce document.", "FORBIDDEN");
    }
    storagePath = String(r.storage_path);
    await c.query("DELETE FROM documents WHERE id = $1", [documentId]);
    await c.query(
      "INSERT INTO audit_event (actor_id, action, resource_id, details) VALUES ($1, $2, $3, $4)",
      [user.id, "document.deleted", documentId, JSON.stringify({ originalName: r.original_name })],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  await deletePrivateFile(storagePath);
  return { ok: true };
}
