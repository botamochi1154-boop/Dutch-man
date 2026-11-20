import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/app/bits";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(70%_50%_at_50%_0%,#e3f3ea_0%,#f3f6f4_70%)]">
      <header className="flex h-16 items-center justify-center">
        <Link href="/" aria-label="トップへ">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:pt-10">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
