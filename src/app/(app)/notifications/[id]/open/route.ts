import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid, safeNext } from "@/lib/utils";

/** 通知を既読にしてから、通知のリンク先へ移動する（RLS により本人の通知のみ対象） */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = new URL(request.url).origin;
  if (!isUuid(id)) return NextResponse.redirect(new URL("/notifications", origin));

  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .select("link")
    .maybeSingle();
  const link = safeNext((data as { link: string | null } | null)?.link ?? null, "/notifications");
  return NextResponse.redirect(new URL(link, origin));
}
