"use client";

import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { startCheckoutAction } from "@/app/(shop)/checkout/actions";

type Address = { line1: string; line2: string; city: string; state: string; postal: string };

/**
 * Serialises the localStorage basket (+ fulfillment choice) into a hidden field and posts it to
 * `startCheckoutAction`, which re-prices and re-quotes everything server-side and redirects to Stripe.
 */
export function CheckoutButton({
  disabled,
  label = "Pay with Stripe",
  promoCode,
  fulfillment = "pickup",
  deliveryAddress = null,
  deliveryWindow,
}: {
  disabled?: boolean;
  label?: string;
  promoCode?: string;
  fulfillment?: "pickup" | "delivery";
  deliveryAddress?: Address | null;
  deliveryWindow?: string;
}) {
  const { cart } = useCart();

  const payload = cart
    ? JSON.stringify({
        sellerId: cart.sellerId,
        items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        ...(promoCode ? { promoCode } : {}),
        fulfillment,
        ...(fulfillment === "delivery" && deliveryAddress
          ? {
              deliveryAddress: {
                line1: deliveryAddress.line1,
                line2: deliveryAddress.line2 || undefined,
                city: deliveryAddress.city,
                state: deliveryAddress.state,
                postal: deliveryAddress.postal,
              },
              ...(deliveryWindow ? { deliveryWindow } : {}),
            }
          : {}),
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
