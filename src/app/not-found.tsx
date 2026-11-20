import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <SearchX className="size-7" />
      </span>
      <h1 className="mt-4 text-xl font-extrabold text-ink">ページが見つかりません</h1>
      <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-muted">
        URL が間違っているか、参加していないグループの可能性があります。
      </p>
      <Link href="/dashboard" className={buttonVariants({ className: "mt-6" })}>
        ホームに戻る
      </Link>
    </div>
  );
}
