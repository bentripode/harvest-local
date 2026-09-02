import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * On `order -> completed`, add the order's goods total to the seller's yearly gross-revenue
 * tally. `record_order_revenue` does the tally AND the auto-pause atomically in SQL (a legal
 * guardrail, so it lives at the data layer); this function just fires on the event, calls it, and
 * queues notifications when the storefront gets paused. Idempotent per order.
 */
export const revenueCapCheck = inngest.createFunction(
  {
    id: "revenue-cap-check",
    name: "Revenue cap check",
    retries: 3,
    triggers: [{ event: "harvest/order.completed" }],
  },
  async ({ event, step }) => {
    const { orderId, sellerId } = event.data as { orderId: string; sellerId: string };
    const admin = createAdminClient();

    const result = await step.run("record-order-revenue", async () => {
      const { data, error } = await admin.rpc("record_order_revenue", {
        p_order_id: orderId,
      });
      if (error) throw new Error(error.message);
      return (Array.isArray(data) ? data[0] : data) ?? null;
    });

    if (!result?.paused) {
      return { paused: false, gross: result?.gross ?? null, over: result?.over ?? false };
    }

    await step.run("queue-pause-notifications", async () => {
      const { data: seller } = await admin
        .from("seller_profiles")
        .select("id, profile_id, business_name, home_state")
        .eq("id", sellerId)
        .maybeSingle();
      if (!seller) return { queued: 0 };

      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");

      const recipients = [
        ...new Set([seller.profile_id, ...(admins ?? []).map((a) => a.id)]),
      ];
      const payload = {
        seller_id: seller.id,
        business_name: seller.business_name,
        state: seller.home_state,
        gross: result.gross,
        cap: result.cap,
      };

      const { error } = await admin.from("notifications").insert(
        recipients.map((user_id) => ({
          user_id,
          channel: "in_app" as const,
          template: "revenue_cap_reached",
          payload,
        })),
      );
      if (error) throw new Error(error.message);
      return { queued: recipients.length };
    });

    return { paused: true, gross: result.gross, cap: result.cap };
  },
);
