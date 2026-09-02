"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useCart } from "@/components/cart-provider";
import { CheckoutButton } from "@/components/checkout-button";
import { StatePicker } from "@/components/state-picker";
import { formatUsd } from "@/lib/money";
import { stateName } from "@/lib/geo/state";
import { repriceCartAction, type RepriceResult } from "@/app/(shop)/checkout/actions";

export default function CheckoutPage() {
  const { cart, ready } = useCart();

  const cartKey = useMemo(
    () =>
      cart && cart.items.length > 0
        ? `${cart.sellerId}|${cart.items.map((i) => `${i.productId}x${i.quantity}`).join(",")}`
        : "",
    [cart],
  );

  const [priced, setPriced] = useState<{ key: string; result: RepriceResult }>({
    key: "",
    result: { ok: false },
  });

  useEffect(() => {
    if (!cartKey || !cart) return;
    let cancelled = false;
    repriceCartAction({
      sellerId: cart.sellerId,
      items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    }).then((result) => {
      if (!cancelled) setPriced({ key: cartKey, result });
    });
    return () => {
      cancelled = true;
    };
  }, [cartKey, cart]);

  if (!ready) return <p className="text-muted-foreground text-sm">Loading…</p>;

  if (!cart || cart.items.length === 0) {
    return (
      <Panel>
        Your basket is empty.{" "}
        <Link href="/shop" className="underline">
          Find a seller
        </Link>
        .
      </Panel>
    );
  }

  if (priced.key !== cartKey) return <p className="text-muted-foreground text-sm">Loading…</p>;

  const result = priced.result;

  if (!result.ok) {
    return (
      <Panel>
        {result.error ?? "Something went wrong."}{" "}
        <Link href="/cart" className="underline">
          Back to basket
        </Link>
      </Panel>
    );
  }

  const needsState = !result.buyerState;
  const stateMismatch = !needsState && !result.inState;
  const blocked = needsState || stateMismatch || !result.sellerLive;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="text-muted-foreground text-sm">
          Pickup from {result.sellerName} · {stateName(result.sellerState)}
        </p>
      </div>

      <ul className="divide-y rounded-lg border">
        {result.lines?.map((l, i) => (
          <li key={i} className="flex items-center justify-between gap-4 p-3 text-sm">
            <span>
              {l.quantity} × {l.title}
            </span>
            <span className="tabular-nums">{formatUsd(l.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatUsd(result.subtotal ?? 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Sales tax</span>
          <span className="text-muted-foreground">calculated by Stripe at payment</span>
        </div>
      </div>

      {needsState ? (
        <div className="bg-muted/50 space-y-3 rounded-md border p-4">
          <p className="text-sm font-medium">Confirm your state to continue</p>
          <p className="text-muted-foreground text-sm">
            Orders stay within a single state. {result.sellerName} sells in{" "}
            {stateName(result.sellerState)}.
          </p>
          <StatePicker />
        </div>
      ) : stateMismatch ? (
        <p className="text-destructive rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          You&apos;re in {stateName(result.buyerState)} and this seller is in{" "}
          {stateName(result.sellerState)}. Harvest Local can&apos;t process cross-state orders.
        </p>
      ) : !result.sellerLive ? (
        <p className="text-destructive rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          This seller isn&apos;t accepting orders right now.
        </p>
      ) : null}

      <CheckoutButton disabled={blocked} />
      <p className="text-muted-foreground text-center text-xs">
        You&apos;ll be redirected to Stripe to pay. Your order is confirmed once payment clears.
      </p>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-dashed p-10 text-center text-sm">
      {children}
    </div>
  );
}
