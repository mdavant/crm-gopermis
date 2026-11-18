"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
export function Modal({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(
    <div className="modalBackdrop">
      <section
        ref={panel}
        tabIndex={-1}
        className={`modal card ${wide ? "modalWide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "Tab") {
            const nodes = panel.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
            );
            if (!nodes?.length) return;
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === panel.current)
            ) {
              e.preventDefault();
              last.focus();
            } else if (
              !e.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === panel.current)
            ) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="sectionHead">
          <h2>{title}</h2>
          <button onClick={close} aria-label="Fermer">
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}
