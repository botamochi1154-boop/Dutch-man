"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Crown, LogOut, ShieldCheck, Trash2, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Avatar, Badge } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { decideJoinRequest, deleteGroup, removeMember, setMemberRole } from "@/lib/actions/groups";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/dates";
import type { ActionResult, JoinRequest, Member, PeopleMap, Role } from "@/lib/types";

export function MemberManager({
  groupId,
  groupName,
  meId,
  myRole,
  members,
  people,
  requests,
  requesterNames,
  balances,
}: {
  groupId: string;
  groupName: string;
  meId: string;
  myRole: Role;
  members: Member[];
  people: PeopleMap;
  requests: JoinRequest[];
  requesterNames: PeopleMap;
  balances: Record<string, number>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const [confirm, setConfirm] = useState<null | { kind: "remove" | "leave" | "delete"; userId?: string }>(null);
  const isAdmin = myRole === "owner" || myRole === "admin";

  function run(key: string, fn: () => Promise<ActionResult>, after?: () => void) {
    setBusy(key);
    start(async () => {
      const r = await fn();
      setBusy(null);
      if (r && !r.ok) toast.error(r.error);
      else if (r?.ok) {
        if (r.message) toast.success(r.message);
        after?.();
        router.refresh();
      }
    });
  }

  const active = members.filter((m) => !m.left_at);
  const targetName = confirm?.userId ? (people[confirm.userId]?.display_name ?? "") : "";

  return (
    <>
      {isAdmin && requests.length > 0 && (
        <Card className="border-[#D6E3F3]">
          <CardHeader title={`参加申請（${requests.length}件）`} description="承認するとグループのデータを見られるようになります" />
          <ul className="mt-2 divide-y divide-line">
            {requests.map((r) => {
              const p = requesterNames[r.user_id];
              return (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={p?.display_name ?? "?"} color={p?.avatar_color ?? "#9aa5a0"} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{p?.display_name ?? "申請者"}</p>
                    <p className="text-[11px] text-muted">{formatDateTime(r.created_at)} に申請</p>
                  </div>
                  <Button size="sm" variant="ghost" loading={busy === `rej-${r.id}`} onClick={() => run(`rej-${r.id}`, () => decideJoinRequest(groupId, r.id, false))}>
                    見送る
                  </Button>
                  <Button size="sm" loading={busy === `ok-${r.id}`} onClick={() => run(`ok-${r.id}`, () => decideJoinRequest(groupId, r.id, true))}>
                    承認
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title={`メンバー（${active.length}人）`} />
        <ul className="mt-2 divide-y divide-line">
          {active.map((m) => {
            const p = people[m.user_id];
            const me = m.user_id === meId;
            const bal = balances[m.user_id] ?? 0;
            const canRemove = !me && isAdmin && m.role !== "owner" && !(m.role === "admin" && myRole !== "owner");
            return (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={p?.display_name ?? "?"} color={p?.avatar_color ?? "#9aa5a0"} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
                    {p?.display_name ?? "?"}
                    {me && <span className="text-xs font-normal text-muted">（あなた）</span>}
                    {m.role === "owner" && <Crown className="size-3.5 text-warn" aria-label="オーナー" />}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatDateTime(m.joined_at)} に参加
                    {bal !== 0 && <span className="ml-1">・未精算あり</span>}
                  </p>
                </div>
                {m.role !== "member" && <Badge tone={m.role === "owner" ? "warn" : "brand"}>{ROLE_LABELS[m.role]}</Badge>}
                {myRole === "owner" && !me && m.role !== "owner" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    title={m.role === "admin" ? "メンバーに戻す" : "管理者にする"}
                    aria-label={m.role === "admin" ? "メンバーに戻す" : "管理者にする"}
                    loading={busy === `role-${m.user_id}`}
                    onClick={() => run(`role-${m.user_id}`, () => setMemberRole(groupId, m.user_id, m.role === "admin" ? "member" : "admin"))}
                  >
                    <ShieldCheck />
                  </Button>
                )}
                {canRemove && (
                  <Button
                    size="sm"
                    variant="danger-ghost"
                    className="h-8 px-2"
                    aria-label="グループから外す"
                    onClick={() => setConfirm({ kind: "remove", userId: m.user_id })}
                  >
                    <UserMinus />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-5">
        <p className="text-[13px] font-bold text-ink-soft">グループの操作</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {myRole !== "owner" && (
            <Button variant="outline" size="sm" onClick={() => setConfirm({ kind: "leave" })}>
              <LogOut /> グループを退出
            </Button>
          )}
          {myRole === "owner" && (
            <Button variant="danger-ghost" size="sm" onClick={() => setConfirm({ kind: "delete" })}>
              <Trash2 /> グループを削除
            </Button>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          未精算の金額があるメンバーは、精算が完了するまで退出・削除できません（立替金の取りこぼしを防ぐため）。
        </p>
      </Card>

      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={
          confirm?.kind === "remove"
            ? `${targetName}さんをグループから外しますか？`
            : confirm?.kind === "leave"
              ? "グループを退出しますか？"
              : `「${groupName}」を削除しますか？`
        }
        description={
          confirm?.kind === "delete"
            ? "支出・精算・履歴を含むすべてのデータが完全に削除され、元に戻せません。全メンバーが閲覧できなくなります。"
            : confirm?.kind === "leave"
              ? "退出すると、このグループの情報は見られなくなります。もう一度参加するには招待リンクが必要です。"
              : "外されたメンバーは、このグループの情報を見られなくなります。過去の支出の記録は残ります。"
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              キャンセル
            </Button>
            <Button
              variant="danger"
              loading={busy === "confirm"}
              onClick={() => {
                if (!confirm) return;
                if (confirm.kind === "delete") run("confirm", () => deleteGroup(groupId));
                else if (confirm.kind === "leave") run("confirm", () => removeMember(groupId, meId, true));
                else if (confirm.userId) run("confirm", () => removeMember(groupId, confirm.userId!, false), () => setConfirm(null));
              }}
            >
              {confirm?.kind === "delete" ? "削除する" : confirm?.kind === "leave" ? "退出する" : "外す"}
            </Button>
          </>
        }
      />
    </>
  );
}
