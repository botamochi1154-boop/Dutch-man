"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { GroupBadge } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { createGroup, updateGroup } from "@/lib/actions/groups";
import { GROUP_COLOR_KEYS, GROUP_COLORS, GROUP_ICON_KEYS, GROUP_ICONS } from "@/lib/constants";
import type { FormState, Group, GroupColor, GroupIconKey } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GroupForm({ group }: { group?: Group }) {
  const editing = !!group;
  const [state, action, pending] = useActionState<FormState, FormData>(editing ? updateGroup : createGroup, null);
  const [icon, setIcon] = useState<GroupIconKey>(group?.icon ?? "plane");
  const [color, setColor] = useState<GroupColor>(group?.color ?? "green");
  const [name, setName] = useState(group?.name ?? "");

  return (
    <form action={action} className="space-y-5">
      {editing && <input type="hidden" name="group_id" value={group.id} />}
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="color" value={color} />
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div className="flex items-center gap-4">
        <GroupBadge icon={icon} color={color} size={56} />
        <Field label="グループ名" htmlFor="name" className="flex-1">
          <Input
            id="name"
            name="name"
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：沖縄旅行 2026"
          />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink-soft">種類</p>
        <div className="grid grid-cols-4 gap-2">
          {GROUP_ICON_KEYS.map((k) => {
            const I = GROUP_ICONS[k].icon;
            const active = icon === k;
            return (
              <button
                type="button"
                key={k}
                onClick={() => setIcon(k)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border py-2.5 text-[11px] font-semibold transition",
                  active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink-soft hover:bg-canvas",
                )}
              >
                <I className="size-5" />
                {GROUP_ICONS[k].label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink-soft">カラー</p>
        <div className="flex flex-wrap gap-2.5">
          {GROUP_COLOR_KEYS.map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setColor(k)}
              aria-label={GROUP_COLORS[k].label}
              aria-pressed={color === k}
              className={cn(
                "flex size-9 items-center justify-center rounded-full ring-offset-2 transition",
                color === k && "ring-2 ring-ink/70",
              )}
              style={{ backgroundColor: GROUP_COLORS[k].fg }}
            >
              {color === k && <Check className="size-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      <Field label="説明" htmlFor="description" optional>
        <Textarea id="description" name="description" maxLength={200} defaultValue={group?.description ?? ""} placeholder="例：11/20〜11/23 の4人旅" className="min-h-20" />
      </Field>

      {editing && (
        <>
          <Field label="精算期限" htmlFor="settlement_due_date" optional hint="期限の3日前から、未払いのメンバーに通知が届きます">
            <Input id="settlement_due_date" name="settlement_due_date" type="date" defaultValue={group.settlement_due_date ?? ""} />
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5">
            <input
              type="checkbox"
              name="join_approval_required"
              defaultChecked={group.join_approval_required}
              className="mt-0.5 size-5 accent-brand-600"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">参加を承認制にする</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                招待リンクから参加しようとした人を、管理者が承認するまで参加させません。
              </span>
            </span>
          </label>
        </>
      )}

      <Button type="submit" size="lg" className="w-full sm:w-auto sm:px-8" loading={pending}>
        {editing ? "設定を保存" : "グループを作成"}
      </Button>
    </form>
  );
}
