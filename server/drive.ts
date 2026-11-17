import { db } from "./db";
import { HttpError } from "./auth";

export interface DriveItem {
  id: string;
  parentId: string | null;
  name: string;
  type: "folder" | "file";
  mimeType: string | null;
  size: number;
  data: string | null;
  starred: boolean;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  creatorName?: string;
  creatorEmail?: string;
  childCount?: number;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export interface DriveFolderTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  color: string | null;
  itemCount: number;
}

export interface DriveResponse {
  items: DriveItem[];
  currentFolder: DriveItem | null;
  breadcrumbs: BreadcrumbItem[];
  folderTree: DriveFolderTreeNode[];
  stats: {
    totalFiles: number;
    totalFolders: number;
    totalSizeBytes: number;
  };
}

export async function listDriveItems(options: {
  parentId?: string | null;
  search?: string;
  filter?: string;
  starredOnly?: boolean;
}): Promise<DriveResponse> {
  const pool = db();
  const { parentId, search, filter, starredOnly } = options;
  const targetParent = parentId && parentId !== "root" && parentId !== "null" ? parentId : null;

  // 1. Current folder details
  let currentFolder: DriveItem | null = null;
  if (targetParent) {
    const fRes = await pool.query(
      `SELECT d.*, u.name as creator_name, u.email as creator_email
       FROM drive_item d
       LEFT JOIN app_user u ON u.id = d.created_by
       WHERE d.id = $1 AND d.type = 'folder'`,
      [targetParent]
    );
    if (fRes.rows.length > 0) {
      const row = fRes.rows[0];
      currentFolder = {
        id: row.id,
        parentId: row.parent_id,
        name: row.name,
        type: row.type,
        mimeType: row.mime_type,
        size: Number(row.size || 0),
        data: null,
        starred: Boolean(row.starred),
        color: row.color,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        creatorName: row.creator_name || "Administrateur",
        creatorEmail: row.creator_email || "",
      };
    }
  }

  // 2. Breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = [{ id: null, name: "Mon Drive" }];
  if (currentFolder) {
    const trail: BreadcrumbItem[] = [{ id: currentFolder.id, name: currentFolder.name }];
    let currParentId = currentFolder.parentId;
    let depth = 0;
    while (currParentId && depth < 10) {
      const pRes = await pool.query(
        `SELECT id, name, parent_id FROM drive_item WHERE id = $1`,
        [currParentId]
      );
      if (pRes.rows.length === 0) break;
      const p = pRes.rows[0];
      trail.unshift({ id: p.id, name: p.name });
      currParentId = p.parent_id;
      depth++;
    }
    breadcrumbs.push(...trail);
  }

  // 3. Query items
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    conditions.push(`LOWER(d.name) LIKE $${params.length}`);
  } else if (starredOnly) {
    conditions.push(`d.starred = true`);
  } else {
    if (targetParent) {
      params.push(targetParent);
      conditions.push(`d.parent_id = $${params.length}`);
    } else {
      conditions.push(`d.parent_id IS NULL`);
    }
  }

  if (!search && !starredOnly) {
    if (filter === "folder") {
      conditions.push(`d.type = 'folder'`);
    } else if (filter === "document") {
      conditions.push(
        `(d.type = 'file' AND (d.mime_type LIKE '%pdf%' OR d.mime_type LIKE '%word%' OR d.name LIKE '%.doc%' OR d.name LIKE '%.pdf'))`
      );
    } else if (filter === "spreadsheet") {
      conditions.push(
        `(d.type = 'file' AND (d.mime_type LIKE '%sheet%' OR d.mime_type LIKE '%excel%' OR d.mime_type LIKE '%csv%' OR d.name LIKE '%.xls%' OR d.name LIKE '%.csv'))`
      );
    } else if (filter === "image") {
      conditions.push(
        `(d.type = 'file' AND (d.mime_type LIKE 'image/%' OR d.name LIKE '%.png' OR d.name LIKE '%.jpg' OR d.name LIKE '%.jpeg' OR d.name LIKE '%.webp' OR d.name LIKE '%.svg'))`
      );
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT d.id, d.parent_id, d.name, d.type, d.mime_type, d.size, d.data, d.starred, d.color,
           d.created_at, d.updated_at, d.created_by, u.name as creator_name, u.email as creator_email,
           (SELECT COUNT(*) FROM drive_item c WHERE c.parent_id = d.id) as child_count
    FROM drive_item d
    LEFT JOIN app_user u ON u.id = d.created_by
    ${whereClause}
    ORDER BY (CASE WHEN d.type = 'folder' THEN 0 ELSE 1 END), d.name ASC
  `;

  const itemsRes = await pool.query(sql, params);

  const items: DriveItem[] = itemsRes.rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    type: row.type,
    mimeType: row.mime_type,
    size: Number(row.size || 0),
    data: row.data,
    starred: Boolean(row.starred),
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    creatorName: row.creator_name || "Administrateur",
    creatorEmail: row.creator_email || "",
    childCount: Number(row.child_count || 0),
  }));

  // 4. Overall stats
  const statsRes = await pool.query(`
    SELECT
      COUNT(CASE WHEN type = 'file' THEN 1 END) as total_files,
      COUNT(CASE WHEN type = 'folder' THEN 1 END) as total_folders,
      COALESCE(SUM(CASE WHEN type = 'file' THEN size ELSE 0 END), 0) as total_size_bytes
    FROM drive_item
  `);

  // 5. Full folder tree for left sidebar navigation
  const treeRes = await pool.query(`
    SELECT d.id, d.name, d.parent_id, d.color,
           (SELECT COUNT(*) FROM drive_item c WHERE c.parent_id = d.id) as item_count
    FROM drive_item d
    WHERE d.type = 'folder'
    ORDER BY d.name ASC
  `);

  const folderTree: DriveFolderTreeNode[] = treeRes.rows.map((r) => ({
    id: r.id,
    name: r.name,
    parentId: r.parent_id,
    color: r.color,
    itemCount: Number(r.item_count || 0),
  }));

  return {
    items,
    currentFolder,
    breadcrumbs,
    folderTree,
    stats: {
      totalFiles: Number(statsRes.rows[0].total_files || 0),
      totalFolders: Number(statsRes.rows[0].total_folders || 0),
      totalSizeBytes: Number(statsRes.rows[0].total_size_bytes || 0),
    },
  };
}

export async function createFolder(params: {
  name: string;
  parentId?: string | null;
  color?: string | null;
  userId: string;
}): Promise<DriveItem> {
  const pool = db();
  const name = params.name.trim();
  if (!name) throw new HttpError(400, "Le nom du dossier est requis");

  const parentId = params.parentId && params.parentId !== "root" ? params.parentId : null;
  const color = params.color || "#475569";

  const existing = await pool.query(
    `SELECT id FROM drive_item WHERE parent_id IS NOT DISTINCT FROM $1 AND LOWER(name) = LOWER($2)`,
    [parentId, name]
  );
  if (existing.rows.length > 0) {
    throw new HttpError(409, "Un élément portant ce nom existe déjà dans ce dossier");
  }

  const res = await pool.query(
    `INSERT INTO drive_item (name, type, parent_id, color, created_by)
     VALUES ($1, 'folder', $2, $3, $4)
     RETURNING *`,
    [name, parentId, color, params.userId]
  );

  return {
    id: res.rows[0].id,
    parentId: res.rows[0].parent_id,
    name: res.rows[0].name,
    type: "folder",
    mimeType: null,
    size: 0,
    data: null,
    starred: false,
    color: res.rows[0].color,
    createdAt: res.rows[0].created_at,
    updatedAt: res.rows[0].updated_at,
    createdBy: res.rows[0].created_by,
    childCount: 0,
  };
}

export async function createFile(params: {
  name: string;
  parentId?: string | null;
  mimeType?: string;
  size: number;
  data: string;
  userId: string;
}): Promise<DriveItem> {
  const pool = db();
  let name = params.name.trim();
  if (!name) throw new HttpError(400, "Le nom du fichier est requis");

  const parentId = params.parentId && params.parentId !== "root" ? params.parentId : null;

  const existing = await pool.query(
    `SELECT id FROM drive_item WHERE parent_id IS NOT DISTINCT FROM $1 AND LOWER(name) = LOWER($2)`,
    [parentId, name]
  );
  if (existing.rows.length > 0) {
    const extMatch = name.match(/(\.[^.]+)$/);
    const ext = extMatch ? extMatch[1] : "";
    const base = ext ? name.slice(0, -ext.length) : name;
    name = `${base} (${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/:/g, "-")})${ext}`;
  }

  const res = await pool.query(
    `INSERT INTO drive_item (name, type, parent_id, mime_type, size, data, created_by)
     VALUES ($1, 'file', $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, parentId, params.mimeType || "application/octet-stream", params.size, params.data, params.userId]
  );

  return {
    id: res.rows[0].id,
    parentId: res.rows[0].parent_id,
    name: res.rows[0].name,
    type: "file",
    mimeType: res.rows[0].mime_type,
    size: Number(res.rows[0].size || 0),
    data: res.rows[0].data,
    starred: false,
    color: null,
    createdAt: res.rows[0].created_at,
    updatedAt: res.rows[0].updated_at,
    createdBy: res.rows[0].created_by,
    childCount: 0,
  };
}

export async function updateDriveItem(
  id: string,
  updates: {
    name?: string;
    parentId?: string | null;
    starred?: boolean;
    color?: string | null;
  },
  userId: string
): Promise<DriveItem> {
  const pool = db();
  const current = (await pool.query(`SELECT * FROM drive_item WHERE id = $1`, [id])).rows[0];
  if (!current) throw new HttpError(404, "Élément introuvable");

  const newName = updates.name !== undefined ? updates.name.trim() : current.name;
  if (!newName) throw new HttpError(400, "Le nom ne peut pas être vide");

  const newParentId =
    updates.parentId !== undefined
      ? updates.parentId === "root" || updates.parentId === null
        ? null
        : updates.parentId
      : current.parent_id;

  if (current.type === "folder" && newParentId) {
    if (newParentId === id) {
      throw new HttpError(400, "Impossible de déplacer un dossier à l'intérieur de lui-même");
    }
    let check = newParentId;
    let depth = 0;
    while (check && depth < 20) {
      const p = (await pool.query(`SELECT parent_id FROM drive_item WHERE id = $1`, [check])).rows[0];
      if (!p) break;
      if (p.parent_id === id) {
        throw new HttpError(400, "Impossible de déplacer un dossier dans un de ses sous-dossiers");
      }
      check = p.parent_id;
      depth++;
    }
  }

  const newStarred = updates.starred !== undefined ? updates.starred : current.starred;
  const newColor = updates.color !== undefined ? updates.color : current.color;

  const res = await pool.query(
    `UPDATE drive_item
     SET name = $1, parent_id = $2, starred = $3, color = $4, updated_at = now()
     WHERE id = $5
     RETURNING *`,
    [newName, newParentId, newStarred, newColor, id]
  );

  return {
    id: res.rows[0].id,
    parentId: res.rows[0].parent_id,
    name: res.rows[0].name,
    type: res.rows[0].type,
    mimeType: res.rows[0].mime_type,
    size: Number(res.rows[0].size || 0),
    data: res.rows[0].data,
    starred: Boolean(res.rows[0].starred),
    color: res.rows[0].color,
    createdAt: res.rows[0].created_at,
    updatedAt: res.rows[0].updated_at,
    createdBy: res.rows[0].created_by,
  };
}

export async function deleteDriveItem(id: string, userId: string): Promise<{ ok: boolean }> {
  const pool = db();
  const item = (await pool.query(`SELECT id, name, type FROM drive_item WHERE id = $1`, [id])).rows[0];
  if (!item) throw new HttpError(404, "Élément introuvable");

  await pool.query(`DELETE FROM drive_item WHERE id = $1`, [id]);
  return { ok: true };
}

export async function getFolderTree(): Promise<DriveFolderTreeNode[]> {
  const pool = db();
  const res = await pool.query(
    `SELECT d.id, d.name, d.parent_id, d.color,
            (SELECT COUNT(*) FROM drive_item c WHERE c.parent_id = d.id) as item_count
     FROM drive_item d
     WHERE d.type = 'folder'
     ORDER BY d.name ASC`
  );
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    parentId: r.parent_id,
    color: r.color,
    itemCount: Number(r.item_count || 0),
  }));
}
