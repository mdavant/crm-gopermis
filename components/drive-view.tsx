"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HardDrive,
  Clock3,
  Star,
  Trash2,
  FolderPlus,
  Upload,
  Search,
  LayoutGrid,
  List,
  ChevronRight,
  Download,
  FolderInput,
  Copy,
  CopyPlus,
  Pencil,
  RotateCcw,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Eye,
  Scissors,
  ClipboardPaste,
  Plus,
  CheckSquare,
} from "lucide-react";
import { useIsMobile } from "../lib/use-mobile";
import { createPortal } from "react-dom";
import { api } from "../lib/api-types";
import { previewToken } from "../lib/session";
import { useApp } from "./app-context";
import { Modal } from "./modal";
import { FileTypeIcon, FolderIcon, fileTypeInfo } from "./file-icons";

/* ------------------------------------------------------------------ Types */

type Entry = {
  id: string;
  parentId: string | null;
  name: string;
  type: "folder" | "file";
  mimeType: string | null;
  size: number;
  starred: boolean;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  trashedAt: string | null;
  creatorName: string | null;
  childCount: number;
  url: string | null;
};
type TreeNode = { id: string; name: string; parentId: string | null; color: string | null; itemCount: number };
type ListResponse = {
  items: Entry[];
  breadcrumbs: { id: string | null; name: string }[];
  tree: TreeNode[];
  stats: { files: number; folders: number; bytes: number; trashBytes: number; trashCount: number };
  limits: { chunkBytes: number; maxFileBytes: number; trashRetentionDays: number };
};
type View = "folder" | "recent" | "starred" | "trash";
type UploadJob = {
  key: string;
  name: string;
  size: number;
  sent: number;
  status: "queued" | "uploading" | "done" | "error" | "cancelled";
  error?: string;
  file: File;
  parentId: string | null;
};

const KINDS = [
  { id: "all", label: "Tout" },
  { id: "folder", label: "Dossiers" },
  { id: "pdf", label: "PDF" },
  { id: "doc", label: "Documents" },
  { id: "sheet", label: "Tableurs" },
  { id: "image", label: "Images" },
  { id: "video", label: "Vidéos" },
  { id: "audio", label: "Audio" },
  { id: "archive", label: "Archives" },
];
/** Actions affichées en icône seule, épinglées à droite de la barre de sélection. */
const PINNED = ["dl", "trash", "purge"];
const FOLDER_COLORS = ["#e5484d", "#e8833a", "#d4a72c", "#12a594", "#3e7bfa", "#8e4ec6", "#d6409f", "#64748b"];

export function formatBytes(n: number) {
  if (!n) return "0 o";
  const u = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toLocaleString("fr-FR", { maximumFractionDigits: i ? 1 : 0 })} ${u[i]}`;
}
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const authHeaders = (): Record<string, string> => {
  const t = previewToken();
  return t ? { Authorization: "Bearer " + t } : {};
};

/* ---------------------------------------------------------------- Composant */

export function DriveView() {
  const { can } = useApp();
  const canWrite = can("drive.write") || can("admin.full");
  const canDelete = can("drive.delete") || can("admin.full");

  const [view, setView] = useState<View>("folder");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [layout, setLayout] = useState<"list" | "grid">(() => {
    try {
      return (localStorage.getItem("gopermis-drive-layout") as "list" | "grid") || "list";
    } catch {
      return "list";
    }
  });
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [undo, setUndo] = useState<{ run: () => void } | null>(null);
  const isMobile = useIsMobile();
  const [lasso, setLasso] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const lassoBase = useRef<Set<string>>(new Set());
  const justLassoed = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPress = useRef<{ t: ReturnType<typeof setTimeout> | null; fired: boolean }>({ t: null, fired: false });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastClicked = useRef<string | null>(null);
  const [clipboard, setClipboard] = useState<{ ids: string[]; mode: "copy" | "cut" } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; bg?: boolean } | null>(null);
  const [dialog, setDialog] = useState<
    | { kind: "folder" }
    | { kind: "rename"; item: Entry }
    | { kind: "move" | "copy"; ids: string[] }
    | { kind: "color"; item: Entry }
    | null
  >(null);
  const [preview, setPreview] = useState<Entry | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [externalDrag, setExternalDrag] = useState(false);
  const [uploads, setUploads] = useState<UploadJob[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const cancelled = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ view });
    if (folderId && view === "folder") sp.set("parentId", folderId);
    if (q.trim()) sp.set("q", q.trim());
    if (kind !== "all") sp.set("kind", kind);
    try {
      const res = await api<ListResponse>("drive2/list?" + sp.toString());
      setData(res);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [view, folderId, q, kind]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 220 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => setSelected(new Set()), [view, folderId, q, kind]);

  useEffect(() => {
    try {
      localStorage.setItem("gopermis-drive-layout", layout);
    } catch {
      // ignore
    }
  }, [layout]);

  useEffect(() => {
    if (!toast) {
      setUndo(null);
      return;
    }
    const t = setTimeout(() => setToast(""), undo ? 6000 : 3200);
    return () => clearTimeout(t);
  }, [toast, undo]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const selItems = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected]);
  const inTrash = view === "trash";

  async function run(fn: () => Promise<unknown>, success?: string) {
    try {
      await fn();
      setUndo(null);
      if (success) setToast(success);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }

  const open = (it: Entry) => {
    if (inTrash) return;
    if (it.type === "folder") {
      setView("folder");
      setQ("");
      setFolderId(it.id);
    } else setPreview(it);
  };

  const goFolder = (id: string | null) => {
    setView("folder");
    setQ("");
    setKind("all");
    setFolderId(id);
  };

  /* ------------------------------------------------------------ Sélection */

  /** Un clic ouvre (dossier ou aperçu) ; la sélection se fait uniquement par la case. */
  const clickItem = (e: React.MouseEvent, it: Entry) => {
    e.stopPropagation();
    setMenu(null);
    if (longPress.current.fired) {
      longPress.current.fired = false;
      return;
    }
    // Ctrl/⌘ + clic : ajoute/retire ; Maj + clic : sélectionne la plage (comme Google Drive).
    if (e.metaKey || e.ctrlKey || e.shiftKey || (isMobile && selected.size > 0)) {
      toggleCheck(it, e.shiftKey);
      return;
    }
    open(it);
  };

  /** Appui long (mobile) : passe en mode sélection. */
  const touchProps = (it: Entry) => ({
    onTouchStart: () => {
      longPress.current.fired = false;
      if (longPress.current.t) clearTimeout(longPress.current.t);
      longPress.current.t = setTimeout(() => {
        longPress.current.fired = true;
        try {
          navigator.vibrate?.(12);
        } catch {}
        setSelected((prev) => new Set(prev).add(it.id));
        lastClicked.current = it.id;
      }, 450);
    },
    onTouchMove: () => longPress.current.t && clearTimeout(longPress.current.t),
    onTouchEnd: () => longPress.current.t && clearTimeout(longPress.current.t),
  });

  /* ---------------------------------------------- Sélection au lasso */

  const onLassoDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isMobile) return;
    const t = e.target as HTMLElement;
    if (t.closest(".dItem, button, input, a, .dRowHead")) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top + e.currentTarget.scrollTop;
    lassoBase.current = e.metaKey || e.ctrlKey || e.shiftKey ? new Set(selected) : new Set();
    setLasso({ x0: x, y0: y, x1: x, y1: y });
    e.preventDefault();
  };

  useEffect(() => {
    if (!lasso) return;
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const move = (ev: MouseEvent) => {
      const box = el.getBoundingClientRect();
      const x1 = Math.max(0, Math.min(ev.clientX - box.left, box.width));
      const y1 = ev.clientY - box.top + el.scrollTop;
      // Défilement automatique près des bords
      if (ev.clientY > box.bottom - 30) el.scrollTop += 14;
      else if (ev.clientY < box.top + 30) el.scrollTop -= 14;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setLasso((l) => (l ? { ...l, x1, y1 } : l));
        const left = Math.min(lasso.x0, x1) + box.left;
        const right = Math.max(lasso.x0, x1) + box.left;
        const top = Math.min(lasso.y0, y1) - el.scrollTop + box.top;
        const bottom = Math.max(lasso.y0, y1) - el.scrollTop + box.top;
        if (Math.abs(x1 - lasso.x0) + Math.abs(y1 - lasso.y0) < 6) return;
        const next = new Set(lassoBase.current);
        el.querySelectorAll<HTMLElement>(".dItem[data-id]").forEach((n) => {
          const r = n.getBoundingClientRect();
          if (r.right > left && r.left < right && r.bottom > top && r.top < bottom) next.add(n.dataset.id!);
        });
        setSelected(next);
      });
    };
    const up = (ev: MouseEvent) => {
      const box = el.getBoundingClientRect();
      const moved = Math.abs(ev.clientX - box.left - lasso.x0) + Math.abs(ev.clientY - box.top + el.scrollTop - lasso.y0) > 6;
      justLassoed.current = moved;
      setLasso(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lasso?.x0, lasso?.y0]);

  /** Case à cocher : Maj+clic sélectionne toute la plage depuis la dernière case cochée. */
  const toggleCheck = (it: Entry, shift = false) => {
    const next = new Set(selected);
    if (shift && lastClicked.current) {
      const a = items.findIndex((x) => x.id === lastClicked.current);
      const b = items.findIndex((x) => x.id === it.id);
      if (a >= 0 && b >= 0) for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(items[i].id);
    } else if (next.has(it.id)) next.delete(it.id);
    else next.add(it.id);
    lastClicked.current = it.id;
    setSelected(next);
  };

  const ids = () => [...selected];

  /* -------------------------------------------------------------- Actions */

  const download = (list: Entry[]) => {
    const files = list.filter((i) => i.type === "file" && i.url);
    files.forEach((f, i) =>
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = f.url!;
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 350),
    );
    if (list.some((i) => i.type === "folder")) setToast("Les dossiers ne se téléchargent pas d'un bloc : ouvrez-les pour récupérer leurs fichiers.");
  };

  /** Retire tout de suite les éléments de l'écran (l'opération suit en arrière-plan). */
  const hide = (list: string[]) => {
    const gone = new Set(list);
    setData((d) => (d ? { ...d, items: d.items.filter((i) => !gone.has(i.id)) } : d));
    setSelected(new Set());
  };
  const trash = async (list: string[]) => {
    hide(list);
    const ok = await run(
      () => api("drive2/trash", { ids: list }),
      `${list.length} élément${list.length > 1 ? "s" : ""} placé${list.length > 1 ? "s" : ""} dans la corbeille.`,
    );
    if (ok) setUndo({ run: () => void run(() => api("drive2/restore", { ids: list }), "Éléments restaurés.") });
    return ok;
  };
  /** Déplacement avec annulation possible (retour au dossier d'origine). */
  const moveTo = async (list: string[], target: string | null) => {
    const origin = new Map<string | null, string[]>();
    for (const id of list) {
      const it = items.find((i) => i.id === id);
      if (!it || it.parentId === target) continue;
      const k = it.parentId ?? null;
      origin.set(k, [...(origin.get(k) ?? []), id]);
    }
    const moving = [...origin.values()].flat();
    if (!moving.length) return;
    hide(moving);
    const name = target ? tree.find((t) => t.id === target)?.name ?? "le dossier" : "Mon Drive";
    const ok = await run(() => api("drive2/move", { ids: moving, parentId: target, keepName: true }), `${moving.length} élément${moving.length > 1 ? "s" : ""} déplacé${moving.length > 1 ? "s" : ""} vers « ${name} ».`);
    if (ok)
      setUndo({
        run: () =>
          void run(async () => {
            for (const [parent, ids2] of origin) await api("drive2/move", { ids: ids2, parentId: parent, keepName: true });
          }, "Déplacement annulé."),
      });
  };
  const restore = (list: string[]) => run(() => api("drive2/restore", { ids: list }), "Éléments restaurés.");
  const purge = (list: string[]) => {
    if (!window.confirm(`Supprimer définitivement ${list.length} élément(s) ? Cette action est irréversible.`)) return;
    void run(() => api("drive2/purge", { ids: list }), "Suppression définitive effectuée.");
  };
  const duplicate = (list: string[]) => run(() => api("drive2/copy", { ids: list }), "Copie créée.");
  const toggleStar = (list: Entry[]) => {
    const starred = !list.every((i) => i.starred);
    void run(() => api("drive2/update", { ids: list.map((i) => i.id), starred }), starred ? "Ajouté aux favoris." : "Retiré des favoris.");
  };
  const paste = () => {
    if (!clipboard) return;
    const target = view === "folder" ? folderId : null;
    void run(
      () =>
        clipboard.mode === "cut"
          ? api("drive2/move", { ids: clipboard.ids, parentId: target, keepName: true })
          : api("drive2/copy", { ids: clipboard.ids, parentId: target, keepName: false }),
      clipboard.mode === "cut" ? "Éléments déplacés." : "Éléments collés.",
    ).then((ok) => ok && clipboard.mode === "cut" && setClipboard(null));
  };

  /* ---------------------------------------------------------- Clavier */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      if (document.querySelector(".modalBackdrop, .cmdBackdrop")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(items.map((i) => i.id)));
      } else if (e.key === "Escape") {
        setSelected(new Set());
        setMenu(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected.size && canDelete) {
        e.preventDefault();
        if (inTrash) purge(ids());
        else void trash(ids());
      } else if (e.key === "F2" && selItems.length === 1 && canWrite && !inTrash) {
        e.preventDefault();
        setDialog({ kind: "rename", item: selItems[0] });
      } else if (mod && e.key.toLowerCase() === "c" && selected.size && !inTrash) {
        setClipboard({ ids: ids(), mode: "copy" });
        setToast(`${selected.size} élément(s) copié(s) — Ctrl/⌘ V pour coller.`);
      } else if (mod && e.key.toLowerCase() === "x" && selected.size && canWrite && !inTrash) {
        setClipboard({ ids: ids(), mode: "cut" });
        setToast(`${selected.size} élément(s) coupé(s) — Ctrl/⌘ V pour coller.`);
      } else if (mod && e.key.toLowerCase() === "v" && clipboard && canWrite && view === "folder") {
        e.preventDefault();
        paste();
      } else if (e.key === "Enter" && selItems.length === 1) open(selItems[0]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ------------------------------------------------------------- Envois */

  const enqueue = (files: FileList | File[], parentId: string | null) => {
    if (!canWrite) {
      setError("Vous n'avez pas l'autorisation d'ajouter des fichiers.");
      return;
    }
    const jobs: UploadJob[] = Array.from(files).map((f) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      size: f.size,
      sent: 0,
      status: "queued",
      file: f,
      parentId,
    }));
    if (jobs.length) setUploads((u) => [...u.filter((j) => j.status !== "done"), ...jobs]);
  };

  const patchJob = (key: string, patch: Partial<UploadJob>) =>
    setUploads((u) => u.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  const uploadOne = useCallback(
    async (job: UploadJob) => {
      patchJob(job.key, { status: "uploading" });
      try {
        const start = await api<{ uploadId: string; chunkBytes: number }>("drive2/upload/start", {
          name: job.name,
          size: job.size,
          mimeType: job.file.type || undefined,
          parentId: job.parentId,
        });
        let offset = 0;
        while (offset < job.size) {
          if (cancelled.current.has(job.key)) throw new Error("Annulé");
          const blob = job.file.slice(offset, offset + start.chunkBytes);
          let attempt = 0;
          for (;;) {
            try {
              const r = await fetch(`/api/drive2/upload/chunk?id=${start.uploadId}&offset=${offset}`, {
                method: "POST",
                headers: { "Content-Type": "application/octet-stream", ...authHeaders() },
                credentials: "same-origin",
                body: blob,
              });
              const body = await r.json().catch(() => ({}));
              if (!r.ok) throw Object.assign(new Error(body.error || "Échec de l'envoi"), { status: r.status });
              offset = Number(body.received);
              break;
            } catch (e) {
              const status = (e as { status?: number }).status ?? 0;
              if (status && status < 500) throw e;
              if (++attempt > 4) throw e;
              await new Promise((res) => setTimeout(res, 800 * attempt));
            }
          }
          patchJob(job.key, { sent: offset });
        }
        await api("drive2/upload/finish", { uploadId: start.uploadId });
        patchJob(job.key, { status: "done", sent: job.size });
      } catch (e) {
        const msg = (e as Error).message;
        patchJob(job.key, { status: cancelled.current.has(job.key) ? "cancelled" : "error", error: msg });
      }
    },
    [],
  );

  // File d'attente : 2 envois en parallèle.
  useEffect(() => {
    const active = uploads.filter((j) => j.status === "uploading").length;
    const next = uploads.filter((j) => j.status === "queued").slice(0, Math.max(0, 2 - active));
    next.forEach((j) => void uploadOne(j));
    if (uploads.length && uploads.every((j) => j.status !== "queued" && j.status !== "uploading")) {
      void load();
      // Ferme le panneau quelques secondes après la fin, s'il n'y a pas d'erreur.
      if (uploads.every((j) => j.status === "done")) {
        const t = setTimeout(() => setUploads((u) => (u.every((j) => j.status === "done") ? [] : u)), 4000);
        return () => clearTimeout(t);
      }
    }
  }, [uploads, uploadOne, load]);

  /* ------------------------------------------------- Glisser-déposer */

  const onItemDragStart = (e: React.DragEvent, it: Entry) => {
    if (!canWrite || inTrash) return e.preventDefault();
    const list = selected.has(it.id) ? ids() : [it.id];
    if (!selected.has(it.id)) setSelected(new Set([it.id]));
    e.dataTransfer.setData("application/x-gopermis-drive", JSON.stringify(list));
    e.dataTransfer.effectAllowed = "copyMove";
    const ghost = document.createElement("div");
    ghost.className = "dragGhost";
    ghost.textContent = list.length > 1 ? `${list.length} éléments` : it.name;
    if (list.length > 1) ghost.dataset.count = String(list.length);
    setDragging(true);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 10, 10);
    setTimeout(() => ghost.remove(), 0);
  };

  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) return;
    const end = () => {
      setDragging(false);
      setDropTarget(null);
    };
    window.addEventListener("dragend", end);
    window.addEventListener("drop", end);
    return () => {
      window.removeEventListener("dragend", end);
      window.removeEventListener("drop", end);
    };
  }, [dragging]);

  // Dossier survolé pendant un glisser : il s'ouvre après un court instant (comme Google Drive).
  useEffect(() => {
    if (!dropTarget || dropTarget === "root" || dropTarget === (view === "folder" ? folderId : null)) return;
    if (!tree.some((t) => t.id === dropTarget)) return;
    const t = setTimeout(() => {
      setView("folder");
      setQ("");
      setFolderId(dropTarget);
      setDropTarget(null);
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropTarget]);

  const isInternal = (e: React.DragEvent) => e.dataTransfer.types.includes("application/x-gopermis-drive");
  const isExternal = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");

  const dropOn = (target: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canWrite || inTrash || !(isInternal(e) || isExternal(e))) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = isInternal(e) ? (e.altKey ? "copy" : "move") : "copy";
      setDropTarget(target ?? "root");
    },
    onDragLeave: (e: React.DragEvent) => {
      e.stopPropagation();
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setDropTarget((d) => (d === (target ?? "root") ? null : d));
    },
    onDrop: (e: React.DragEvent) => {
      if (!canWrite || inTrash) return;
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      setExternalDrag(false);
      const raw = e.dataTransfer.getData("application/x-gopermis-drive");
      if (raw) {
        const list = (JSON.parse(raw) as string[]).filter((id) => id !== target);
        if (!list.length) return;
        if (e.altKey) void run(() => api("drive2/copy", { ids: list, parentId: target, keepName: true }), "Éléments copiés.");
        else void moveTo(list, target);
      } else if (e.dataTransfer.files.length) enqueue(e.dataTransfer.files, target);
    },
  });

  const currentTarget = view === "folder" ? folderId : null;

  /* ---------------------------------------------------------- Rendu */

  const tree = data?.tree ?? [];
  const children = (pid: string | null) => tree.filter((t) => t.parentId === pid);

  const renderTree = (pid: string | null, depth: number): React.ReactNode =>
    children(pid).map((n) => {
      const kids = children(n.id);
      const isOpen = expanded.has(n.id);
      const active = view === "folder" && folderId === n.id;
      return (
        <div key={n.id}>
          <div
            className={`dTreeRow ${active ? "active" : ""} ${dropTarget === n.id ? "drop" : ""}`}
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={() => goFolder(n.id)}
            {...dropOn(n.id)}
          >
            <button
              type="button"
              className={`dTreeCaret ${kids.length ? "" : "hidden"} ${isOpen ? "open" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                const next = new Set(expanded);
                if (isOpen) next.delete(n.id);
                else next.add(n.id);
                setExpanded(next);
              }}
              aria-label={isOpen ? "Replier" : "Déplier"}
            >
              <ChevronRight size={13} />
            </button>
            <FolderIcon color={n.color} size={18} open={active} />
            <span className="dTreeName">{n.name}</span>
            {n.itemCount > 0 && <span className="dTreeCount">{n.itemCount}</span>}
          </div>
          {isOpen && renderTree(n.id, depth + 1)}
        </div>
      );
    });

  // Déplie automatiquement le chemin du dossier ouvert.
  useEffect(() => {
    if (!data?.breadcrumbs?.length) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      data.breadcrumbs.forEach((b) => b.id && next.add(b.id));
      return next;
    });
  }, [data?.breadcrumbs]);

  const title =
    q.trim() ? `Résultats pour « ${q.trim()} »` : view === "recent" ? "Récents" : view === "starred" ? "Favoris" : view === "trash" ? "Corbeille" : null;

  const actionsFor = (list: Entry[]) => {
    const one = list.length === 1 ? list[0] : null;
    if (inTrash)
      return [
        canDelete && { key: "restore", label: "Restaurer", icon: RotateCcw, run: () => void restore(list.map((i) => i.id)) },
        canDelete && { key: "purge", label: "Supprimer définitivement", icon: Trash2, danger: true, run: () => purge(list.map((i) => i.id)) },
      ];
    return [
      one && { key: "open", label: one.type === "folder" ? "Ouvrir" : "Aperçu", icon: Eye, run: () => open(one) },
      list.some((i) => i.type === "file") && { key: "dl", label: "Télécharger", icon: Download, run: () => download(list) },
      canWrite && one && { key: "rename", label: "Renommer", icon: Pencil, kbd: "F2", run: () => setDialog({ kind: "rename", item: one }) },
      canWrite && { key: "move", label: "Déplacer vers…", icon: FolderInput, run: () => setDialog({ kind: "move", ids: list.map((i) => i.id) }) },
      canWrite && { key: "copyto", label: "Copier vers…", icon: Copy, run: () => setDialog({ kind: "copy", ids: list.map((i) => i.id) }) },
      canWrite && { key: "dup", label: "Dupliquer", icon: CopyPlus, run: () => void duplicate(list.map((i) => i.id)) },
      { key: "clip", label: "Copier", icon: Copy, kbd: "Ctrl C", run: () => setClipboard({ ids: list.map((i) => i.id), mode: "copy" }) },
      canWrite && { key: "cut", label: "Couper", icon: Scissors, kbd: "Ctrl X", run: () => setClipboard({ ids: list.map((i) => i.id), mode: "cut" }) },
      { key: "star", label: list.every((i) => i.starred) ? "Retirer des favoris" : "Ajouter aux favoris", icon: Star, run: () => toggleStar(list) },
      canWrite && one?.type === "folder" && { key: "color", label: "Couleur du dossier", icon: FolderPlus, run: () => setDialog({ kind: "color", item: one }) },
      canDelete && { key: "trash", label: "Mettre à la corbeille", icon: Trash2, danger: true, kbd: "Suppr", run: () => void trash(list.map((i) => i.id)) },
    ];
  };
  type Act = { key: string; label: string; icon: React.ComponentType<{ size?: number }>; run: () => void; danger?: boolean; kbd?: string };
  const actions = (actionsFor(selItems).filter(Boolean) as Act[]);
  const bgActions = (
    [
      canWrite && view === "folder" && { key: "newf", label: "Nouveau dossier", icon: FolderPlus, run: () => setDialog({ kind: "folder" }) },
      canWrite && !inTrash && { key: "up", label: "Importer des fichiers", icon: Upload, run: () => fileInput.current?.click() },
      clipboard && canWrite && view === "folder" && { key: "paste", label: `Coller ${clipboard.ids.length} élément(s)`, icon: ClipboardPaste, kbd: "Ctrl V", run: paste },
      items.length > 0 && { key: "all", label: "Tout sélectionner", icon: CheckSquare, kbd: "Ctrl A", run: () => setSelected(new Set(items.map((i) => i.id))) },
    ].filter(Boolean) as Act[]
  );
  const menuActions = menu?.bg ? bgActions : actions;

  const pct = (j: UploadJob) => (j.size ? Math.round((j.sent / j.size) * 100) : 100);
  const activeUploads = uploads.filter((j) => j.status !== "done" || uploads.some((x) => x.status === "uploading"));

  return (
    <div
      className={`dDrive ${dragging ? "dragging" : ""} ${selected.size ? "selecting" : ""} ${lasso ? "lassoing" : ""}`}
      onDragEnter={(e) => {
        if (isExternal(e) && canWrite && !inTrash) setExternalDrag(true);
      }}
      onClick={() => setMenu(null)}
    >
      {/* -------------------------------------------- Colonne fixe */}
      <aside className="dSide">
        {canWrite && (
          <div className="dNewWrap">
            <button type="button" className="dNewBtn" onClick={(e) => { e.stopPropagation(); fileInput.current?.click(); }}>
              <Upload size={16} /> Importer
            </button>
            <button type="button" className="dNewBtn ghost" onClick={() => setDialog({ kind: "folder" })} title="Nouveau dossier">
              <FolderPlus size={16} />
            </button>
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) enqueue(e.target.files, currentTarget);
            e.target.value = "";
          }}
        />
        <nav className="dNav">
          <button type="button" className={view === "folder" && !folderId ? "active" : ""} onClick={() => goFolder(null)} {...dropOn(null)}>
            <HardDrive size={16} /> Mon Drive
          </button>
          <button type="button" className={view === "recent" ? "active" : ""} onClick={() => { setQ(""); setView("recent"); }}>
            <Clock3 size={16} /> Récents
          </button>
          <button type="button" className={view === "starred" ? "active" : ""} onClick={() => { setQ(""); setView("starred"); }}>
            <Star size={16} /> Favoris
          </button>
          <button type="button" className={view === "trash" ? "active" : ""} onClick={() => { setQ(""); setView("trash"); }}>
            <Trash2 size={16} /> Corbeille
            {!!data?.stats.trashCount && <span className="dTreeCount">{data.stats.trashCount}</span>}
          </button>
        </nav>
        <div className="dTreeTitle">Dossiers</div>
        <div className="dTree">
          {tree.length === 0 ? <p className="dMuted">Aucun dossier</p> : renderTree(null, 0)}
        </div>
        {data && (
          <div className="dStorage">
            <div className="dStorageRow">
              <span>Stockage utilisé</span>
              <strong>{formatBytes(data.stats.bytes)}</strong>
            </div>
            <small>
              {data.stats.files} fichier{data.stats.files > 1 ? "s" : ""} · {data.stats.folders} dossier
              {data.stats.folders > 1 ? "s" : ""}
              {data.stats.trashBytes > 0 && ` · corbeille ${formatBytes(data.stats.trashBytes)}`}
            </small>
          </div>
        )}
      </aside>

      {/* -------------------------------------------- Zone fichiers */}
      <section className="dMain" {...dropOn(currentTarget)}>
        {/* Navigation compacte (téléphone) */}
        <nav className="dMobileNav">
          <button type="button" className={view === "folder" ? "active" : ""} onClick={() => goFolder(null)}>
            <HardDrive size={15} /> Mon Drive
          </button>
          <button type="button" className={view === "recent" ? "active" : ""} onClick={() => { setQ(""); setView("recent"); }}>
            <Clock3 size={15} /> Récents
          </button>
          <button type="button" className={view === "starred" ? "active" : ""} onClick={() => { setQ(""); setView("starred"); }}>
            <Star size={15} /> Favoris
          </button>
          <button type="button" className={view === "trash" ? "active" : ""} onClick={() => { setQ(""); setView("trash"); }}>
            <Trash2 size={15} /> Corbeille
          </button>
        </nav>
        <header className="dHead">
          <div className="dCrumbs">
            {title ? (
              <h2>{title}</h2>
            ) : (
              (data?.breadcrumbs ?? [{ id: null, name: "Mon Drive" }]).map((b, i, arr) => (
                <React.Fragment key={b.id ?? "root"}>
                  <button
                    type="button"
                    className={`dCrumb ${i === arr.length - 1 ? "current" : ""} ${dropTarget === (b.id ?? "root") ? "drop" : ""}`}
                    onClick={() => goFolder(b.id)}
                    {...dropOn(b.id)}
                  >
                    {b.name}
                  </button>
                  {i < arr.length - 1 && <ChevronRight size={15} className="dCrumbSep" />}
                </React.Fragment>
              ))
            )}
          </div>
          <div className="dTools">
            <label className="dSearch">
              <Search size={15} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans le Drive" />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="Effacer">
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="dLayout" role="group" aria-label="Affichage">
              <button type="button" className={layout === "list" ? "active" : ""} onClick={() => setLayout("list")} title="Liste">
                <List size={15} />
              </button>
              <button type="button" className={layout === "grid" ? "active" : ""} onClick={() => setLayout("grid")} title="Grille">
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>
        </header>

        {/* Barre de sélection : remplace les filtres (même hauteur, rien ne se décale) */}
        <div className="dBarSlot">
          {selected.size > 0 ? (
        <div className="dSelBar show">
          <button type="button" className="dSelClose" onClick={() => setSelected(new Set())} aria-label="Désélectionner">
            <X size={15} />
          </button>
          <strong>
            {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </strong>
          <div className="dSelActions">
            {actions
              .filter((a) => !PINNED.includes(a.key))
              .map((a) => (
                <button key={a.key} type="button" className={a.danger ? "danger" : ""} onClick={a.run} title={a.kbd ? `${a.label} (${a.kbd})` : a.label}>
                  <a.icon size={15} />
                  <span>{a.label}</span>
                </button>
              ))}
          </div>
          {/* Télécharger et supprimer : icônes seules, toujours visibles à droite */}
          <div className="dSelPinned">
            {actions
              .filter((a) => PINNED.includes(a.key))
              .map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className={a.danger ? "danger" : ""}
                  onClick={a.run}
                  title={a.kbd ? `${a.label} (${a.kbd})` : a.label}
                  aria-label={a.label}
                >
                  <a.icon size={17} />
                </button>
              ))}
          </div>
        </div>

          ) : (
            <>
        {!inTrash && (
          <div className="dKinds">
            {KINDS.map((k) => (
              <button key={k.id} type="button" className={kind === k.id ? "active" : ""} onClick={() => setKind(k.id)}>
                {k.label}
              </button>
            ))}
            {clipboard && canWrite && view === "folder" && (
              <button type="button" className="dPaste" onClick={paste}>
                <ClipboardPaste size={14} /> Coller {clipboard.ids.length} élément{clipboard.ids.length > 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}

        {inTrash && (
          <div className="dTrashBar">
            <span>
              Les éléments sont supprimés définitivement après {data?.limits.trashRetentionDays ?? 30} jours.
            </span>
            {canDelete && !!items.length && (
              <button
                type="button"
                className="btnSecondary"
                onClick={() => {
                  if (window.confirm("Vider la corbeille ? Tous ses éléments seront supprimés définitivement."))
                    void run(() => api("drive2/empty-trash", {}), "Corbeille vidée.");
                }}
              >
                <Trash2 size={14} /> Vider la corbeille
              </button>
            )}
          </div>
        )}

            </>
          )}
        </div>

        {error && (
          <div className="calendarAlert errorAlert">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {/* Défilement indépendant */}
        <div
          ref={scrollRef}
          className={`dScroll ${dropTarget === (currentTarget ?? "root") ? "drop" : ""}`}
          onMouseDown={onLassoDown}
          onClick={() => {
            if (justLassoed.current) {
              justLassoed.current = false;
              return;
            }
            setSelected(new Set());
          }}
          onContextMenu={(e) => {
            if ((e.target as HTMLElement).closest(".dItem")) return;
            e.preventDefault();
            if (isMobile) return;
            setSelected(new Set());
            setMenu({ x: e.clientX, y: e.clientY, bg: true });
          }}
        >
          {lasso && (Math.abs(lasso.x1 - lasso.x0) + Math.abs(lasso.y1 - lasso.y0) > 6) && (
            <div
              className="dLasso"
              style={{
                left: Math.min(lasso.x0, lasso.x1),
                top: Math.min(lasso.y0, lasso.y1),
                width: Math.abs(lasso.x1 - lasso.x0),
                height: Math.abs(lasso.y1 - lasso.y0),
              }}
            />
          )}
          {loading && !data ? (
            <div className="dEmpty">
              <Loader2 size={22} className="spin" /> Chargement…
            </div>
          ) : items.length === 0 ? (
            <div className="dEmpty">
              <FolderIcon size={56} />
              <strong>{inTrash ? "La corbeille est vide" : q ? "Aucun résultat" : "Ce dossier est vide"}</strong>
              {!inTrash && !q && canWrite && (
                <>
                  <span>Glissez-déposez des fichiers ici, de n&apos;importe quel type et de n&apos;importe quelle taille.</span>
                  <div className="dEmptyActions">
                    <button type="button" className="btnSecondary" onClick={(e) => { e.stopPropagation(); setDialog({ kind: "folder" }); }}>
                      <FolderPlus size={15} /> Nouveau dossier
                    </button>
                    <button type="button" className="btnPrimary" onClick={(e) => { e.stopPropagation(); fileInput.current?.click(); }}>
                      <Upload size={15} /> Importer des fichiers
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : layout === "list" ? (
            <div className="dTable" role="grid">
              <div className="dRow dRowHead" role="row">
                <span className="dCheck">
                  <input
                    type="checkbox"
                    aria-label="Tout sélectionner"
                    checked={selected.size > 0 && selected.size === items.length}
                    onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())}
                    onClick={(e) => e.stopPropagation()}
                  />
                </span>
                <span>Nom</span>
                <span>{inTrash ? "Supprimé le" : "Modifié le"}</span>
                <span>Taille</span>
                <span />
              </div>
              {items.map((it) => (
                <div
                  key={it.id}
                  data-id={it.id}
                  {...touchProps(it)}
                  role="row"
                  className={`dRow dItem ${selected.has(it.id) ? "sel" : ""} ${dropTarget === it.id ? "drop" : ""} ${clipboard?.mode === "cut" && clipboard.ids.includes(it.id) ? "cut" : ""}`}
                  draggable={canWrite && !inTrash}
                  onDragStart={(e) => onItemDragStart(e, it)}
                  onClick={(e) => clickItem(e, it)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isMobile) return;
                    if (!selected.has(it.id)) setSelected(new Set([it.id]));
                    setMenu({ x: e.clientX, y: e.clientY });
                  }}
                  {...(it.type === "folder" ? dropOn(it.id) : {})}
                >
                  <span className="dCheck">
                    <input type="checkbox" checked={selected.has(it.id)} onChange={() => {}} onClick={(e) => { e.stopPropagation(); toggleCheck(it, e.shiftKey); }} aria-label={`Sélectionner ${it.name}`} />
                  </span>
                  <span className="dName">
                    {it.type === "folder" ? <FolderIcon color={it.color} size={26} /> : <FileTypeIcon name={it.name} mime={it.mimeType} size={22} />}
                    <span className="dNameText">{it.name}</span>
                    {it.starred && <Star size={13} className="dStar" />}
                  </span>
                  <span className="dMeta">{fmtDate(inTrash && it.trashedAt ? it.trashedAt : it.updatedAt)}</span>
                  <span className="dMeta">{it.type === "folder" ? `${it.childCount} élément${it.childCount > 1 ? "s" : ""}` : formatBytes(it.size)}</span>
                  <span className="dRowAct">
                    <button
                      type="button"
                      aria-label="Actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!selected.has(it.id)) setSelected(new Set([it.id]));
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setMenu({ x: r.left - 200, y: r.bottom + 4 });
                      }}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dGrid">
              {items.map((it) => (
                <div
                  key={it.id}
                  data-id={it.id}
                  {...touchProps(it)}
                  className={`dCard dItem ${selected.has(it.id) ? "sel" : ""} ${dropTarget === it.id ? "drop" : ""} ${clipboard?.mode === "cut" && clipboard.ids.includes(it.id) ? "cut" : ""}`}
                  draggable={canWrite && !inTrash}
                  onDragStart={(e) => onItemDragStart(e, it)}
                  onClick={(e) => clickItem(e, it)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isMobile) return;
                    if (!selected.has(it.id)) setSelected(new Set([it.id]));
                    setMenu({ x: e.clientX, y: e.clientY });
                  }}
                  {...(it.type === "folder" ? dropOn(it.id) : {})}
                >
                  <input
                    type="checkbox"
                    className="dCardCheck"
                    checked={selected.has(it.id)}
                    onChange={() => {}}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCheck(it, e.shiftKey);
                    }}
                    aria-label={`Sélectionner ${it.name}`}
                  />
                  <div className="dThumb">
                    {it.type === "folder" ? (
                      <FolderIcon color={it.color} size={64} />
                    ) : fileTypeInfo(it.name, it.mimeType).glyph === "image" && it.url && !/svg|heic|tif/i.test(it.name) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${it.url}?inline=1`} alt="" loading="lazy" />
                    ) : (
                      <FileTypeIcon name={it.name} mime={it.mimeType} size={52} />
                    )}
                  </div>
                  <div className="dCardName">
                    {it.starred && <Star size={12} className="dStar" />}
                    <span>{it.name}</span>
                  </div>
                  <small className="dMeta">{it.type === "folder" ? `${it.childCount} élément(s)` : formatBytes(it.size)}</small>
                </div>
              ))}
            </div>
          )}
        </div>

        {externalDrag && (
          <div
            className="dDropOverlay"
            {...dropOn(currentTarget)}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setExternalDrag(false);
            }}
          >
            <Upload size={34} />
            <strong>Déposez pour importer</strong>
            <span>dans « {data?.breadcrumbs?.at(-1)?.name ?? "Mon Drive"} »</span>
          </div>
        )}
      </section>

      {/* -------------------------------------------- Menu contextuel */}
      {menu &&
        menuActions.length > 0 &&
        createPortal(
          <>
      {menu && menuActions.length > 0 && isMobile && <div className="dSheetBackdrop" onClick={() => setMenu(null)} />}
      {menu && menuActions.length > 0 && (
        <div
          className={`dMenu ${isMobile ? "sheet" : ""}`}
          style={isMobile ? undefined : { left: Math.min(menu.x, window.innerWidth - 240), top: Math.max(8, Math.min(menu.y, window.innerHeight - menuActions.length * 38 - 20)) }}
          onClick={(e) => e.stopPropagation()}
        >
          {isMobile && !menu.bg && selItems.length === 1 && <div className="dMenuTitle">{selItems[0].name}</div>}
          {menuActions.map((a) => (
            <button
              key={a.key}
              type="button"
              className={a.danger ? "danger" : ""}
              onClick={() => {
                setMenu(null);
                a.run();
              }}
            >
              <a.icon size={15} />
              <span>{a.label}</span>
              {a.kbd && <kbd>{a.kbd}</kbd>}
            </button>
          ))}
        </div>
      )}
          </>,
          document.body,
        )}

      {/* -------------------------------------------- Envois en cours */}
      {uploads.length > 0 && (
        <div className="dUploads">
          <div className="dUploadsHead">
            <strong>
              {uploads.some((j) => j.status === "uploading" || j.status === "queued")
                ? `Import de ${uploads.filter((j) => j.status === "uploading" || j.status === "queued").length} fichier(s)…`
                : "Imports terminés"}
            </strong>
            <button type="button" onClick={() => setUploads((u) => u.filter((j) => j.status === "uploading" || j.status === "queued"))} aria-label="Fermer">
              <X size={15} />
            </button>
          </div>
          <div className="dUploadsList">
            {activeUploads.map((j) => (
              <div key={j.key} className={`dUpload ${j.status}`}>
                <FileTypeIcon name={j.name} size={18} />
                <div className="dUploadMain">
                  <span className="dUploadName">{j.name}</span>
                  <div className="dBar">
                    <span style={{ width: `${pct(j)}%` }} />
                  </div>
                  <small>
                    {j.status === "error"
                      ? j.error
                      : j.status === "cancelled"
                        ? "Annulé"
                        : j.status === "done"
                          ? formatBytes(j.size)
                          : `${formatBytes(j.sent)} / ${formatBytes(j.size)}`}
                  </small>
                </div>
                {j.status === "done" ? (
                  <CheckCircle2 size={16} className="ok" />
                ) : j.status === "uploading" || j.status === "queued" ? (
                  <button type="button" onClick={() => cancelled.current.add(j.key)} aria-label="Annuler">
                    <X size={14} />
                  </button>
                ) : (
                  <AlertCircle size={16} className="ko" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="dToast">
          <span>{toast}</span>
          {undo && (
            <button
              type="button"
              onClick={() => {
                undo.run();
                setUndo(null);
                setToast("");
              }}
            >
              Annuler
            </button>
          )}
        </div>
      )}

      {/* Bouton « + » (téléphone) */}
      {isMobile && canWrite && !inTrash && selected.size === 0 && (
        <button
          type="button"
          className="mFab"
          aria-label="Ajouter"
          onClick={(e) => {
            e.stopPropagation();
            setMenu({ x: 0, y: 0, bg: true });
          }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* -------------------------------------------- Fenêtres */}
      {dialog?.kind === "folder" && (
        <NameDialog
          title="Nouveau dossier"
          initial="Nouveau dossier"
          submit="Créer"
          onClose={() => setDialog(null)}
          onSubmit={(name) => run(() => api("drive2/folder", { name, parentId: currentTarget }), "Dossier créé.")}
        />
      )}
      {dialog?.kind === "rename" && (
        <NameDialog
          title="Renommer"
          initial={dialog.item.name}
          submit="Renommer"
          selectBase={dialog.item.type === "file"}
          onClose={() => setDialog(null)}
          onSubmit={(name) => run(() => api("drive2/update", { ids: [dialog.item.id], name }), "Renommé.")}
        />
      )}
      {(dialog?.kind === "move" || dialog?.kind === "copy") && (
        <FolderPicker
          title={dialog.kind === "move" ? "Déplacer vers" : "Copier vers"}
          tree={tree}
          exclude={dialog.ids}
          onClose={() => setDialog(null)}
          onPick={(target) =>
            run(
              dialog.kind === "move"
                ? () => moveTo(dialog.ids, target)
                : () => api("drive2/copy", { ids: dialog.ids, parentId: target, keepName: true }),
              dialog.kind === "move" ? "Éléments déplacés." : "Éléments copiés.",
            )
          }
        />
      )}
      {dialog?.kind === "color" && (
        <Modal title="Couleur du dossier" close={() => setDialog(null)}>
          <div className="dColors">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={dialog.item.color === c ? "active" : ""}
                onClick={() => {
                  setDialog(null);
                  void run(() => api("drive2/update", { ids: [dialog.item.id], color: c }));
                }}
                aria-label={c}
              >
                <FolderIcon color={c} size={40} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {preview && <Preview item={preview} onClose={() => setPreview(null)} onDownload={() => download([preview])} />}
    </div>
  );
}

/* --------------------------------------------------------------- Fenêtres */

function NameDialog({
  title,
  initial,
  submit,
  selectBase,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: string;
  submit: string;
  selectBase?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const dot = initial.lastIndexOf(".");
      el.setSelectionRange(0, selectBase && dot > 0 ? dot : initial.length);
    }, 60);
    return () => clearTimeout(t);
  }, [initial, selectBase]);
  return (
    <Modal title={title} close={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onSubmit(value)) onClose();
        }}
      >
        <label>
          Nom
          <input ref={ref} value={value} onChange={(e) => setValue(e.target.value)} maxLength={255} required />
        </label>
        <div className="modalButtonsRow">
          <button type="button" className="btnSecondary" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btnPrimary">
            {submit}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FolderPicker({
  title,
  tree,
  exclude,
  onClose,
  onPick,
}: {
  title: string;
  tree: TreeNode[];
  exclude: string[];
  onClose: () => void;
  onPick: (id: string | null) => Promise<boolean>;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const blocked = useMemo(() => {
    const out = new Set(exclude);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of tree)
        if (n.parentId && out.has(n.parentId) && !out.has(n.id)) {
          out.add(n.id);
          grew = true;
        }
    }
    return out;
  }, [tree, exclude]);
  const render = (pid: string | null, depth: number): React.ReactNode =>
    tree
      .filter((n) => n.parentId === pid && !blocked.has(n.id))
      .map((n) => (
        <div key={n.id}>
          <button type="button" className={`dPick ${target === n.id ? "active" : ""}`} style={{ paddingLeft: 12 + depth * 16 }} onClick={() => setTarget(n.id)}>
            <FolderIcon color={n.color} size={18} /> {n.name}
          </button>
          {render(n.id, depth + 1)}
        </div>
      ));
  return (
    <Modal title={title} close={onClose}>
      <div className="dPickList">
        <button type="button" className={`dPick ${target === null ? "active" : ""}`} onClick={() => setTarget(null)}>
          <HardDrive size={16} /> Mon Drive
        </button>
        {render(null, 1)}
      </div>
      <div className="modalButtonsRow">
        <button type="button" className="btnSecondary" onClick={onClose}>
          Annuler
        </button>
        <button
          type="button"
          className="btnPrimary"
          onClick={async () => {
            if (await onPick(target)) onClose();
          }}
        >
          Valider
        </button>
      </div>
    </Modal>
  );
}

/** Aperçu Word (.docx) rendu dans le navigateur, sans envoyer le fichier ailleurs. */
function DocxPreview({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ renderAsync }, res] = await Promise.all([import("docx-preview"), fetch(url, { credentials: "same-origin", headers: authHeaders() })]);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = "";
        await renderAsync(blob, ref.current, undefined, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          useBase64URL: true,
        });
        if (!cancelled) setState("ok");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);
  return (
    <div className="dDocx">
      {state === "loading" && (
        <div className="dPreviewNone">
          <Loader2 size={26} className="spin" /> <p>Ouverture du document…</p>
        </div>
      )}
      {state === "error" && (
        <div className="dPreviewNone">
          <p>Impossible d&apos;afficher ce document Word. Téléchargez-le pour l&apos;ouvrir.</p>
        </div>
      )}
      <div ref={ref} className="dDocxBody" hidden={state !== "ok"} />
    </div>
  );
}

function Preview({ item, onClose, onDownload }: { item: Entry; onClose: () => void; onDownload: () => void }) {
  const t = fileTypeInfo(item.name, item.mimeType);
  const src = `${item.url}?inline=1`;
  const mime = item.mimeType || "";
  let body: React.ReactNode;
  if (t.glyph === "image" && !/svg|heic|tif/i.test(t.ext)) {
    // eslint-disable-next-line @next/next/no-img-element
    body = <img src={src} alt={item.name} className="dPreviewMedia" />;
  } else if (t.glyph === "video" || mime.startsWith("video/")) {
    body = <video src={src} controls autoPlay className="dPreviewMedia" />;
  } else if (t.glyph === "audio" || mime.startsWith("audio/")) {
    body = <audio src={src} controls autoPlay />;
  } else if (t.ext === "pdf") {
    body = <iframe src={src} title={item.name} className="dPreviewFrame" />;
  } else if (t.ext === "docx") {
    body = <DocxPreview url={item.url!} />;
  } else if (t.ext === "doc") {
    body = (
      <div className="dPreviewNone">
        <FileTypeIcon name={item.name} mime={item.mimeType} size={72} />
        <p>Ancien format Word (.doc) : téléchargez-le pour l&apos;ouvrir, ou enregistrez-le en .docx pour l&apos;aperçu.</p>
      </div>
    );
  } else {
    body = (
      <div className="dPreviewNone">
        <FileTypeIcon name={item.name} mime={item.mimeType} size={72} />
        <p>Aperçu non disponible pour ce type de fichier.</p>
      </div>
    );
  }
  return (
    <div className="dPreview" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Aperçu de ${item.name}`}>
      <div className="dPreviewBar" onClick={(e) => e.stopPropagation()}>
        <FileTypeIcon name={item.name} mime={item.mimeType} size={22} />
        <strong>{item.name}</strong>
        <small>{formatBytes(item.size)}</small>
        <button type="button" className="btnSecondary" onClick={onDownload}>
          <Download size={15} /> Télécharger
        </button>
        <button type="button" className="dPreviewClose" onClick={onClose} aria-label="Fermer">
          <X size={18} />
        </button>
      </div>
      <div className="dPreviewBody" onClick={(e) => e.stopPropagation()}>
        {body}
      </div>
    </div>
  );
}

