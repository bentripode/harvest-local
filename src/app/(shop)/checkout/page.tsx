"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useCart } from "@/components/cart-provider";
import { CheckoutButton } from "@/components/checkout-button";
import { StatePicker } from "@/components/state-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd } from "@/lib/money";
import { stateName } from "@/lib/geo/state";
import { repriceCartAction, type RepriceResult } from "@/app/(shop)/checkout/actions";

type Address = { line1: string; line2: string; city: string; state: string; postal: string };

export default function CheckoutPage() {
  const { cart, ready } = useCart();
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");

  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [addr, setAddr] = useState<Address>({ line1: "", line2: "", city: "", state: "", postal: "" });
  const [appliedAddr, setAppliedAddr] = useState<Address | null>(null);

  const addrKey = appliedAddr ? JSON.stringify(appliedAddr) : "";
  const cartKey = useMemo(
    () =>
      cart && cart.items.length > 0
        ? `${cart.sellerId}|${cart.items.map((i) => `${i.productId}x${i.quantity}`).join(",")}|${appliedCode}|${fulfillment}|${addrKey}`
        : "",
    [cart, appliedCode, fulfillment, addrKey],
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
      promoCode: appliedCode || undefined,
      fulfillment,
      deliveryAddress:
        fulfillment === "delivery" && appliedAddr
          ? { ...appliedAddr, line2: appliedAddr.line2 || undefined }
          : undefined,
    }).then((result) => {
      if (!cancelled) setPriced({ key: cartKey, result });
    });
    return () => {
      cancelled = true;
    };
  }, [cartKey, cart, appliedCode, fulfillment, appliedAddr]);

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
  const promoOk = result.promo?.ok === true ? result.promo : null;
  const deliveryOk = result.delivery?.ok === true ? result.delivery : null;
  const deliveryError = result.delivery && !result.delivery.ok ? result.delivery.error : null;

  const deliveryUnresolved = fulfillment === "delivery" && (!appliedAddr || !deliveryOk);
  const blocked =
    needsState || stateMismatch || !result.sellerLive || deliveryUnresolved;

  const subtotal = result.subtotal ?? 0;
  const total = subtotal - (promoOk?.discountCents ?? 0) + (deliveryOk?.feeCents ?? 0);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="text-muted-foreground text-sm">
          {result.sellerName} · {stateName(result.sellerState)}
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

      {result.sellerDeliveryEnabled ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">How do you want it?</p>
          <div className="flex gap-2">
            {(["pickup", "delivery"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFulfillment(f)}
                className={`flex-1 rounded-md border p-2.5 text-sm capitalize ${
                  fulfillment === f ? "border-primary bg-primary/5 font-medium" : ""
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {fulfillment === "delivery" ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-2">
                <Label htmlFor="d-line1">Street address</Label>
                <Input
                  id="d-line1"
                  value={addr.line1}
                  onChange={(e) => setAddr({ ...addr, line1: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Unit (optional)"
                  value={addr.line2}
                  onChange={(e) => setAddr({ ...addr, line2: e.target.value })}
                />
                <Input
                  placeholder="City"
                  value={addr.city}
                  onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="State"
                  maxLength={2}
                  value={addr.state}
                  onChange={(e) => setAddr({ ...addr, state: e.target.value.toUpperCase() })}
                />
                <Input
                  placeholder="ZIP"
                  inputMode="numeric"
                  value={addr.postal}
                  onChange={(e) => setAddr({ ...addr, postal: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!addr.line1 || !addr.city || !addr.state || !addr.postal}
                onClick={() => setAppliedAddr(addr)}
              >
                Check delivery
              </Button>
              {deliveryOk ? (
                <p className="text-sm text-green-600">
                  Delivery to this address: {formatUsd(deliveryOk.feeCents)} ·{" "}
                  {deliveryOk.distanceMiles} mi
                </p>
              ) : deliveryError ? (
                <p className="text-destructive text-sm">{deliveryError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">Referral code</p>
        {promoOk ? (
          <div className="flex items-center justify-between rounded-md border border-green-600/30 bg-green-50 p-2.5 text-sm dark:bg-green-950/40">
            <span>
              <strong>{promoOk.code}</strong> applied — you save {formatUsd(promoOk.discountCents)}
            </span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-xs underline"
              onClick={() => {
                setAppliedCode("");
                setCodeInput("");
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Have a code from this seller?"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setAppliedCode(codeInput.trim())}
              disabled={!codeInput.trim()}
            >
              Apply
            </Button>
          </div>
        )}
        {result.promo && !result.promo.ok ? (
          <p className="text-destructive text-sm">{result.promo.error}</p>
        ) : null}
      </div>

      <div className="space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatUsd(subtotal)}</span>
        </div>
        {promoOk ? (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount ({promoOk.code})</span>
            <span className="tabular-nums">− {formatUsd(promoOk.discountCents)}</span>
          </div>
        ) : null}
        {deliveryOk ? (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Local delivery</span>
            <span className="tabular-nums">{formatUsd(deliveryOk.feeCents)}</span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Sales tax</span>
          <span className="text-muted-foreground">calculated by Stripe at payment</span>
        </div>
        <div className="flex justify-between border-t pt-1 font-semibold">
          <span>Total before tax</span>
          <span className="tabular-nums">{formatUsd(total)}</span>
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

      <CheckoutButton
        disabled={blocked}
        promoCode={promoOk?.code}
        fulfillment={fulfillment}
        deliveryAddress={fulfillment === "delivery" && deliveryOk ? appliedAddr : null}
      />
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
