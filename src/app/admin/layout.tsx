import Link from "next/link";

import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-6 px-6">
          <Link href="/" className="shrink-0 font-semibold tracking-tight">
            Harvest Local <span className="text-muted-foreground font-normal">· Admin</span>
          </Link>
          <nav className="text-muted-foreground flex items-center gap-4 text-sm">
            <Link href="/admin" className="hover:text-foreground">
              Reports
            </Link>
            <Link href="/admin/analytics" className="hover:text-foreground">
              Analytics
            </Link>
            <Link href="/admin/settings" className="hover:text-foreground">
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
