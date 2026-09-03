"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";

/** Header for the buyer-facing shop. Shows a live basket count from `useCart`. */
export function ShopHeader({
  user,
  isSeller,
  unreadMessages = 0,
}: {
  user: User | null;
  isSeller: boolean;
  unreadMessages?: number;
}) {
  const { itemCount, ready } = useCart();

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            Harvest Local
          </Link>
          <nav className="text-muted-foreground flex items-center gap-4 text-sm">
            <Link href="/shop" className="hover:text-foreground">
              Shop
            </Link>
            {user ? (
              <>
                <Link href="/orders" className="hover:text-foreground">
                  My orders
                </Link>
                <Link href="/messages" className="hover:text-foreground">
                  Messages
                  {unreadMessages > 0 ? (
                    <span className="bg-primary text-primary-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums">
                      {unreadMessages}
                    </span>
                  ) : null}
                </Link>
              </>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/cart">Basket{ready && itemCount > 0 ? ` (${itemCount})` : ""}</Link>
          </Button>
          {user ? (
            <>
              {isSeller ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/seller">Sell</Link>
                </Button>
              ) : null}
              <form action="/auth/signout" method="post">
                <Button variant="outline" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login?next=/shop">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
