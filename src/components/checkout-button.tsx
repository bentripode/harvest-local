"use client";

import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { startCheckoutAction } from "@/app/(shop)/checkout/actions";

/**
 * Serialises the localStorage basket into a hidden field and posts it to `startCheckoutAction`,
 * which re-prices everything server-side and redirects to Stripe.
 */
export function CheckoutButton({ disabled, label = "Pay with Stripe" }: { disabled?: boolean; label?: string }) {
  const { cart } = useCart();

  const payload = cart
    ? JSON.stringify({
        sellerId: cart.sellerId,
        items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      })
    : "";

  return (
    <form action={startCheckoutAction}>
      <input type="hidden" name="cart" value={payload} />
      <Button type="submit" disabled={disabled || !cart || cart.items.length === 0} className="w-full">
        {label}
      </Button>
    </form>
  );
}
