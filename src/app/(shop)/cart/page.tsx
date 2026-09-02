"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";
import { formatUsd } from "@/lib/money";

export default function CartPage() {
  const { cart, ready, subtotal, setQuantity, removeItem } = useCart();

  if (!ready) return null;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-2 rounded-lg border border-dashed p-10 text-center">
        <p className="font-medium">Your basket is empty</p>
        <p className="text-muted-foreground text-sm">
          <Link href="/shop" className="underline">
            Find a local seller
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Basket</h1>
        <p className="text-muted-foreground text-sm">
          From{" "}
          <Link href={`/s/${cart.sellerSlug}`} className="underline">
            {cart.sellerName}
          </Link>
        </p>
      </div>

      <ul className="divide-y rounded-lg border">
        {cart.items.map((item) => (
          <li key={item.productId} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.title}</p>
              <p className="text-muted-foreground text-sm">{formatUsd(item.unitPrice)} each</p>
            </div>
            <div className="flex items-center rounded-md border">
              <button
                type="button"
                className="px-2 py-1 text-sm disabled:opacity-40"
                onClick={() => setQuantity(item.productId, item.quantity - 1)}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
              <button
                type="button"
                className="px-2 py-1 text-sm"
                onClick={() => setQuantity(item.productId, item.quantity + 1)}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <p className="w-20 text-right text-sm font-medium tabular-nums">
              {formatUsd(item.unitPrice * item.quantity)}
            </p>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive text-sm"
              onClick={() => removeItem(item.productId)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-muted-foreground text-sm">
          Subtotal (tax calculated at checkout)
        </span>
        <span className="text-lg font-semibold tabular-nums">{formatUsd(subtotal)}</span>
      </div>

      <Button asChild className="w-full">
        <Link href="/checkout">Proceed to checkout</Link>
      </Button>
    </div>
  );
}
