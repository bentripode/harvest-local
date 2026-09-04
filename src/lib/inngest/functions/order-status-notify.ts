import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueNotification } from "@/lib/notifications/queue";

/**
 * On every `advance_order_status` transition (`harvest/order.status_changed`), email the buyer that
 * their order moved — Preparing / Ready / Out for delivery / Completed / Cancelled.
 *
 * Email only: there is no buyer-facing in-app panel today (the `notifications` in-app rows are read
 * by the seller compliance page). `queueNotification` nudges `notification-dispatch`, which renders
 * `order_status_changed` and sends via Resend keyed on the row id.
 *
 * A seller-board cancel is a distinct path from a Stripe refund (`charge.refunded` → `refund_issued`
 * to the buyer), so the two don't double up.
 */
export const orderStatusNotify = inngest.createFunction(
  {
    id: "order-status-notify",
    name: "Order status → buyer email",
    retries: 3,
    triggers: [{ event: "harvest/order.status_changed" }],
  },
  async ({ event, step }) => {
    const { orderId, buyerId, sellerId, toStatus, fulfillmentType } = event.data as {
      orderId: string;
      buyerId: string;
      sellerId: string;
      toStatus: string;
      fulfillmentType: string;
    };
    const admin = createAdminClient();

    const businessName = await step.run("load-seller-name", async () => {
      const { data, error } = await admin
        .from("seller_profiles")
        .select("business_name")
        .eq("id", sellerId)
        .single();
      if (error) throw new Error(error.message);
      return data.business_name;
    });

    await step.run("queue-buyer-email", async () => {
      await queueNotification(admin, {
        userId: buyerId,
        template: "order_status_changed",
        payload: {
          order_id: orderId,
          status: toStatus,
          fulfillment_type: fulfillmentType,
          business_name: businessName,
        },
        channels: ["email"],
      });
    });

    return { orderId, toStatus, notified: true };
  },
);
