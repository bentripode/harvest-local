import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { stripeConfig } from "@/lib/stripe/config";

/**
 * On `order -> completed`: activate the order's referral and count it toward the seller's open
 * cycle (`activate_referral_for_order` does the DB work atomically). When that call REPORTS the
 * cycle just hit the threshold, attach FREE_MONTH_100 to the seller's subscription so the next
 * invoice renders $0 — and only then does `set_referral_reward_coupon` mark the cycle
 * `reward_granted` (together with the coupon id, in one statement). So "reward_granted = true"
 * always implies the coupon is really attached; a permanently failed attach leaves the cycle
 * un-granted and re-attempts on the next activation, with `onFailure` flagging an admin.
 *
 * Idempotent: the RPC no-ops on a non-`pending` referral, the Stripe write is keyed on `cycle_id`,
 * and the mark is a plain UPDATE.
 */
export const referralActivate = inngest.createFunction(
  {
    id: "referral-activate",
    name: "Referral activate",
    retries: 3,
    triggers: [{ event: "harvest/order.completed" }],
    onFailure: async ({ event, error }) => {
      // All retries exhausted. If a reward was earned but the coupon never attached, the cycle is
      // (correctly) still un-granted — but the seller is owed a free month. Flag admins.
      const { orderId } = event.data.event.data as { orderId: string; sellerId: string };
      const admin = createAdminClient();
      console.error(`[referral-activate] permanently failed for order ${orderId}: ${error.message}`);
      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
      if (!admins?.length) return;
      await admin.from("notifications").insert(
        admins.map((a) => ({
          user_id: a.id,
          channel: "in_app" as const,
          template: "referral_reward_attach_failed",
          payload: { order_id: orderId, error: error.message },
        })),
      );
    },
  },
  async ({ event, step }) => {
    const { orderId } = event.data as { orderId: string; sellerId: string };
    const admin = createAdminClient();

    const result = await step.run("activate-referral", async () => {
      const { data, error } = await admin.rpc("activate_referral_for_order", {
        p_order_id: orderId,
      });
      if (error) throw new Error(error.message);
      return (Array.isArray(data) ? data[0] : data) ?? null;
    });

    if (!result) return { activated: false };
    if (!result.granted) {
      return { activated: true, count: result.cycle_count, granted: false };
    }

    if (!result.reward_subscription || !result.reward_cycle_id) {
      throw new Error("Reward earned but the seller has no subscription id on file.");
    }

    await step.run("attach-free-month-coupon", async () => {
      await stripe.subscriptions.update(
        result.reward_subscription as string,
        { discounts: [{ coupon: stripeConfig.freeMonthCouponId }] },
        { idempotencyKey: `reward:${result.reward_cycle_id}` },
      );
      // Marks reward_granted = true AND reward_stripe_coupon_id in one statement — only reached
      // once the coupon is on the subscription.
      const { error } = await admin.rpc("set_referral_reward_coupon", {
        p_cycle_id: result.reward_cycle_id as string,
        p_coupon_id: stripeConfig.freeMonthCouponId,
      });
      if (error) throw new Error(error.message);
    });

    await step.run("notify-seller", async () => {
      const { data: seller } = await admin
        .from("seller_profiles")
        .select("profile_id")
        .eq("id", result.reward_seller_id as string)
        .maybeSingle();
      if (!seller) return { queued: 0 };
      const { error } = await admin.from("notifications").insert({
        user_id: seller.profile_id,
        channel: "in_app",
        template: "referral_reward_earned",
        payload: { cycle_id: result.reward_cycle_id, threshold: result.cycle_threshold },
      });
      if (error) throw new Error(error.message);
      return { queued: 1 };
    });

    return { activated: true, granted: true, count: result.cycle_count };
  },
);
