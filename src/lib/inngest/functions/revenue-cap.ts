import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueNotificationForEach } from "@/lib/notifications/queue";

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

    // Warnings on the way up. `record_order_revenue` reports a milestone at most once per period,
    // so this fires and stays fired — a seller whose total dips on a refund and recovers is not
    // told twice about the same line.
    if (!result?.paused && (result?.cap_milestone || result?.license_milestone || result?.threshold_crossed)) {
      await step.run("queue-approach-notifications", async () => {
        const { data: seller } = await admin
          .from("seller_profiles")
          .select("id, profile_id, business_name, home_state")
          .eq("id", sellerId)
          .maybeSingle();
        if (!seller) return { queued: 0 };

        const base = {
          seller_id: seller.id,
          business_name: seller.business_name,
          state: seller.home_state,
          gross: result.gross,
        };

        // These go to the seller alone. An admin does not need telling that somebody is at 50% of
        // their cap — only that a storefront actually closed, which is the branch below.
        let queued = 0;
        if (result.cap_milestone) {
          await queueNotificationForEach(admin, [seller.profile_id], {
            template: "revenue_cap_approaching",
            payload: { ...base, pct: result.cap_milestone, cap: result.cap },
          });
          queued += 1;
        }
        // Crossing wins over approaching: being told "you are at 90% of the licensing point" in the
        // same breath as "you have passed it" would be noise.
        if (result.threshold_crossed) {
          await queueNotificationForEach(admin, [seller.profile_id], {
            template: "license_threshold_reached",
            payload: { ...base, threshold: result.threshold },
          });
          queued += 1;
        } else if (result.license_milestone) {
          await queueNotificationForEach(admin, [seller.profile_id], {
            template: "license_threshold_approaching",
            payload: { ...base, pct: result.license_milestone, threshold: result.threshold },
          });
          queued += 1;
        }
        return { queued };
      });
    }

    if (!result?.paused) {
      return {
        paused: false,
        gross: result?.gross ?? null,
        over: result?.over ?? false,
        capMilestone: result?.cap_milestone ?? null,
        licenseMilestone: result?.license_milestone ?? null,
        thresholdCrossed: result?.threshold_crossed ?? false,
      };
    }

    await step.run("queue-pause-notifications", async () => {
      const { data: seller } = await admin
        .from("seller_profiles")
        .select("id, profile_id, business_name, home_state")
        .eq("id", sellerId)
        .maybeSingle();
      if (!seller) return { queued: 0 };

      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");

      const recipients = [seller.profile_id, ...(admins ?? []).map((a) => a.id)];
      const payload = {
        seller_id: seller.id,
        business_name: seller.business_name,
        state: seller.home_state,
        gross: result.gross,
        cap: result.cap,
      };

      await queueNotificationForEach(admin, recipients, {
        template: "revenue_cap_reached",
        payload,
      });
      return { queued: new Set(recipients).size };
    });

    return { paused: true, gross: result.gross, cap: result.cap };
  },
);
