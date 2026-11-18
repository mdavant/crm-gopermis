"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  File,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Download,
  Trash2,
  Edit3,
  Move,
  Star,
  Search,
  Grid,
  List,
  UploadCloud,
  Home,
  MoreVertical,
  X,
  HardDrive,
  RefreshCw,
  Check,
  Plus,
  ChevronDown,
} from "lucide-react";
import {
  api,
  type DriveItem,
  type BreadcrumbItem,
  type DriveFolderTreeNode,
  type DriveResponse,
} from "../lib/api-types";
import { useApp } from "./app-context";

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 Ko";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Octets", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function getFileMeta(item: DriveItem) {
  const mime = item.mimeType?.toLowerCase() || "";
  const name = item.name.toLowerCase();

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    return {
      type: "pdf",
      label: "PDF",
      bg: "#fee2e2",
      color: "#dc2626",
      icon: FileText,
    };
  }
  if (
    mime.includes("word") ||
    mime.includes("document") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  ) {
    return {
      type: "word",
      label: "Word",
      bg: "#eff6ff",
      color: "#2563eb",
      icon: FileText,
    };
  }
  if (
    mime.includes("sheet") ||
    mime.includes("excel") ||
    mime.includes("csv") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".csv")
  ) {
    return {
      type: "excel",
      label: "Excel",
      bg: "#ecfdf5",
      color: "#059669",
      icon: FileSpreadsheet,
    };
  }
  if (
    mime.startsWith("image/") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp") ||
    name.endsWith(".svg")
  ) {
    return {
      type: "image",
      label: "Image",
      bg: "#f8fafc",
      color: "#475569",
      icon: ImageIcon,
    };
  }
  return {
    type: "other",
    label: "Fichier",
    bg: "#f1f5f9",
    color: "#64748b",
    icon: File,
  };
}

// Strict palette: Noir, Gris, Blanc, Bleu Électrique
const FOLDER_COLORS = [
  { label: "Gris Anthracite", value: "#475569" },
  { label: "Gris Ardoise Foncé", value: "#334155" },
  { label: "Bleu Électrique", value: "#2563eb" },
  { label: "Bleu Nuit", value: "#1e3a8a" },
  { label: "Noir Graphite", value: "#18181b" },
  { label: "Gris Acier", value: "#64748b" },
];

/**
 * BigFolderGraphic: Faithfully reproduces the large grey folder with documents peeking out
 * and app badges on the front flap from image_2a30fcab.png
 */
function BigFolderGraphic({
  isDark,
  color = "#475569",
}: {
  isDark: boolean;
  color?: string | null;
}) {
  const folderDarkSlate = isDark ? "#334155" : "#475569";
  const folderFlapSlate = isDark ? "#3b4758" : "#525f73";

  return (
    <div
      style={{
        position: "relative",
        width: "148px",
        height: "105px",
        margin: "8px auto 14px",
        userSelect: "none",
      }}
    >
      {/* Back tab */}
      <div
        style={{
          position: "absolute",
          top: "6px",
          left: "10px",
          width: "55px",
          height: "22px",
          background: color || folderDarkSlate,
          borderRadius: "8px 8px 0 0",
        }}
      />

      {/* Staggered papers sticking out of top pocket */}
      {/* Sheet 1 (left tilted) */}
      <div
        style={{
          position: "absolute",
          top: "1px",
          left: "22px",
          width: "68px",
          height: "52px",
          background: "#ffffff",
          borderRadius: "5px",
          boxShadow: "0 2px 5px rgba(0,0,0,0.18)",
          transform: "rotate(-6deg)",
          border: "1px solid rgba(0,0,0,0.08)",
          padding: "5px 6px",
          display: "flex",
          flexDirection: "column",
          gap: "3px",
        }}
      >
        <div style={{ width: "32px", height: "3px", background: "#cbd5e1", borderRadius: "2px" }} />
        <div style={{ width: "45px", height: "2.5px", background: "#e2e8f0", borderRadius: "2px" }} />
        <div style={{ width: "24px", height: "2.5px", background: "#e2e8f0", borderRadius: "2px" }} />
      </div>

      {/* Sheet 2 (right tilted with PDF badge) */}
      <div
        style={{
          position: "absolute",
          top: "4px",
          left: "58px",
          width: "68px",
          height: "50px",
          background: "#ffffff",
          borderRadius: "5px",
          boxShadow: "0 3px 8px rgba(0,0,0,0.2)",
          transform: "rotate(4deg)",
          border: "1px solid rgba(0,0,0,0.08)",
          padding: "5px 6px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <span
            style={{
              fontSize: "6.5px",
              fontWeight: 900,
              background: "#0f172a",
              color: "#ffffff",
              padding: "1px 3px",
              borderRadius: "2px",
              letterSpacing: "0.04em",
            }}
          >
            PDF
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ width: "36px", height: "2.5px", background: "#cbd5e1", borderRadius: "2px" }} />
          <div style={{ width: "26px", height: "2.5px", background: "#e2e8f0", borderRadius: "2px" }} />
        </div>
      </div>

      {/* Front folder pocket / flap */}
      <div
        style={{
          position: "absolute",
          bottom: "0px",
          left: "4px",
          right: "4px",
          height: "76px",
          background: folderFlapSlate,
          borderRadius: "14px",
          boxShadow: isDark
            ? "0 8px 18px rgba(0,0,0,0.4)"
            : "0 8px 18px rgba(15,23,42,0.22)",
          padding: "10px 12px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          borderTop: "1px solid rgba(255,255,255,0.22)",
        }}
      >
        {/* Front badges matching Image 2 (Google Drive / Notion / Slack style badges) */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <div
            style={{
              width: "17px",
              height: "17px",
              borderRadius: "50%",
              background: "var(--acc)",
              display: "grid",
              placeItems: "center",
              color: "#ffffff",
              fontSize: "8px",
              fontWeight: 800,
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}
            title="Drive"
          >
            ▲
          </div>
          <div
            style={{
              width: "17px",
              height: "17px",
              borderRadius: "4px",
              background: "#0f172a",
              display: "grid",
              placeItems: "center",
              color: "#ffffff",
              fontSize: "8.5px",
              fontWeight: 900,
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}
            title="Docs"
          >
            N
          </div>
          <div
            style={{
              width: "17px",
              height: "17px",
              borderRadius: "50%",
              background: "#10b981",
              display: "grid",
              placeItems: "center",
              color: "#ffffff",
              fontSize: "7.5px",
              fontWeight: 800,
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}
            title="Sheets"
          >
            ✓
          </div>
        </div>
      </div>
    </div>
  );
}

export function DriveView() {
  const { theme } = useApp();
  const isDark = theme === "dark";
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<DriveItem | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: "Mon Drive" },
  ]);
  const [folderTree, setFolderTree] = useState<DriveFolderTreeNode[]>([]);
  const [stats, setStats] = useState({ totalFiles: 0, totalFolders: 0, totalSizeBytes: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [treeSearch, setTreeSearch] = useState("");
  const [treeTab, setTreeTab] = useState<"folders" | "starred">("folders");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals & Actions
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#475569");

  const [renameItem, setRenameItem] = useState<DriveItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [moveItem, setMoveItem] = useState<DriveItem | null>(null);
  const [moveTargetParentId, setMoveTargetParentId] = useState<string | null>(null);

  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Drag & drop and upload state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState("");

  const loadDrive = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams();
      if (currentFolderId) sp.set("parentId", currentFolderId);
      if (search.trim()) sp.set("q", search.trim());
      if (filterType !== "all" && filterType !== "starred") sp.set("filter", filterType);
      if (filterType === "starred" || treeTab === "starred") sp.set("starred", "true");

      const res = await api<DriveResponse>(`drive/items?${sp.toString()}`);
      setItems(res.items);
      setCurrentFolder(res.currentFolder);
      setBreadcrumbs(res.breadcrumbs);
      setFolderTree(res.folderTree || []);
      setStats(res.stats);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, search, filterType, treeTab]);

  useEffect(() => {
    loadDrive();
  }, [loadDrive]);

  const handleToggleStar = async (item: DriveItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api("drive/update", {
        id: item.id,
        updates: { starred: !item.starred },
      });
      await loadDrive();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api("drive/folder", {
        name: newFolderName.trim(),
        parentId: currentFolderId,
        color: newFolderColor,
      });
      setNewFolderName("");
      setCreateFolderOpen(false);
      await loadDrive();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameItem || !renameValue.trim()) return;
    try {
      await api("drive/update", {
        id: renameItem.id,
        updates: { name: renameValue.trim() },
      });
      setRenameItem(null);
      await loadDrive();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveItem) return;
    try {
      await api("drive/update", {
        id: moveItem.id,
        updates: { parentId: moveTargetParentId },
      });
      setMoveItem(null);
      await loadDrive();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (item: DriveItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isFolder = item.type === "folder";
    const msg = isFolder
      ? `Supprimer définitivement le dossier "${item.name}" et tout son contenu ?`
      : `Supprimer définitivement le fichier "${item.name}" ?`;
    if (!window.confirm(msg)) return;

    try {
      await api("drive/delete", { id: item.id });
      await loadDrive();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const processFiles = async (filesToUpload: FileList | File[]) => {
    if (!filesToUpload || filesToUpload.length === 0) return;
    setUploading(true);
    setUploadProgressMsg(`Importation de ${filesToUpload.length} élément(s)…`);
    setError("");

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        setUploadProgressMsg(`Envoi de ${file.name} (${i + 1}/${filesToUpload.length})…`);

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await api("drive/file", {
          name: file.name,
          parentId: currentFolderId,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          data: dataUrl,
        });
      }
      await loadDrive();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      setUploadProgressMsg("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDownload = (item: DriveItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!item.data) {
      alert("Le contenu de ce fichier n'est pas disponible.");
      return;
    }
    const a = document.createElement("a");
    a.href = item.data;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const folders = items.filter((it) => it.type === "folder");
  const files = items.filter((it) => it.type === "file");

  const c = {
    surface: isDark ? "#0b101b" : "transparent",
    cardBg: isDark ? "#111827" : "rgba(255, 255, 255, 0.42)",
    subtleBg: isDark ? "#1e293b" : "rgba(255, 255, 255, 0.5)",
    inputBg: isDark ? "#131d31" : "rgba(255, 255, 255, 0.6)",
    border: isDark ? "#1e293b" : "rgba(255, 255, 255, 0.8)",
    borderInput: isDark ? "#334155" : "rgba(255, 255, 255, 0.9)",
    textHeading: isDark ? "#f8fafc" : "var(--ink)",
    textBody: isDark ? "#cbd5e1" : "var(--ink-2)",
    textMuted: isDark ? "#94a3b8" : "var(--ink-3)",
    hoverBg: isDark ? "#1e293b" : "rgba(255, 255, 255, 0.6)",
    activeTreeBg: isDark ? "#1e293b" : "var(--acc-soft)",
    branchLine: isDark ? "#334155" : "rgba(120, 60, 45, 0.18)",
  };

  // Build recursive tree structure with branch connecting lines (Image 2 style)
  const buildTree = (parentId: string | null = null, depth = 0): React.ReactNode[] => {
    let directChildren = folderTree.filter((f) => f.parentId === parentId);
    if (treeSearch.trim()) {
      directChildren = directChildren.filter((f) =>
        f.name.toLowerCase().includes(treeSearch.trim().toLowerCase())
      );
    }
    if (directChildren.length === 0) return [];

    return directChildren.map((f, index) => {
      const isSelected = currentFolderId === f.id;
      const subNodes = buildTree(f.id, depth + 1);
      const isLastChild = index === directChildren.length - 1;

      return (
        <div key={f.id} style={{ display: "flex", flexDirection: "column", position: "relative" }}>
          {/* Vertical connecting line for hierarchy depth */}
          {depth > 0 && (
            <div
              style={{
                position: "absolute",
                left: `${10 + (depth - 1) * 16}px`,
                top: 0,
                bottom: isLastChild ? "50%" : 0,
                width: "1.5px",
                background: c.branchLine,
              }}
            />
          )}

          {/* Horizontal branch elbow line connecting to the item */}
          {depth > 0 && (
            <div
              style={{
                position: "absolute",
                left: `${10 + (depth - 1) * 16}px`,
                top: "50%",
                width: "12px",
                height: "1px",
                background: c.branchLine,
              }}
            />
          )}

          <button
            type="button"
            onClick={() => {
              setCurrentFolderId(f.id);
              setSearch("");
            }}
            style={{
              padding: `7px 8px 7px ${12 + depth * 16}px`,
              borderRadius: "8px",
              border: "none",
              background: isSelected ? c.activeTreeBg : "transparent",
              color: isSelected ? (isDark ? "#ffffff" : "var(--acc)") : c.textBody,
              fontSize: "12.5px",
              fontWeight: isSelected ? 700 : 500,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              textAlign: "left",
              cursor: "pointer",
              transition: "all 0.12s ease",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.background = c.hoverBg;
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.background = "transparent";
            }}
          >
            {/* Open icon when selected/opened, normal folder when closed */}
            {isSelected ? (
              <FolderOpen
                size={15}
                style={{
                  color: isDark ? "#ffffff" : "var(--acc)",
                  flexShrink: 0,
                }}
              />
            ) : (
              <Folder
                size={15}
                style={{
                  color: isDark ? "#94a3b8" : "#64748b",
                  flexShrink: 0,
                }}
              />
            )}

            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: 1,
              }}
            >
              {f.name}
            </span>

            {/* Item count badge on the right (matching Image 2) */}
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: isSelected ? (isDark ? "#ffffff" : "var(--acc)") : c.textMuted,
                background: isSelected
                  ? (isDark ? "rgba(255,255,255,0.12)" : "var(--acc-line)")
                  : c.subtleBg,
                padding: "1px 6px",
                borderRadius: "10px",
                flexShrink: 0,
              }}
            >
              {f.itemCount ?? 0}
            </span>
          </button>

          {/* Nested sub-tree */}
          {subNodes.length > 0 && (
            <div style={{ position: "relative" }}>
              {subNodes}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "18px",
        minHeight: "calc(100vh - 120px)",
        position: "relative",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        style={{ display: "none" }}
      />

      {/* Drag & drop overlay indicator */}
      {isDraggingOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: isDark ? "#1e293b" : "#ffffff",
              padding: "36px 50px",
              borderRadius: "20px",
              textAlign: "center",
              boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
              border: "2px dashed var(--acc)",
            }}
          >
            <UploadCloud size={48} style={{ color: "var(--acc)", margin: "0 auto 12px" }} />
            <h3 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 4px", color: c.textHeading }}>
              Déposez vos fichiers ici
            </h3>
            <p style={{ margin: 0, color: c.textMuted, fontSize: "13px" }}>
              Importation directe dans {currentFolder ? `"${currentFolder.name}"` : "Mon Drive"}.
            </p>
          </div>
        </div>
      )}

      {/* LEFT COLUMN: KNOWLEDGE BASE TREE (Directly from Image 2) */}
      <aside
        className="driveSidebar"
        style={{
          width: "260px",
          flexShrink: 0,
          background: c.surface,
          borderRadius: "16px",
          border: `1px solid ${c.border}`,
          display: "flex",
          flexDirection: "column",
          padding: "16px 14px",
          boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        {/* En-tête : Documents + ajout */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 4px 12px",
            borderBottom: `1px solid ${c.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <HardDrive size={16} style={{ color: isDark ? "#cbd5e1" : "#0f172a" }} />
            <strong style={{ fontSize: "14px", fontWeight: 700, color: c.textHeading }}>
              Documents
            </strong>
          </div>

          <button
            type="button"
            onClick={() => setCreateFolderOpen(true)}
            title="Créer un nouveau dossier"
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "7px",
              border: `1px solid ${c.borderInput}`,
              background: c.inputBg,
              color: c.textBody,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Tree Search */}
        <div style={{ position: "relative", margin: "12px 0 10px" }}>
          <Search
            size={13}
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: c.textMuted,
            }}
          />
          <input
            type="search"
            placeholder="Rechercher un dossier…"
            value={treeSearch}
            onChange={(e) => setTreeSearch(e.target.value)}
            style={{
              width: "100%",
              height: "32px",
              paddingLeft: "30px",
              paddingRight: "8px",
              borderRadius: "8px",
              border: `1px solid ${c.borderInput}`,
              background: c.inputBg,
              color: c.textHeading,
              fontSize: "12px",
              outline: "none",
            }}
          />
        </div>

        {/* Onglets : Dossiers / Favoris (Segmented button matching Image 2) */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            background: c.subtleBg,
            padding: "3px",
            borderRadius: "10px",
            marginBottom: "14px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTreeTab("folders");
              setFilterType("all");
            }}
            style={{
              flex: 1,
              height: "28px",
              borderRadius: "7px",
              border: "none",
              fontSize: "12px",
              fontWeight: 650,
              background: treeTab === "folders" ? (isDark ? "#334155" : "#ffffff") : "transparent",
              color: treeTab === "folders" ? c.textHeading : c.textMuted,
              boxShadow: treeTab === "folders" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
            }}
          >
            Dossiers
          </button>
          <button
            type="button"
            onClick={() => {
              setTreeTab("starred");
              setFilterType("starred");
            }}
            style={{
              flex: 1,
              height: "28px",
              borderRadius: "7px",
              border: "none",
              fontSize: "12px",
              fontWeight: 650,
              background: treeTab === "starred" ? (isDark ? "#334155" : "#ffffff") : "transparent",
              color: treeTab === "starred" ? c.textHeading : c.textMuted,
              boxShadow: treeTab === "starred" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
            }}
          >
            <Star size={11} fill={treeTab === "starred" ? "var(--acc)" : "none"} style={{ color: "var(--acc)" }} />
            Favoris
          </button>
        </div>

        {/* Tree List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {/* Root button */}
          <button
            type="button"
            onClick={() => {
              setCurrentFolderId(null);
              setSearch("");
            }}
            style={{
              padding: "7px 9px",
              borderRadius: "8px",
              border: "none",
              background: currentFolderId === null && treeTab === "folders" ? c.activeTreeBg : "transparent",
              color: currentFolderId === null && treeTab === "folders" ? (isDark ? "#ffffff" : "var(--acc)") : c.textBody,
              fontSize: "12.5px",
              fontWeight: currentFolderId === null && treeTab === "folders" ? 700 : 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              textAlign: "left",
              cursor: "pointer",
              transition: "all 0.12s ease",
            }}
          >
            {currentFolderId === null ? (
              <FolderOpen size={15} style={{ color: isDark ? "#ffffff" : "var(--acc)" }} />
            ) : (
              <Home size={15} style={{ color: isDark ? "#94a3b8" : "#64748b" }} />
            )}
            <span style={{ flex: 1 }}>Tous les documents</span>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: c.textMuted,
                background: c.subtleBg,
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {stats.totalFolders}
            </span>
          </button>

          {/* Subtree with connecting branch lines */}
          {folderTree.length === 0 ? (
            <div style={{ padding: "16px 8px", fontSize: "11.5px", color: c.textMuted, textAlign: "center" }}>
              Aucun sous-dossier
            </div>
          ) : (
            <div style={{ marginTop: "4px" }}>
              {buildTree(null)}
            </div>
          )}
        </div>

        {/* Compact Storage bar */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: "12px",
            borderTop: `1px solid ${c.border}`,
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: c.textMuted, fontWeight: 600 }}>
            <span>Stockage Drive</span>
            <strong>{formatBytes(stats.totalSizeBytes)}</strong>
          </div>
          <div
            style={{
              height: "4px",
              background: c.subtleBg,
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: Math.min(100, Math.max(4, stats.totalFiles * 6)) + "%",
                background: "var(--acc)",
                borderRadius: "4px",
              }}
            />
          </div>
          <span style={{ fontSize: "10.5px", color: c.textMuted }}>
            {stats.totalFiles} fichier(s) · {stats.totalFolders} dossier(s)
          </span>
        </div>
      </aside>

      {/* RIGHT MAIN AREA: BREADCRUMB, LARGE FOLDER CARDS, FILES TABLE */}
      <main
        className="driveMainArea"
        style={{
          flex: 1,
          minWidth: 0,
          background: c.surface,
          borderRadius: "16px",
          border: `1px solid ${c.border}`,
          display: "flex",
          flexDirection: "column",
          padding: "18px 24px",
          boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.03)",
          overflowY: "auto",
        }}
      >
        {/* COMPACT TOP TOOLBAR: Breadcrumb with ChevronDown + Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            paddingBottom: "14px",
            borderBottom: `1px solid ${c.border}`,
          }}
        >
          {/* Breadcrumb path / Current Folder Title with ▾ */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
            <button
              type="button"
              onClick={() => {
                setCurrentFolderId(null);
                setSearch("");
              }}
              style={{
                background: "transparent",
                border: "none",
                color: c.textHeading,
                fontSize: "17px",
                fontWeight: 800,
                padding: "2px 6px",
                borderRadius: "6px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>{currentFolder ? currentFolder.name : "Tous les documents"}</span>
              <ChevronDown size={16} style={{ color: c.textMuted }} />
            </button>

            {breadcrumbs.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "4px" }}>
                <span style={{ color: c.textMuted, fontSize: "13px" }}>/</span>
                <span style={{ fontSize: "12px", color: c.textMuted }}>
                  {breadcrumbs[breadcrumbs.length - 1].name}
                </span>
              </div>
            )}
          </div>

          {/* Action Tools: Search, Filter, Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {/* Search Input */}
            <div style={{ position: "relative", width: "180px" }}>
              <Search
                size={13}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50)",
                  color: c.textMuted,
                }}
              />
              <input
                type="search"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  height: "34px",
                  paddingLeft: "30px",
                  paddingRight: "8px",
                  borderRadius: "9px",
                  border: `1px solid ${c.borderInput}`,
                  background: c.inputBg,
                  color: c.textHeading,
                  fontSize: "12px",
                  outline: "none",
                }}
              />
            </div>

            {/* Filter by Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                height: "34px",
                padding: "0 10px",
                borderRadius: "9px",
                border: `1px solid ${c.borderInput}`,
                background: c.inputBg,
                fontSize: "12px",
                color: c.textBody,
                fontWeight: 600,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="all">Tous les fichiers</option>
              <option value="document">PDF & Word</option>
              <option value="spreadsheet">Excel & Tableurs</option>
              <option value="image">Images</option>
              <option value="starred">Favoris ★</option>
            </select>

            {/* View Mode Toggle */}
            <div
              style={{
                display: "flex",
                background: c.subtleBg,
                padding: "2px",
                borderRadius: "8px",
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="Vue Liste"
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  border: "none",
                  background: viewMode === "list" ? (isDark ? "#334155" : "#ffffff") : "transparent",
                  color: viewMode === "list" ? c.textHeading : c.textMuted,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  boxShadow: viewMode === "list" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <List size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Vue Grille"
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  border: "none",
                  background: viewMode === "grid" ? (isDark ? "#334155" : "#ffffff") : "transparent",
                  color: viewMode === "grid" ? c.textHeading : c.textMuted,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  boxShadow: viewMode === "grid" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <Grid size={14} />
              </button>
            </div>

            {/* New Folder Button */}
            <button
              type="button"
              onClick={() => setCreateFolderOpen(true)}
              style={{
                height: "34px",
                padding: "0 12px",
                borderRadius: "9px",
                border: `1px solid ${c.borderInput}`,
                background: c.inputBg,
                color: c.textBody,
                fontSize: "12px",
                fontWeight: 650,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
              }}
            >
              <FolderPlus size={14} style={{ color: "var(--acc)" }} />
              <span>Nouveau dossier</span>
            </button>

            {/* Upload Files Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                height: "34px",
                padding: "0 14px",
                borderRadius: "9px",
                border: "none",
                background: "var(--acc)",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 650,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(37,99,235,0.3)",
              }}
            >
              <UploadCloud size={14} />
              <span>{uploading ? uploadProgressMsg || "Importation…" : "Importer"}</span>
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              margin: "12px 0 0",
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: "10px",
              padding: "10px 14px",
              fontSize: "12.5px",
              color: "#991b1b",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              style={{ background: "transparent", border: "none", color: "#991b1b", cursor: "pointer", fontWeight: 700 }}
            >
              ×
            </button>
          </div>
        )}

        {/* MAIN BODY: FOLDERS (Big grey cards) + FILES TABLE */}
        <div style={{ marginTop: "16px", flex: 1 }}>
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <RefreshCw size={22} className="animate-spin" style={{ color: "var(--acc)", margin: "0 auto 8px" }} />
              <p style={{ color: "#64748b", fontSize: "13px", fontWeight: 600 }}>Chargement…</p>
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                padding: "48px 20px",
                textAlign: "center",
                border: `2px dashed ${isDark ? "#334155" : "#e2e8f0"}`,
                borderRadius: "14px",
                background: isDark ? "#111827" : "rgba(255, 255, 255, 0.35)",
                marginTop: "10px",
              }}
            >
              <FolderOpen size={40} style={{ color: isDark ? "#475569" : "#cbd5e1", margin: "0 auto 12px" }} />
              <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: c.textHeading }}>
                {search || filterType !== "all" ? "Aucun élément correspondant" : "Ce dossier est vide"}
              </h4>
              <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: c.textMuted }}>
                {search || filterType !== "all"
                  ? "Ajustez vos filtres de recherche."
                  : "Glissez-déposez des fichiers ici ou utilisez les boutons ci-dessus pour ajouter des documents."}
              </p>
              <div style={{ display: "inline-flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setCreateFolderOpen(true)}
                  style={{
                    height: "32px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: `1px solid ${c.borderInput}`,
                    background: c.inputBg,
                    color: c.textBody,
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <FolderPlus size={13} />
                  Créer un sous-dossier
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    height: "32px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--acc)",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <UploadCloud size={13} />
                  Importer un fichier
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              {/* SECTION: FOLDERS (Big grey cards matching Image 2) */}
              {folders.length > 0 && (
                <div>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: 800,
                      color: c.textHeading,
                      margin: "0 0 14px",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Dossiers
                  </h3>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: "16px",
                    }}
                  >
                    {folders.map((folder) => {
                      return (
                        <div
                          key={folder.id}
                          className="driveFolderCard"
                          onClick={() => {
                            setCurrentFolderId(folder.id);
                            setSearch("");
                          }}
                          style={{
                            background: c.cardBg,
                            border: `1px solid ${c.border}`,
                            borderRadius: "18px",
                            padding: "16px",
                            cursor: "pointer",
                            transition: "all 0.18s ease",
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            boxShadow: isDark ? "0 2px 5px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.03)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = c.hoverBg;
                            e.currentTarget.style.borderColor = isDark ? "#475569" : "#cbd5e1";
                            e.currentTarget.style.boxShadow = isDark
                              ? "0 8px 20px rgba(0,0,0,0.4)"
                              : "0 8px 20px rgba(15,23,42,0.08)";
                            e.currentTarget.style.transform = "translateY(-2px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = c.cardBg;
                            e.currentTarget.style.borderColor = c.border;
                            e.currentTarget.style.boxShadow = isDark ? "0 2px 5px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.03)";
                            e.currentTarget.style.transform = "translateY(0)";
                          }}
                        >
                          {/* Top options overlay */}
                          <div
                            style={{
                              position: "absolute",
                              top: "10px",
                              right: "10px",
                              display: "flex",
                              gap: "2px",
                              zIndex: 10,
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleToggleStar(folder, e)}
                              title={folder.starred ? "Retirer des favoris" : "Ajouter aux favoris"}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: folder.starred ? "var(--acc)" : (isDark ? "#475569" : "#cbd5e1"),
                                cursor: "pointer",
                                padding: "2px",
                              }}
                            >
                              <Star size={13} fill={folder.starred ? "var(--acc)" : "none"} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === folder.id ? null : folder.id);
                              }}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: c.textMuted,
                                cursor: "pointer",
                                padding: "2px",
                              }}
                            >
                              <MoreVertical size={14} />
                            </button>
                          </div>

                          {/* Big Stylized Grey Folder Graphic with papers peeking out */}
                          <BigFolderGraphic isDark={isDark} color={folder.color} />

                          {/* Name & Count directly below graphic */}
                          <div style={{ textAlign: "center", marginTop: "4px" }}>
                            <strong
                              style={{
                                display: "block",
                                fontSize: "14px",
                                color: c.textHeading,
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={folder.name}
                            >
                              {folder.name}
                            </strong>
                            <span style={{ fontSize: "11.5px", color: c.textMuted, marginTop: "2px", display: "block" }}>
                              {folder.childCount ?? 0} Files
                            </span>
                          </div>

                          {/* Context menu */}
                          {activeMenuId === folder.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: "absolute",
                                top: "34px",
                                right: "8px",
                                background: c.surface,
                                border: `1px solid ${c.border}`,
                                borderRadius: "10px",
                                boxShadow: isDark ? "0 8px 20px rgba(0,0,0,0.5)" : "0 8px 20px rgba(0,0,0,0.12)",
                                zIndex: 60,
                                minWidth: "150px",
                                padding: "4px",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentFolderId(folder.id);
                                  setActiveMenuId(null);
                                }}
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  textAlign: "left",
                                  fontSize: "12px",
                                  background: "transparent",
                                  border: "none",
                                  borderRadius: "6px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  color: c.textBody,
                                  cursor: "pointer",
                                }}
                              >
                                <FolderOpen size={13} />
                                Ouvrir
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRenameItem(folder);
                                  setRenameValue(folder.name);
                                  setActiveMenuId(null);
                                }}
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  textAlign: "left",
                                  fontSize: "12px",
                                  background: "transparent",
                                  border: "none",
                                  borderRadius: "6px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  color: c.textBody,
                                  cursor: "pointer",
                                }}
                              >
                                <Edit3 size={13} />
                                Renommer
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMoveItem(folder);
                                  setMoveTargetParentId(folder.parentId);
                                  setActiveMenuId(null);
                                }}
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  textAlign: "left",
                                  fontSize: "12px",
                                  background: "transparent",
                                  border: "none",
                                  borderRadius: "6px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  color: c.textBody,
                                  cursor: "pointer",
                                }}
                              >
                                <Move size={13} />
                                Déplacer vers…
                              </button>
                              <div style={{ height: "1px", background: c.border, margin: "3px 0" }} />
                              <button
                                type="button"
                                onClick={() => {
                                  handleDelete(folder);
                                  setActiveMenuId(null);
                                }}
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  textAlign: "left",
                                  fontSize: "12px",
                                  background: "transparent",
                                  border: "none",
                                  borderRadius: "6px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  color: "#dc2626",
                                  cursor: "pointer",
                                }}
                              >
                                <Trash2 size={13} />
                                Supprimer
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION: FILES (Clean table matching Image 2 with Name, Added By, Date, Size) */}
              {files.length > 0 && (
                <div>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: 800,
                      color: c.textHeading,
                      margin: "0 0 14px",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Files
                  </h3>

                  {viewMode === "list" ? (
                    <div
                      style={{
                        background: c.surface,
                        border: `1px solid ${c.border}`,
                        borderRadius: "14px",
                        overflow: "hidden",
                      }}
                    >
                      {/* Header row */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "36px 3fr 2.2fr 1.3fr 1fr 80px",
                          alignItems: "center",
                          padding: "10px 16px",
                          background: c.cardBg,
                          borderBottom: `1px solid ${c.border}`,
                          fontSize: "11px",
                          fontWeight: 700,
                          color: c.textMuted,
                          letterSpacing: "0.02em",
                        }}
                      >
                        <div style={{ display: "grid", placeItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.size > 0 && selectedIds.size === files.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(new Set(files.map((f) => f.id)));
                              } else {
                                setSelectedIds(new Set());
                              }
                            }}
                            style={{ cursor: "pointer", accentColor: "var(--acc)" }}
                          />
                        </div>
                        <span>Name</span>
                        <span>Added By</span>
                        <span>Date added</span>
                        <span>Size</span>
                        <span style={{ textAlign: "right" }}>Actions</span>
                      </div>

                      {/* File rows */}
                      {files.map((file) => {
                        const meta = getFileMeta(file);
                        const creator = file.creatorName || "Administrateur";
                        const creatorEmail = file.creatorEmail || `${creator.toLowerCase().replace(/\s+/g, "")}@gopermis.fr`;
                        const creatorInitial = creator.slice(0, 1).toUpperCase();
                        const isSelected = selectedIds.has(file.id);

                        return (
                          <div
                            key={file.id}
                            className="driveFileRow"
                            onClick={() => setPreviewItem(file)}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "36px 3fr 2.2fr 1.3fr 1fr 80px",
                              alignItems: "center",
                              padding: "11px 16px",
                              borderBottom: `1px solid ${c.border}`,
                              fontSize: "12.5px",
                              color: c.textBody,
                              cursor: "pointer",
                              transition: "background 0.12s ease",
                              background: isSelected
                                ? (isDark ? "rgba(37,99,235,0.12)" : "var(--acc-soft)")
                                : "transparent",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = c.hoverBg;
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.background = "transparent";
                            }}
                          >
                            {/* Checkbox */}
                            <div
                              style={{ display: "grid", placeItems: "center" }}
                              onClick={(e) => toggleSelect(file.id, e)}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ cursor: "pointer", accentColor: "var(--acc)" }}
                              />
                            </div>

                            {/* File Name + Dog-eared Document Sheet Icon */}
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                              {(() => {
                                const IconComponent = meta.icon;
                                return (
                                  <div
                                    style={{
                                      width: "28px",
                                      height: "28px",
                                      borderRadius: "7px",
                                      background: isDark ? "#1e293b" : "#f1f5f9",
                                      color: isDark ? "#cbd5e1" : "#475569",
                                      display: "grid",
                                      placeItems: "center",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <IconComponent size={15} />
                                  </div>
                                );
                              })()}

                              <span
                                style={{
                                  fontWeight: 650,
                                  color: c.textHeading,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                                title={file.name}
                              >
                                {file.name}
                              </span>
                            </div>

                            {/* Added by / User Avatar + Email (Image 2 style) */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                              <div
                                style={{
                                  width: "22px",
                                  height: "22px",
                                  borderRadius: "50%",
                                  background: "var(--acc)",
                                  color: "#ffffff",
                                  fontWeight: 800,
                                  fontSize: "9.5px",
                                  display: "grid",
                                  placeItems: "center",
                                  flexShrink: 0,
                                }}
                              >
                                {creatorInitial}
                              </div>
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: c.textBody,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {creatorEmail}
                              </span>
                            </div>

                            {/* Date Added */}
                            <span style={{ color: c.textMuted, fontSize: "12px" }}>
                              {formatDate(file.createdAt)}
                            </span>

                            {/* Size */}
                            <span style={{ color: c.textMuted, fontSize: "12px" }}>
                              {formatBytes(file.size)}
                            </span>

                            {/* Quick Actions */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                              <button
                                type="button"
                                onClick={(e) => handleDownload(file, e)}
                                title="Télécharger"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: c.textMuted,
                                  cursor: "pointer",
                                  padding: "4px",
                                  borderRadius: "4px",
                                }}
                              >
                                <Download size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDelete(file, e)}
                                title="Supprimer"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#dc2626",
                                  cursor: "pointer",
                                  padding: "4px",
                                  borderRadius: "4px",
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* GRID VIEW FOR FILES */
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      {files.map((file) => {
                        const meta = getFileMeta(file);
                        const IconComponent = meta.icon;
                        const isImg = meta.type === "image" && file.data;

                        return (
                          <div
                            key={file.id}
                            onClick={() => setPreviewItem(file)}
                            style={{
                              background: c.cardBg,
                              border: `1px solid ${c.border}`,
                              borderRadius: "14px",
                              padding: "12px",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              minHeight: "150px",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "var(--acc)";
                              e.currentTarget.style.boxShadow = "0 6px 14px rgba(0,0,0,0.06)";
                              e.currentTarget.style.transform = "translateY(-1px)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = c.border;
                              e.currentTarget.style.boxShadow = "none";
                              e.currentTarget.style.transform = "translateY(0)";
                            }}
                          >
                            <div
                              style={{
                                height: "72px",
                                borderRadius: "10px",
                                background: isImg ? (isDark ? "#1e293b" : "#f8fafc") : (isDark ? "#1e293b" : "#f1f5f9"),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                                position: "relative",
                              }}
                            >
                              {isImg ? (
                                <img
                                  src={file.data || ""}
                                  alt={file.name}
                                  style={{ width: "100%", height: "100%", objectFit: "contain", padding: "6px" }}
                                />
                              ) : (
                                <IconComponent size={28} style={{ color: "var(--acc)" }} />
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleToggleStar(file, e)}
                                style={{
                                  position: "absolute",
                                  top: "4px",
                                  right: "4px",
                                  background: "rgba(255,255,255,0.85)",
                                  border: "none",
                                  borderRadius: "4px",
                                  width: "22px",
                                  height: "22px",
                                  display: "grid",
                                  placeItems: "center",
                                  color: file.starred ? "var(--acc)" : "#94a3b8",
                                  cursor: "pointer",
                                }}
                              >
                                <Star size={11} fill={file.starred ? "var(--acc)" : "none"} />
                              </button>
                            </div>

                            <div style={{ marginTop: "10px" }}>
                              <strong
                                style={{
                                  display: "block",
                                  fontSize: "12.5px",
                                  color: c.textHeading,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                                title={file.name}
                              >
                                {file.name}
                              </strong>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: "11px",
                                  color: c.textMuted,
                                  marginTop: "4px",
                                }}
                              >
                                <span>{formatBytes(file.size)}</span>
                                <span>{file.creatorName?.split(" ")[0] || "Admin"}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MODAL: NOUVEAU DOSSIER */}
      {createFolderOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => setCreateFolderOpen(false)}
        >
          <div
            className="driveModal"
            style={{
              width: "100%",
              maxWidth: "420px",
              padding: "22px",
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: "18px",
              boxShadow: isDark ? "0 20px 40px rgba(0,0,0,0.5)" : "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FolderPlus size={18} style={{ color: "var(--acc)" }} />
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: c.textHeading }}>
                  Nouveau dossier
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateFolderOpen(false)}
                style={{ background: "transparent", border: "none", color: c.textMuted, cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", fontWeight: 600, color: c.textBody }}>
                Nom du dossier
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="ex: Contrats & Factures"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  style={{
                    height: "38px",
                    padding: "0 12px",
                    borderRadius: "9px",
                    border: `1px solid ${c.borderInput}`,
                    background: c.inputBg,
                    color: c.textHeading,
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </label>

              <div>
                <span style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: c.textBody, marginBottom: "8px" }}>
                  Couleur du dossier
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {FOLDER_COLORS.map((fc) => (
                    <button
                      key={fc.value}
                      type="button"
                      onClick={() => setNewFolderColor(fc.value)}
                      title={fc.label}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: fc.value,
                        border: newFolderColor === fc.value ? "2.5px solid var(--acc)" : (isDark ? "2px solid #1e293b" : "2px solid #ffffff"),
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setCreateFolderOpen(false)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${c.border}`,
                    background: c.subtleBg,
                    color: c.textBody,
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "6px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--acc)",
                    color: "#ffffff",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RENOMMER */}
      {renameItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => setRenameItem(null)}
        >
          <div
            className="driveModal"
            style={{
              width: "100%",
              maxWidth: "420px",
              padding: "22px",
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: "18px",
              boxShadow: isDark ? "0 20px 40px rgba(0,0,0,0.5)" : "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: c.textHeading }}>
                Renommer
              </h3>
              <button
                type="button"
                onClick={() => setRenameItem(null)}
                style={{ background: "transparent", border: "none", color: c.textMuted, cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRename} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", fontWeight: 600, color: c.textBody }}>
                Nouveau nom
                <input
                  type="text"
                  autoFocus
                  required
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  style={{
                    height: "38px",
                    padding: "0 12px",
                    borderRadius: "9px",
                    border: `1px solid ${c.borderInput}`,
                    background: c.inputBg,
                    color: c.textHeading,
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setRenameItem(null)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${c.border}`,
                    background: c.subtleBg,
                    color: c.textBody,
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "6px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--acc)",
                    color: "#ffffff",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DÉPLACER VERS... */}
      {moveItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => setMoveItem(null)}
        >
          <div
            className="driveModal"
            style={{
              width: "100%",
              maxWidth: "460px",
              padding: "22px",
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: "18px",
              boxShadow: isDark ? "0 20px 40px rgba(0,0,0,0.5)" : "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Move size={17} style={{ color: "var(--acc)" }} />
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: c.textHeading }}>
                  Déplacer &quot;{moveItem.name}&quot;
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMoveItem(null)}
                style={{ background: "transparent", border: "none", color: c.textMuted, cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleMove} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <span style={{ fontSize: "12px", color: c.textMuted }}>
                Sélectionnez le dossier de destination :
              </span>

              <div
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  border: `1px solid ${c.border}`,
                  borderRadius: "10px",
                  padding: "6px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setMoveTargetParentId(null)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "7px",
                    border: "1px solid",
                    borderColor: moveTargetParentId === null ? "var(--acc)" : "transparent",
                    background: moveTargetParentId === null ? (isDark ? "rgba(37,99,235,0.2)" : "var(--acc-soft)") : "transparent",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "12.5px",
                    fontWeight: 650,
                    color: moveTargetParentId === null ? "var(--acc)" : c.textBody,
                  }}
                >
                  <Home size={14} />
                  <span>Mon Drive (Racine)</span>
                  {moveTargetParentId === null && <Check size={14} style={{ marginLeft: "auto" }} />}
                </button>

                {folderTree
                  .filter((f) => f.id !== moveItem.id)
                  .map((f) => {
                    const isSelected = moveTargetParentId === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setMoveTargetParentId(f.id)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "7px",
                          border: "1px solid",
                          borderColor: isSelected ? "var(--acc)" : "transparent",
                          background: isSelected ? (isDark ? "rgba(37,99,235,0.2)" : "var(--acc-soft)") : "transparent",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          cursor: "pointer",
                          fontSize: "12.5px",
                          fontWeight: 650,
                          color: isSelected ? "var(--acc)" : c.textBody,
                        }}
                      >
                        <Folder size={14} style={{ color: f.color || "#64748b" }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.name}
                        </span>
                        {isSelected && <Check size={14} style={{ marginLeft: "auto" }} />}
                      </button>
                    );
                  })}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setMoveItem(null)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${c.border}`,
                    background: c.subtleBg,
                    color: c.textBody,
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "6px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--acc)",
                    color: "#ffffff",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Déplacer ici
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: APERÇU FICHIER */}
      {previewItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="driveModal"
            style={{
              width: "100%",
              maxWidth: "680px",
              maxHeight: "86vh",
              overflowY: "auto",
              padding: "22px",
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: "20px",
              boxShadow: isDark ? "0 25px 50px rgba(0,0,0,0.5)" : "0 25px 50px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                {(() => {
                  const meta = getFileMeta(previewItem);
                  const Icon = meta.icon;
                  return (
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "8px",
                        background: meta.bg,
                        color: meta.color,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} />
                    </div>
                  );
                })()}
                <div style={{ minWidth: 0 }}>
                  <h3
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      margin: "0 0 2px",
                      color: c.textHeading,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {previewItem.name}
                  </h3>
                  <span style={{ fontSize: "11.5px", color: c.textMuted }}>
                    {formatBytes(previewItem.size)} · Ajouté par {previewItem.creatorName || "Administrateur"} le {formatDate(previewItem.createdAt)}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => handleDownload(previewItem)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${c.border}`,
                    background: c.subtleBg,
                    color: c.textBody,
                    fontSize: "12px",
                    fontWeight: 650,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    cursor: "pointer",
                  }}
                >
                  <Download size={13} />
                  Télécharger
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  style={{ background: "transparent", border: "none", color: c.textMuted, cursor: "pointer", padding: "4px" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div
              style={{
                background: c.cardBg,
                border: `1px solid ${c.border}`,
                borderRadius: "14px",
                padding: "20px",
                display: "grid",
                placeItems: "center",
                minHeight: "260px",
                overflow: "hidden",
              }}
            >
              {(() => {
                const meta = getFileMeta(previewItem);
                if (meta.type === "image" && previewItem.data) {
                  return (
                    <img
                      src={previewItem.data}
                      alt={previewItem.name}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "420px",
                        objectFit: "contain",
                        borderRadius: "8px",
                      }}
                    />
                  );
                }

                if (meta.type === "pdf" && previewItem.data?.startsWith("data:application/pdf")) {
                  return (
                    <iframe
                      src={previewItem.data}
                      title={previewItem.name}
                      style={{
                        width: "100%",
                        height: "440px",
                        border: "none",
                        borderRadius: "8px",
                      }}
                    />
                  );
                }

                return (
                  <div style={{ textAlign: "center", padding: "20px" }}>
                    <div
                      style={{
                        width: "58px",
                        height: "58px",
                        borderRadius: "16px",
                        background: meta.bg,
                        color: meta.color,
                        display: "grid",
                        placeItems: "center",
                        margin: "0 auto 12px",
                      }}
                    >
                      <meta.icon size={30} />
                    </div>
                    <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: c.textHeading }}>
                      Document {meta.label}
                    </h4>
                    <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: c.textMuted }}>
                      Taille : {formatBytes(previewItem.size)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownload(previewItem)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "9px",
                        border: "none",
                        background: "var(--acc)",
                        color: "#ffffff",
                        fontSize: "12.5px",
                        fontWeight: 650,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Download size={14} />
                      Télécharger ce fichier
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
