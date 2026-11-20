"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const TABLES = ["expenses", "expense_splits", "settlements", "group_members", "activity_logs", "group_join_requests"] as const;

/**
 * 所属グループの変更を Supabase Realtime で購読し、画面を自動更新する。
 * 配信は RLS で絞り込まれるため、他グループの変更は届かない。
 */
export function RealtimeSync({ groupIds, showStatus }: { groupIds: string[]; showStatus?: boolean }) {
  const supabase = useSupabase();
  const router = useRouter();
  const [live, setLive] = useState(false);
  const key = [...groupIds].sort().join(",");

  useEffect(() => {
    if (!supabase || !key) return;
    const ids = key.split(",");
    const filter = ids.length === 1 ? `group_id=eq.${ids[0]}` : `group_id=in.(${ids.join(",")})`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    let channel = supabase.channel(`sync:${ids.length === 1 ? ids[0] : `${ids.length}groups:${ids[0]}`}`);
    for (const table of TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, refresh);
    }
    channel = channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "groups",
        filter: ids.length === 1 ? `id=eq.${ids[0]}` : `id=in.(${ids.join(",")})`,
      },
      refresh,
    );
    channel.subscribe((status) => setLive(status === "SUBSCRIBED"));

    // スマホでアプリに戻ってきたときは最新化
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [supabase, key, router]);

  if (!showStatus) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        live ? "bg-brand-50 text-brand-700" : "bg-canvas text-muted",
      )}
      title={live ? "他のメンバーの変更がすぐに反映されます" : "接続中…"}
    >
      <span className={cn("size-1.5 rounded-full", live ? "bg-brand-500 animate-pulse" : "bg-muted")} />
      {live ? "リアルタイム同期中" : "接続中"}
    </span>
  );
}
