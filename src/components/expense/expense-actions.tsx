"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { deleteExpense } from "@/lib/actions/expenses";

export function ExpenseActions({
  groupId,
  expenseId,
  title,
  settled,
}: {
  groupId: string;
  expenseId: string;
  title: string;
  settled: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex gap-2">
      <Link href={`/groups/${groupId}/expenses/${expenseId}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Pencil /> 編集
      </Link>
      <Button variant="danger-ghost" size="sm" onClick={() => setOpen(true)}>
        <Trash2 /> 削除
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="この支出を削除しますか？"
        description={`「${title}」を削除すると、全員の残高と精算額が自動で再計算されます。削除の記録は履歴に残ります。`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={settled && !confirm}
              onClick={() =>
                start(async () => {
                  const r = await deleteExpense(groupId, expenseId, confirm);
                  if (!r.ok) return setError(r.error);
                  toast.success(r.message ?? "削除しました");
                  router.push(`/groups/${groupId}/expenses`);
                })
              }
            >
              削除する
            </Button>
          </>
        }
      >
        {settled && (
          <Alert tone="warn" title="精算済みの期間の支出です">
            削除すると、すでに精算したメンバーとの間で返金などの精算が必要になる場合があります。
            <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="size-4 accent-brand-600" />
              理解したうえで削除する
            </label>
          </Alert>
        )}
        {error && (
          <Alert tone="danger" className="mt-3">
            {error}
          </Alert>
        )}
      </Dialog>
    </div>
  );
}
