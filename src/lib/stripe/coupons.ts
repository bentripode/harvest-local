import "server-only";

import { stripe } from "@/lib/stripe/client";

/**
 * The buyer referral discount is applied as a reusable percent-off Stripe Coupon on the Checkout
 * Session (`discounts: [{ coupon }]`). One coupon per configured rate, id `buyer-referral-pct-<n>`,
 * created on first use. `duration: "once"` is a no-op for one-time payments but keeps the coupon
 * safe to reuse. Our DB still owns which seller earned the referral.
 */

const cache = new Map<number, string>();

export async function ensureBuyerDiscountCoupon(percent: number): Promise<string> {
  const pct = Math.round(percent);
  if (pct <= 0 || pct > 100) throw new Error(`Invalid discount percent: ${percent}`);

  const cached = cache.get(pct);
  if (cached) return cached;

  const id = `buyer-referral-pct-${pct}`;
  try {
    await stripe.coupons.retrieve(id);
  } catch {
    try {
      await stripe.coupons.create(
        {
          id,
          percent_off: pct,
          duration: "once",
          name: `Harvest Local referral — ${pct}% off`,
          metadata: { purpose: "buyer_referral_discount" },
        },
        { idempotencyKey: `buyer-coupon:${id}` },
      );
    } catch {
      // Another checkout raced us to the same fixed id, or a transient error. If it exists now
      // we're fine; otherwise this rethrows the real failure.
      await stripe.coupons.retrieve(id);
    }
  }

  cache.set(pct, id);
  return id;
}
