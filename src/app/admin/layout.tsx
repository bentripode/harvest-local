import Link from "next/link";

import { requireRole } from "@/lib/auth";
import { getPendingLicenseCount } from "@/lib/licenses/queries";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");
  const pendingLicenses = await getPendingLicenseCount();

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
            <Link href="/admin/licenses" className="hover:text-foreground">
              Licenses
              {pendingLicenses > 0 ? (
                <span className="bg-primary text-primary-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums">
                  {pendingLicenses}
                </span>
              ) : null}
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
