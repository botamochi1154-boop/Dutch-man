"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** 下からせり上がるボトムシート（スマホ）／中央モーダル（PC） */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button aria-label="閉じる" className="absolute inset-0 bg-[#0d1a14]/40 backdrop-blur-[2px] animate-in-fade" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl outline-none animate-in-up sm:rounded-3xl sm:pb-5",
          className,
        )}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-bold text-ink">{title}</h2>
            {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="-m-1 rounded-lg p-1 text-muted hover:bg-canvas" aria-label="閉じる">
            <X className="size-5" />
          </button>
        </div>
        {children && <div className="mt-4">{children}</div>}
        {footer && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}
