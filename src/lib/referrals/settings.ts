import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { stripeConfig } from "@/lib/stripe/config";
import type { Database } from "@/lib/db/types";

/**
 * The referral knobs, all admin-configured in `platform_settings` (no admin UI until Phase 5).
 *   buyer_referral_discount → {"type":"percent","value":10}
 *   seller_referral_reward  → {"threshold":3,"coupon":"FREE_MONTH_100"}
 *   referral_min_order      → {"cents":0}
 */
export interface ReferralConfig {
  discountPercent: number;
  threshold: number;
  rewardCoupon: string;
  minOrderCents: number;
}

const DEFAULTS: ReferralConfig = {
  discountPercent: 10,
  threshold: 3,
  rewardCoupon: stripeConfig.freeMonthCouponId,
  minOrderCents: 0,
};

/**
 * Pass a client for a non-request context (Inngest jobs, webhooks) — it can't use the
 * cookie-scoped server client. Defaults to the request client otherwise.
 */
export async function getReferralConfig(
  client?: SupabaseClient<Database>,
): Promise<ReferralConfig> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", ["buyer_referral_discount", "seller_referral_reward", "referral_min_order"]);

  const byKey = new Map((data ?? []).map((r) => [r.key, r.value as Record<string, unknown>]));
  const discount = byKey.get("buyer_referral_discount");
  const reward = byKey.get("seller_referral_reward");
  const minOrder = byKey.get("referral_min_order");

  return {
    discountPercent:
      discount?.type === "percent" && typeof discount.value === "number"
        ? discount.value
        : DEFAULTS.discountPercent,
    threshold:
      typeof reward?.threshold === "number" ? reward.threshold : DEFAULTS.threshold,
    rewardCoupon:
      typeof reward?.coupon === "string" ? reward.coupon : DEFAULTS.rewardCoupon,
    minOrderCents:
      typeof minOrder?.cents === "number" ? minOrder.cents : DEFAULTS.minOrderCents,
  };
}
