"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; tone: "success" | "error"; text: string };
const ToastContext = createContext<(tone: Toast["tone"], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 lg:top-auto lg:bottom-6 lg:items-end lg:pr-8"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-2xl px-4 py-3 text-[13px] font-medium shadow-lg animate-in-down",
              t.tone === "success" ? "bg-ink text-white" : "bg-minus text-white",
            )}
          >
            {t.tone === "success" ? (
              <CircleCheck className="mt-px size-[18px] shrink-0 text-brand-300" />
            ) : (
              <CircleAlert className="mt-px size-[18px] shrink-0" />
            )}
            <span className="leading-relaxed">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  return {
    success: (text: string) => push("success", text),
    error: (text: string) => push("error", text),
  };
}
