import "server-only";

import { Inngest } from "inngest";

import { env } from "@/lib/env";

/**
 * Inngest is the durable background-job runtime (ARCHITECTURE.md §1.6). It carries the compliance
 * checks (revenue caps, license expiry) and, later, referral activation and notification fan-out.
 *
 * Local dev: `npm run inngest:dev` starts the Dev Server, which discovers `/api/inngest` and
 * receives events sent from here — no keys needed. In production the Event Key authenticates
 * `inngest.send()` and the Signing Key (read by `serve`) authenticates incoming executions.
 */
export const inngest = new Inngest({
  id: "harvest-local",
  eventKey: env.INNGEST_EVENT_KEY,
  // Dev Mode in `next dev` (no signature checks, talks to the local Dev Server); cloud mode in
  // production, where INNGEST_SIGNING_KEY is required. Set INNGEST_DEV=1 to force dev elsewhere.
  isDev: process.env.INNGEST_DEV === "1" || env.NODE_ENV !== "production",
});

/** Payloads for our events. Kept here since the v4 client no longer takes a schema map. */
export interface OrderCompletedEvent {
  name: "harvest/order.completed";
  data: { orderId: string; sellerId: string };
}

export interface OrderCancelledEvent {
  name: "harvest/order.cancelled";
  data: { orderId: string; sellerId: string };
}

/**
 * A seller moved an order along the pipeline (`advance_order_status`). Fired for every transition
 * so the buyer gets an email; `completed` / `cancelled` additionally fire their own events above
 * for the compliance + referral jobs.
 */
export interface OrderStatusChangedEvent {
  name: "harvest/order.status_changed";
  data: {
    orderId: string;
    buyerId: string;
    sellerId: string;
    toStatus: "preparing" | "ready" | "out_for_delivery" | "completed" | "cancelled";
    fulfillmentType: "pickup" | "delivery";
  };
}

/** A paid order was fully refunded or disputed (from the Stripe webhook). */
export interface OrderRefundedEvent {
  name: "harvest/order.refunded";
  data: { orderId: string; sellerId: string };
}

/** A chat message was sent — `message-notify` emails the recipient if they have no other unread. */
export interface MessageSentEvent {
  name: "harvest/message.sent";
  data: { conversationId: string; messageId: string; senderId: string };
}

/** Nudge for `notification-dispatch` — new email/sms rows are waiting. No payload. */
export interface NotificationQueuedEvent {
  name: "harvest/notification.queued";
  data: Record<string, never>;
}
