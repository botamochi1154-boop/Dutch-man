"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert, Avatar } from "@/components/ui/misc";
import { updateProfile } from "@/lib/actions/account";
import { AVATAR_COLORS } from "@/lib/constants";
import type { FormState } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProfileForm({ name, color }: { name: string; color: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, null);
  const [n, setN] = useState(name);
  const [c, setC] = useState(color);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="avatar_color" value={c} />
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}
      <div className="flex items-center gap-4">
        <Avatar name={n || "?"} color={c} size={56} />
        <Field label="表示名" htmlFor="display_name" className="flex-1">
          <Input id="display_name" name="display_name" value={n} onChange={(e) => setN(e.target.value)} maxLength={30} required />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {AVATAR_COLORS.map((col) => (
          <button
            key={col}
            type="button"
            onClick={() => setC(col)}
            aria-label={`色 ${col}`}
            aria-pressed={c === col}
            className={cn("flex size-8 items-center justify-center rounded-full ring-offset-2", c === col && "ring-2 ring-ink/70")}
            style={{ backgroundColor: col }}
          >
            {c === col && <Check className="size-4 text-white" strokeWidth={3} />}
          </button>
        ))}
      </div>
      <Button type="submit" loading={pending}>
        保存
      </Button>
    </form>
  );
}
