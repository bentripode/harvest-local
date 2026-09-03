import "server-only";

import { createClient } from "@/lib/supabase/server";
import { percentOff, type Cents, cents } from "@/lib/money";
import { promoCodeSchema } from "@/lib/referrals/codes";
import { getReferralConfig } from "@/lib/referrals/settings";

export interface PromoValidation {
  ok: boolean;
  reason?: string;
  promoCodeId?: string;
  code?: string;
  discountPercent?: number;
  discountCents?: number;
}

/**
 * Every checkout-time gate for a referral code (§3.2 / §3.4), run as the signed-in buyer:
 * code exists & active, belongs to THIS seller, buyer isn't the seller, buyer hasn't already used
 * this seller's code (farming), and the basket clears the minimum. The discount here is a preview —
 * Stripe applies the coupon and the webhook snapshots the authoritative `discount_total`.
 */
export async function validatePromoCode(input: {
  code: string;
  cartSellerId: string;
  buyerId: string;
  subtotalCents: number;
}): Promise<PromoValidation> {
  // Validate the SHAPE before it touches the query: `code` goes into an equality filter, and an
  // unbounded/wildcard string here would let a buyer pattern-match codes they were never given.
  const parsed = promoCodeSchema.safeParse(input.code);
  if (!parsed.success) return { ok: false, reason: "That code isn't valid." };
  const code = parsed.data;

  const supabase = await createClient();
  const config = await getReferralConfig();

  const { data: promo } = await supabase
    .from("promo_codes")
    .select("id, seller_id, is_active, seller:seller_profiles!promo_codes_seller_id_fkey(profile_id, business_name)")
    .eq("code", code)
    .maybeSingle();

  if (!promo || !promo.is_active) return { ok: false, reason: "That code isn't valid." };

  if (promo.seller_id !== input.cartSellerId) {
    const name = (promo.seller as { business_name?: string } | null)?.business_name;
    return { ok: false, reason: name ? `That code is for ${name}.` : "That code isn't for this seller." };
  }

  const sellerProfileId = (promo.seller as { profile_id?: string } | null)?.profile_id;
  if (sellerProfileId && sellerProfileId === input.buyerId) {
    return { ok: false, reason: "You can't use your own referral code." };
  }

  const { data: prior } = await supabase
    .from("referrals")
    .select("id")
    .eq("seller_id", promo.seller_id)
    .eq("buyer_id", input.buyerId)
    .neq("status", "invalidated")
    .limit(1);
  if (prior && prior.length > 0) {
    return { ok: false, reason: "You've already used a code from this seller." };
  }

  if (config.minOrderCents > 0 && input.subtotalCents < config.minOrderCents) {
    return {
      ok: false,
      reason: `Referral codes need a minimum order of $${(config.minOrderCents / 100).toFixed(2)}.`,
    };
  }

  const discount: Cents = percentOff(cents(input.subtotalCents), config.discountPercent);

  return {
    ok: true,
    promoCodeId: promo.id,
    code,
    discountPercent: config.discountPercent,
    discountCents: discount,
  };
}
