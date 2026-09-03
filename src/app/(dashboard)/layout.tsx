import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PauseBanner } from "@/components/pause-banner";
import { getSellerContext } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/compliance";
import { getUnreadMessageCount } from "@/lib/messages/queries";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, seller } = await getSellerContext();
  const [unread, unreadMessages] = await Promise.all([
    seller ? getUnreadNotificationCount(profile.id) : Promise.resolve(0),
    getUnreadMessageCount(profile.id),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-6">
          <Link href="/" className="shrink-0 font-semibold tracking-tight">
            Harvest Local
          </Link>
          <nav className="text-muted-foreground flex min-w-0 flex-1 items-center gap-4 overflow-x-auto text-sm whitespace-nowrap">
            <Link href="/seller" className="hover:text-foreground shrink-0">
              Overview
            </Link>
            <Link href="/seller/products" className="hover:text-foreground shrink-0">
              Products
            </Link>
            <Link href="/seller/orders" className="hover:text-foreground shrink-0">
              Orders
            </Link>
            <Link href="/seller/referrals" className="hover:text-foreground shrink-0">
              Referrals
            </Link>
            <Link href="/seller/compliance" className="hover:text-foreground shrink-0">
              Compliance
              {unread > 0 ? (
                <span className="bg-primary text-primary-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums">
                  {unread}
                </span>
              ) : null}
            </Link>
            <Link href="/seller/settings" className="hover:text-foreground shrink-0">
              Settings
            </Link>
            <Link href="/messages" className="hover:text-foreground shrink-0">
              Messages
              {unreadMessages > 0 ? (
                <span className="bg-primary text-primary-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums">
                  {unreadMessages}
                </span>
              ) : null}
            </Link>
            {profile.role === "admin" ? (
              <Link href="/admin" className="hover:text-foreground shrink-0">
                Admin
              </Link>
            ) : null}
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-muted-foreground hidden text-sm md:inline">
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
