"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";

/** Header for the buyer-facing shop. Shows a live basket count from `useCart`. */
export function ShopHeader({ user }: { user: User | null }) {
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
              <Link href="/orders" className="hover:text-foreground">
                My orders
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/cart">Basket{ready && itemCount > 0 ? ` (${itemCount})` : ""}</Link>
          </Button>
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/seller">Sell</Link>
              </Button>
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
