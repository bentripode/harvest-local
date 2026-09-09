"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { CalendarDays, Home, ShoppingBasket, Store, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";
import { TabBar, type Tab } from "@/components/tab-bar";

/**
 * The buyer app's chrome: a slim header on a phone, a full nav on a desktop, and five tabs at the
 * bottom of a handset.
 *
 * The header used to carry nine links and four buttons on one row. On a phone that is either a
 * scrolling strip nobody reads or a hamburger nobody opens, so almost all of it moved into the tab
 * bar, and what is left up top is the two things that are about *this* page rather than about
 * getting somewhere else: who you are, and the basket.
 */

export function ShopShell({
  user,
  isSeller,
  unreadMessages = 0,
}: {
  user: User | null;
  isSeller: boolean;
  unreadMessages?: number;
}) {
  const { itemCount, ready } = useCart();
  const pathname = usePathname();

  const count = ready ? itemCount : 0;

  // Five, and the fifth changes with who is looking: a signed-out visitor has no account to reach,
  // so that slot becomes the reason to make one.
  const tabs: Tab[] = [
    { href: "/", label: "Home", icon: Home },
    { href: "/shop", label: "Shop", icon: Store, matchNested: true },
    {
      href: "/events",
      label: "What's on",
      icon: CalendarDays,
      matchNested: true,
    },
    { href: "/cart", label: "Basket", icon: ShoppingBasket, badge: count },
    user
      ? { href: "/account", label: "You", icon: UserIcon, matchNested: true }
      : { href: "/login", label: "Sign in", icon: UserIcon },
  ];

  return (
    <>
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="font-heading shrink-0 text-lg font-semibold tracking-tight">
            Harvest Local
          </Link>

          {/* The full nav is a desktop affordance. On a phone these live in the tab bar. */}
          <nav className="text-muted-foreground hidden items-center gap-5 text-sm md:flex">
            <NavLink href="/shop" pathname={pathname}>
              Shop
            </NavLink>
            <NavLink href="/markets" pathname={pathname}>
              Markets
            </NavLink>
            <NavLink href="/events" pathname={pathname}>
              What&apos;s on
            </NavLink>
            {user ? (
              <>
                <NavLink href="/saved" pathname={pathname}>
                  Saved
                </NavLink>
                <NavLink href="/orders" pathname={pathname}>
                  Orders
                </NavLink>
                <NavLink href="/messages" pathname={pathname}>
                  Messages
                  {unreadMessages > 0 ? (
                    <span className="bg-accent text-accent-foreground ml-1.5 rounded-full px-1.5 text-xs font-semibold tabular-nums">
                      {unreadMessages}
                    </span>
                  ) : null}
                </NavLink>
                <NavLink href="/account" pathname={pathname}>
                  Account
                </NavLink>
              </>
            ) : null}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {/* Basket is in the tab bar on a phone, so it only shows up here on a desktop. */}
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link href="/cart">Basket{count > 0 ? ` (${count})` : ""}</Link>
            </Button>
            {user ? (
              <>
                {isSeller ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/seller">Sell</Link>
                  </Button>
                ) : null}
                <form action="/auth/signout" method="post" className="hidden md:block">
                  <Button variant="outline" size="sm" type="submit">
                    Sign out
                  </Button>
                </form>
              </>
            ) : (
              <Button asChild size="sm" variant="accent">
                <Link href="/login?next=/shop">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <TabBar tabs={tabs} />
    </>
  );
}

function NavLink({
  href,
  pathname,
  children,
}: {
  href: string;
  pathname: string;
  children: React.ReactNode;
}) {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={active ? "text-foreground font-medium" : "hover:text-foreground"}
    >
      {children}
    </Link>
  );
}
