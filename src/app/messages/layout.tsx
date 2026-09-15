import Link from "next/link";

import { requireUser } from "@/lib/auth";

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("/messages");
  const home = profile.role === "buyer" ? "/shop" : "/seller";

  return (
    <div className="flex min-h-full flex-col">
      {/* A stack screen, not a tab: you arrive here from somewhere and go back to it, so this
          keeps its own back-header rather than the tab bar. */}
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
            Harvest Local
          </Link>
          <Link href={home} className="text-muted-foreground text-sm hover:underline">
            ← Back
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
