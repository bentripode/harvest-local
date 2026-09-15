"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SellerAvatar } from "@/components/seller-avatar";
import { lineKey, useCart } from "@/components/cart-provider";
import { formatUsd } from "@/lib/money";

export default function CartPage() {
  const { cart, ready, subtotal, setQuantity, removeItem } = useCart();

  if (!ready) return null;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-dashed p-10 text-center">
        <p className="font-medium">Your basket is empty</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/shop">Find a local seller</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl sm:text-3xl">Basket</h1>

      <Link
        href={`/s/${cart.sellerSlug}`}
        className="flex items-center gap-3 rounded-2xl border p-3 no-underline"
      >
        <SellerAvatar name={cart.sellerName} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{cart.sellerName}</span>
        <span className="text-muted-foreground shrink-0 text-sm">Keep shopping →</span>
      </Link>

      {/*
        Each line is a two-row block rather than one five-column row. The old layout put the title,
        a unit price, a stepper, a line total and a Remove link on a single flex row: on a phone the
        title wrapped to three lines and the stepper and the total ended up on top of each other.
      */}
      <ul className="space-y-3">
        {cart.items.map((item) => (
          <li key={lineKey(item)} className="space-y-3 rounded-2xl border p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 font-medium">{item.title}</p>
              <p className="shrink-0 font-medium tabular-nums">
                {formatUsd(item.unitPrice * item.quantity)}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center rounded-full border">
                <button
                  type="button"
                  className="h-9 w-9 text-lg leading-none disabled:opacity-40"
                  onClick={() => setQuantity(lineKey(item), item.quantity - 1)}
                  aria-label={`Fewer ${item.title}`}
                >
                  −
                </button>
                <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                <button
                  type="button"
                  className="h-9 w-9 text-lg leading-none"
                  onClick={() => setQuantity(lineKey(item), item.quantity + 1)}
                  aria-label={`More ${item.title}`}
                >
                  +
                </button>
              </div>

              <span className="text-muted-foreground text-sm tabular-nums">
                {formatUsd(item.unitPrice)} each
              </span>

              <button
                type="button"
                className="text-muted-foreground hover:text-destructive ml-auto text-sm"
                onClick={() => removeItem(lineKey(item))}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/*
        The total sticks to the bottom of a phone screen so it stays with the button as the list
        grows. It clears the tab bar, which is fixed at the same edge.
      */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-14 z-20 space-y-3 border-t py-4 backdrop-blur-md md:static md:bottom-auto md:backdrop-blur-none">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground text-sm">Subtotal</span>
          <span className="text-xl font-semibold tabular-nums">{formatUsd(subtotal)}</span>
        </div>
        <Button asChild size="lg" variant="accent" className="w-full">
          <Link href="/checkout">Checkout</Link>
        </Button>
        {/* Rule 3: every figure above is the server's. Tax and any delivery fee are added there. */}
        <p className="text-muted-foreground text-center text-xs">
          Tax and delivery are worked out at checkout.
        </p>
      </div>
    </div>
  );
}
