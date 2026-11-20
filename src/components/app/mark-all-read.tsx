"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/lib/actions/account";

export function MarkAllRead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          await markAllNotificationsRead();
          router.refresh();
        })
      }
    >
      <CheckCheck /> すべて既読
    </Button>
  );
}
