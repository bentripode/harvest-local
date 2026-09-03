import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getReferralConfig } from "@/lib/referrals/settings";
import type { PromoCode, ReferralCycle } from "@/lib/db/types";

export async function getSellerPromoCodes(sellerId: string): Promise<PromoCode[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export interface ContributingReferral {
  id: string;
  buyerName: string;
  orderId: string;
  activatedAt: string | null;
  discountAmount: string;
}

export interface ReferralProgress {
  threshold: number;
  cycle: ReferralCycle | null;
  count: number;
  rewardGranted: boolean;
  projectedFreeMonth: string | null;
  contributing: ContributingReferral[];
}

export async function getReferralProgress(sellerId: string): Promise<ReferralProgress> {
  const supabase = await createClient();
  const { threshold } = await getReferralConfig();

  const { data: cycle } = await supabase
    .from("referral_cycles")
    .select("*")
    .eq("seller_id", sellerId)
    .is("closed_at", null)
    .maybeSingle();

  if (!cycle) {
    return { threshold, cycle: null, count: 0, rewardGranted: false, projectedFreeMonth: null, contributing: [] };
  }

  const { data: refs } = await supabase
    .from("referrals")
    .select("id, order_id, activated_at, discount_amount, buyer:profiles!referrals_buyer_id_fkey(display_name)")
    .eq("cycle_id", cycle.id)
    .eq("status", "active")
    .order("activated_at", { ascending: false });

  return {
    threshold,
    cycle,
    count: cycle.active_referral_count,
    rewardGranted: cycle.reward_granted,
    projectedFreeMonth: cycle.period_end,
    contributing: (refs ?? []).map((r) => ({
      id: r.id,
      buyerName: (r.buyer as { display_name?: string } | null)?.display_name ?? "Buyer",
      orderId: r.order_id,
      activatedAt: r.activated_at,
      discountAmount: r.discount_amount,
    })),
  };
}
