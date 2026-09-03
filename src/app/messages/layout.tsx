import Link from "next/link";

import { requireUser } from "@/lib/auth";

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("/messages");
  const home = profile.role === "buyer" ? "/shop" : "/seller";

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-6">
          <Link href="/" className="font-semibold tracking-tight">
            Harvest Local
          </Link>
          <Link href={home} className="text-muted-foreground text-sm hover:underline">
            ← Back
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
