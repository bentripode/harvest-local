import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueNotification } from "@/lib/notifications/queue";

/**
 * Email the recipient of a chat message — but only when it's their *only* unread message in the
 * thread, so an active back-and-forth doesn't fire an email per line. Email only (both parties
 * already have an unread badge in the nav; there's no buyer in-app panel).
 *
 * Idempotent: the `new_message` notification is deduped on `message_id` by a partial unique index,
 * so an Inngest retry after a mid-run failure is a no-op.
 */
export const messageNotify = inngest.createFunction(
  {
    id: "message-notify",
    name: "New message → email",
    retries: 3,
    triggers: [{ event: "harvest/message.sent" }],
  },
  async ({ event, step }) => {
    const { conversationId, messageId, senderId } = event.data as {
      conversationId: string;
      messageId: string;
      senderId: string;
    };
    const admin = createAdminClient();

    const target = await step.run("resolve-recipient", async () => {
      const { data, error } = await admin
        .from("conversations")
        .select(
          "buyer_id, order_id, seller:seller_profiles!conversations_seller_id_fkey(profile_id, business_name), buyer:profiles!conversations_buyer_id_fkey(display_name)",
        )
        .eq("id", conversationId)
        .single();
      if (error) throw new Error(error.message);

      const seller = data.seller as { profile_id?: string; business_name?: string } | null;
      const buyer = data.buyer as { display_name?: string } | null;
      const senderIsBuyer = senderId === data.buyer_id;

      return {
        recipientId: senderIsBuyer ? (seller?.profile_id ?? null) : data.buyer_id,
        senderName: senderIsBuyer ? (buyer?.display_name ?? "A buyer") : (seller?.business_name ?? "A seller"),
        orderRef: data.order_id ? data.order_id.slice(0, 8) : null,
      };
    });

    const recipientId = target.recipientId;
    if (!recipientId || recipientId === senderId) {
      return { skipped: "no distinct recipient" };
    }

    const unread = await step.run("count-recipient-unread", async () => {
      const { count } = await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", recipientId)
        .is("read_at", null);
      return count ?? 0;
    });

    if (unread > 1) {
      return { skipped: "recipient already has unread messages here" };
    }

    await step.run("queue-email", async () => {
      await queueNotification(admin, {
        userId: recipientId,
        template: "new_message",
        payload: {
          conversation_id: conversationId,
          message_id: messageId,
          sender_name: target.senderName,
          order_ref: target.orderRef,
        },
        channels: ["email"],
        tolerateDuplicate: true,
      });
    });

    return { notified: target.recipientId };
  },
);
