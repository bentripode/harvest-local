import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PauseBanner } from "@/components/pause-banner";
import { getSellerContext } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/compliance";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, seller } = await getSellerContext();
  const unread = seller ? await getUnreadNotificationCount(profile.id) : 0;

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
              <Link href="/seller/orders" className="hover:text-foreground">
                Orders
              </Link>
              <Link href="/seller/referrals" className="hover:text-foreground">
                Referrals
              </Link>
              <Link href="/seller/compliance" className="hover:text-foreground">
                Compliance
                {unread > 0 ? (
                  <span className="bg-primary text-primary-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums">
                    {unread}
                  </span>
                ) : null}
              </Link>
              <Link href="/seller/settings" className="hover:text-foreground">
                Settings
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
      <PauseBanner seller={seller} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
