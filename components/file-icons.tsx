"use client";
import React from "react";

/** Types reconnus → couleur et libellé (aux couleurs usuelles des formats). */
const TYPES: Record<string, { color: string; label: string; glyph: "doc" | "sheet" | "slide" | "pdf" | "image" | "video" | "audio" | "zip" | "code" | "text" | "file" }> = {
  pdf: { color: "#E5322D", label: "PDF", glyph: "pdf" },
  doc: { color: "#2B579A", label: "DOC", glyph: "doc" },
  docx: { color: "#2B579A", label: "DOCX", glyph: "doc" },
  odt: { color: "#2B579A", label: "ODT", glyph: "doc" },
  rtf: { color: "#2B579A", label: "RTF", glyph: "doc" },
  pages: { color: "#F39A2B", label: "PAGES", glyph: "doc" },
  xls: { color: "#217346", label: "XLS", glyph: "sheet" },
  xlsx: { color: "#217346", label: "XLSX", glyph: "sheet" },
  ods: { color: "#217346", label: "ODS", glyph: "sheet" },
  csv: { color: "#1D8F5A", label: "CSV", glyph: "sheet" },
  numbers: { color: "#1DB74F", label: "NUM", glyph: "sheet" },
  ppt: { color: "#C43E1C", label: "PPT", glyph: "slide" },
  pptx: { color: "#C43E1C", label: "PPTX", glyph: "slide" },
  odp: { color: "#C43E1C", label: "ODP", glyph: "slide" },
  key: { color: "#1A8CFF", label: "KEY", glyph: "slide" },
  png: { color: "#8B5CF6", label: "PNG", glyph: "image" },
  jpg: { color: "#8B5CF6", label: "JPG", glyph: "image" },
  jpeg: { color: "#8B5CF6", label: "JPG", glyph: "image" },
  gif: { color: "#8B5CF6", label: "GIF", glyph: "image" },
  webp: { color: "#8B5CF6", label: "WEBP", glyph: "image" },
  svg: { color: "#F59E0B", label: "SVG", glyph: "image" },
  heic: { color: "#8B5CF6", label: "HEIC", glyph: "image" },
  avif: { color: "#8B5CF6", label: "AVIF", glyph: "image" },
  bmp: { color: "#8B5CF6", label: "BMP", glyph: "image" },
  tif: { color: "#8B5CF6", label: "TIF", glyph: "image" },
  tiff: { color: "#8B5CF6", label: "TIFF", glyph: "image" },
  mp4: { color: "#DB2777", label: "MP4", glyph: "video" },
  mov: { color: "#DB2777", label: "MOV", glyph: "video" },
  avi: { color: "#DB2777", label: "AVI", glyph: "video" },
  mkv: { color: "#DB2777", label: "MKV", glyph: "video" },
  webm: { color: "#DB2777", label: "WEBM", glyph: "video" },
  m4v: { color: "#DB2777", label: "M4V", glyph: "video" },
  wmv: { color: "#DB2777", label: "WMV", glyph: "video" },
  mp3: { color: "#0EA5E9", label: "MP3", glyph: "audio" },
  wav: { color: "#0EA5E9", label: "WAV", glyph: "audio" },
  m4a: { color: "#0EA5E9", label: "M4A", glyph: "audio" },
  aac: { color: "#0EA5E9", label: "AAC", glyph: "audio" },
  ogg: { color: "#0EA5E9", label: "OGG", glyph: "audio" },
  flac: { color: "#0EA5E9", label: "FLAC", glyph: "audio" },
  zip: { color: "#A16207", label: "ZIP", glyph: "zip" },
  rar: { color: "#A16207", label: "RAR", glyph: "zip" },
  "7z": { color: "#A16207", label: "7Z", glyph: "zip" },
  tar: { color: "#A16207", label: "TAR", glyph: "zip" },
  gz: { color: "#A16207", label: "GZ", glyph: "zip" },
  txt: { color: "#64748B", label: "TXT", glyph: "text" },
  md: { color: "#64748B", label: "MD", glyph: "text" },
  json: { color: "#0F766E", label: "JSON", glyph: "code" },
  html: { color: "#EA580C", label: "HTML", glyph: "code" },
  xml: { color: "#0F766E", label: "XML", glyph: "code" },
};

export function fileTypeInfo(name: string, mime?: string | null) {
  const ext = (name.includes(".") ? name.split(".").pop()! : "").toLowerCase();
  if (TYPES[ext]) return { ext, ...TYPES[ext] };
  if (mime?.startsWith("image/")) return { ext, color: "#8B5CF6", label: ext.toUpperCase().slice(0, 4) || "IMG", glyph: "image" as const };
  if (mime?.startsWith("video/")) return { ext, color: "#DB2777", label: ext.toUpperCase().slice(0, 4) || "VID", glyph: "video" as const };
  if (mime?.startsWith("audio/")) return { ext, color: "#0EA5E9", label: ext.toUpperCase().slice(0, 4) || "SON", glyph: "audio" as const };
  return { ext, color: "#94A3B8", label: ext.toUpperCase().slice(0, 4) || "FICH", glyph: "file" as const };
}

function Glyph({ kind }: { kind: string }) {
  const s = { fill: "none", stroke: "#fff", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "doc":
      return (
        <g {...s}>
          <path d="M9.5 15.5l1.5 6 2-5 2 5 1.5-6" />
        </g>
      );
    case "sheet":
      return (
        <g {...s}>
          <rect x="9" y="15" width="8" height="7" rx="0.8" />
          <path d="M9 18.5h8M13 15v7" />
        </g>
      );
    case "slide":
      return (
        <g {...s}>
          <rect x="8.5" y="15" width="9" height="6" rx="0.8" />
          <path d="M13 21v1.8M11 22.8h4" />
        </g>
      );
    case "pdf":
      return (
        <g {...s}>
          <path d="M10.5 22c1.5-2.5 3.5-6 3-7.5-.4-1.2-1.6-.3-1 1.3.7 1.8 2.6 4 4.5 4.3 1.4.2 1.2-1-.3-1-2 0-4.6 1.2-6.2 2.9" />
        </g>
      );
    case "image":
      return (
        <g {...s}>
          <rect x="8.5" y="15" width="9" height="7" rx="1" />
          <path d="M8.5 21l3-3 2 2 1.5-1.5 2.5 2.5" />
          <circle cx="15.3" cy="16.9" r="0.7" fill="#fff" stroke="none" />
        </g>
      );
    case "video":
      return <path d="M11.5 15.3v6.4l5-3.2z" fill="#fff" />;
    case "audio":
      return (
        <g {...s}>
          <path d="M11.5 21.3V15.8l5-1v5.2" />
          <circle cx="10.6" cy="21.4" r="1" fill="#fff" />
          <circle cx="15.6" cy="20.2" r="1" fill="#fff" />
        </g>
      );
    case "zip":
      return (
        <g {...s}>
          <path d="M13 13.5v2M13 16.5v1.5M13 19v1" />
          <rect x="11.6" y="20" width="2.8" height="2.6" rx="0.6" />
        </g>
      );
    case "code":
      return (
        <g {...s}>
          <path d="M11 16l-2.2 2.5L11 21M15 16l2.2 2.5L15 21" />
        </g>
      );
    case "text":
      return (
        <g {...s}>
          <path d="M9 16h8M9 18.5h8M9 21h5" />
        </g>
      );
    default:
      return (
        <g {...s}>
          <path d="M9.5 18.5h7" />
        </g>
      );
  }
}

/** Icône de fichier : feuille à coin plié, bandeau couleur du format, pictogramme et extension. */
export function FileTypeIcon({ name, mime, size = 36 }: { name: string; mime?: string | null; size?: number }) {
  const t = fileTypeInfo(name, mime);
  const id = React.useId().replace(/:/g, "");
  return (
    <svg width={size} height={size * 1.18} viewBox="0 0 26 30.7" aria-label={`Fichier ${t.label}`} role="img" className="fileTypeIcon">
      <defs>
        <linearGradient id={`fg${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f1f5f9" />
        </linearGradient>
        <linearGradient id={`fc${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.color} stopOpacity="0.92" />
          <stop offset="1" stopColor={t.color} />
        </linearGradient>
      </defs>
      <path d="M3 1h13.5L24 8.5V28a1.8 1.8 0 0 1-1.8 1.8H3A1.8 1.8 0 0 1 1.2 28V2.8A1.8 1.8 0 0 1 3 1z" fill={`url(#fg${id})`} stroke="rgba(15,23,42,.14)" strokeWidth="0.8" />
      <path d="M16.5 1v5.7a1.8 1.8 0 0 0 1.8 1.8H24" fill="#e2e8f0" stroke="rgba(15,23,42,.14)" strokeWidth="0.8" />
      <rect x="4" y="12.5" width="18" height="12" rx="2.2" fill={`url(#fc${id})`} />
      <Glyph kind={t.glyph} />
      <text x="13" y="28.4" textAnchor="middle" fontSize={t.label.length > 4 ? 3.4 : 4} fontWeight="800" fill={t.color} fontFamily="Inter, system-ui, sans-serif">
        {t.label}
      </text>
    </svg>
  );
}

/** Icône de dossier en verre, teintée. */
export function FolderIcon({ color, size = 36, open = false }: { color?: string | null; size?: number; open?: boolean }) {
  const c = color || "var(--acc)";
  return (
    <svg width={size} height={size * 0.86} viewBox="0 0 28 24" aria-hidden="true" className="folderIcon">
      <path d="M2 4.2C2 3 3 2 4.2 2h6.3c.7 0 1.3.3 1.7.8l1.5 1.8h10.1C25 4.6 26 5.6 26 6.8V9H2z" fill={c} opacity="0.75" />
      <path
        d={open ? "M1.4 10.2C1.2 9 2.1 8 3.3 8h21.4c1.2 0 2.1 1 1.9 2.2l-1.6 10.1c-.2 1-1.1 1.7-2.1 1.7H5.1c-1 0-1.9-.7-2.1-1.7z" : "M2 8.4C2 7.2 3 6.2 4.2 6.2h19.6c1.2 0 2.2 1 2.2 2.2v11.4c0 1.2-1 2.2-2.2 2.2H4.2C3 22 2 21 2 19.8z"}
        fill={c}
      />
      <path d="M3 9h22" stroke="rgba(255,255,255,.45)" strokeWidth="0.9" />
    </svg>
  );
}
