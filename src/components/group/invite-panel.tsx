"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Link2, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { createInvitation, revokeInvitation } from "@/lib/actions/groups";
import { formatDateTime } from "@/lib/dates";
import type { Invitation } from "@/lib/types";

export function InvitePanel({
  groupId,
  groupName,
  invitations,
  meId,
  isAdmin,
  justCreated,
  approvalRequired,
}: {
  groupId: string;
  groupName: string;
  invitations: Invitation[];
  meId: string;
  isAdmin: boolean;
  justCreated?: boolean;
  approvalRequired: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [origin, setOrigin] = useState("");
  const [days, setDays] = useState("7");
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const latest = invitations[0];
  const url = (token: string) => `${origin}/invite/${token}`;
  const message = (token: string) => `「${groupName}」のお金の管理に WariNote を使います。こちらから参加してください👇\n${url(token)}`;

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(url(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("コピーできませんでした。リンクを長押ししてコピーしてください。");
    }
  }

  function create() {
    start(async () => {
      const r = await createInvitation(groupId, Number(days), null);
      if (!r.ok) return toast.error(r.error);
      toast.success("招待リンクを発行しました");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader title="メンバーを招待" description="リンクを LINE などで送ると、相手は自分のアカウントで参加できます" />
      <div className="space-y-4 px-5 pb-5 pt-4">
        {justCreated && (
          <Alert tone="success" title="グループを作成しました">
            下のボタンから招待リンクを作成して、メンバーに送りましょう。
          </Alert>
        )}
        {approvalRequired && <Alert tone="info">このグループは承認制です。リンクから参加申請があると、管理者に通知されます。</Alert>}

        {latest ? (
          <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-800">
              <Link2 className="size-4" /> 招待リンク
            </p>
            <p className="mt-2 break-all rounded-lg bg-white px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink-soft select-all">
              {origin ? url(latest.token) : "…"}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <a
                href={`https://line.me/R/msg/text/?${encodeURIComponent(message(latest.token))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#06C755] text-[13px] font-bold text-white hover:brightness-95"
              >
                LINEで送る
              </a>
              <Button size="sm" variant="outline" className="h-10" onClick={() => copy(latest.token)}>
                {copied === latest.token ? <Check className="text-brand-600" /> : <Copy />}
                {copied === latest.token ? "コピーしました" : "コピー"}
              </Button>
              {canShare && (
                <Button
                  size="sm"
                  variant="outline"
                  className="col-span-2 h-10 sm:col-span-1"
                  onClick={() => navigator.share({ title: `${groupName}への招待`, text: message(latest.token) }).catch(() => {})}
                >
                  <Share2 /> 共有
                </Button>
              )}
            </div>
            <p className="mt-2.5 text-[11px] text-muted">
              {formatDateTime(latest.expires_at)} まで有効・{latest.use_count}人が使用
            </p>
          </div>
        ) : (
          <p className="text-[13px] text-muted">有効な招待リンクはありません。</p>
        )}

        <div className="flex items-end gap-2">
          <div className="w-36">
            <label htmlFor="inv-days" className="mb-1 block text-[11px] font-semibold text-muted">
              有効期限
            </label>
            <Select id="inv-days" value={days} onChange={(e) => setDays(e.target.value)} className="h-10 text-sm">
              <option value="1">1日</option>
              <option value="7">7日</option>
              <option value="30">30日</option>
            </Select>
          </div>
          <Button variant={latest ? "secondary" : "primary"} className="h-10" onClick={create} loading={pending}>
            {latest ? "新しいリンクを作成" : "招待リンクを作成"}
          </Button>
        </div>

        {invitations.length > 0 && (
          <details className="group rounded-xl border border-line">
            <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold text-ink-soft">
              有効なリンク（{invitations.length}件）を管理
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">…{inv.token.slice(-10)}</span>
                  <span className="text-[11px] text-muted">{formatDateTime(inv.expires_at)}まで</span>
                  {(isAdmin || inv.created_by === meId) && (
                    <Button
                      size="sm"
                      variant="danger-ghost"
                      className="h-8 px-2"
                      aria-label="このリンクを無効にする"
                      onClick={() =>
                        start(async () => {
                          const r = await revokeInvitation(groupId, inv.id);
                          if (r.ok) toast.success(r.message ?? "無効にしました");
                          else toast.error(r.error);
                          router.refresh();
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Card>
  );
}
