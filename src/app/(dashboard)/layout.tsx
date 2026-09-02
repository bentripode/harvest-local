import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("/seller");

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight">
              Harvest Local
            </Link>
            <nav className="text-muted-foreground flex items-center gap-4 text-sm">
              <Link href="/seller" className="hover:text-foreground">
                Overview
              </Link>
              <Link href="/seller/products" className="hover:text-foreground">
                Products
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {profile.display_name}
            </span>
            <form action="/auth/signout" method="post">
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
