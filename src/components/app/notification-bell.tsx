"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useSupabase } from "@/lib/supabase/client";

/** 未読数バッジ。自分宛ての通知を Realtime で受け取り即座に反映 */
export function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const supabase = useSupabase();
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);

  useEffect(() => setUnread(initialUnread), [initialUnread]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          setUnread((n) => n + 1);
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, router]);

  return (
    <Link
      href="/notifications"
      className="relative flex size-10 items-center justify-center rounded-xl text-ink-soft hover:bg-canvas"
      aria-label={unread > 0 ? `通知（未読${unread}件）` : "通知"}
    >
      <Bell className="size-[22px]" />
      {unread > 0 && (
        <span className="num absolute right-1 top-1 min-w-[18px] rounded-full bg-minus px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
