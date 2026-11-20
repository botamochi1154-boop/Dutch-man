import type { ReactNode } from "react";

export function AuthCard({ title, description, children, footer }: { title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <div className="rounded-3xl border border-line bg-white p-6 shadow-[0_20px_50px_-30px_rgb(16_40_30/0.35)] sm:p-8">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 text-center text-[13px] text-ink-soft">{footer}</div>}
    </>
  );
}
