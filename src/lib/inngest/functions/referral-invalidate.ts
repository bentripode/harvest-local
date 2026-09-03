import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueNotificationForEach } from "@/lib/notifications/queue";

/**
 * On `order -> cancelled` (seller board, still `pending`) or `order.refunded` (Stripe webhook, a
 * full refund or dispute on an order that may already be `active`): invalidate the order's referral
 * and decrement its cycle count (`invalidate_referral_for_order`). The clawback policy (§3.4) is
 * NOT to revoke an already-issued free month — if a granted reward's count drops below the
 * threshold, flag admins for review.
 */
export const referralInvalidate = inngest.createFunction(
  {
    id: "referral-invalidate",
    name: "Referral invalidate",
    retries: 3,
    triggers: [{ event: "harvest/order.cancelled" }, { event: "harvest/order.refunded" }],
  },
  async ({ event, step }) => {
    const { orderId } = event.data as { orderId: string; sellerId: string };
    const reason = event.name === "harvest/order.refunded" ? "order_refunded" : "order_cancelled";
    const admin = createAdminClient();

    const result = await step.run("invalidate-referral", async () => {
      const { data, error } = await admin.rpc("invalidate_referral_for_order", {
        p_order_id: orderId,
        p_reason: reason,
      });
      if (error) throw new Error(error.message);
      return (Array.isArray(data) ? data[0] : data) ?? null;
    });

    if (!result?.reward_at_risk) {
      return { invalidated: !!result, rewardAtRisk: false };
    }

    await step.run("flag-admin-review", async () => {
      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
      if (!admins?.length) return { queued: 0 };
      await queueNotificationForEach(
        admin,
        admins.map((a) => a.id),
        { template: "referral_reward_review", payload: { seller_id: result.ref_seller_id, order_id: orderId, reason } },
      );
      return { queued: admins.length };
    });

    return { invalidated: true, rewardAtRisk: true };
  },
);
