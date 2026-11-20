"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { acceptInvitation } from "@/lib/actions/groups";

export function JoinButton({ token, requiresApproval }: { token: string; requiresApproval: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (result?.ok) return <Alert tone="success">{result.text}</Alert>;
  return (
    <div className="space-y-3">
      {result && !result.ok && <Alert tone="danger">{result.text}</Alert>}
      <Button
        size="lg"
        className="w-full"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await acceptInvitation(token);
            if (r && !r.ok) setResult({ ok: false, text: r.error });
            else if (r?.ok) setResult({ ok: true, text: r.message ?? "参加しました。" });
          })
        }
      >
        {requiresApproval ? "参加を申請する" : "このグループに参加する"}
      </Button>
    </div>
  );
}
