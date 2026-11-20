"use client";

import { useEffect } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const config = /SUPABASE_URL/.test(error.message);
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-minus-soft text-minus">
        <WifiOff className="size-7" />
      </span>
      <h1 className="mt-4 text-xl font-extrabold text-ink">{config ? "初期設定が完了していません" : "読み込みに失敗しました"}</h1>
      <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
        {config
          ? "サーバーに SUPABASE_URL と SUPABASE_ANON_KEY が設定されていません。README の手順を確認してください。"
          : "通信状況を確認して、もう一度お試しください。問題が続く場合は時間をおいてアクセスしてください。"}
      </p>
      <Button onClick={reset} className="mt-6">
        <RefreshCw />
        再読み込み
      </Button>
    </div>
  );
}
