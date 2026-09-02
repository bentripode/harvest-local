/**
 * Order status metadata, shared by server and client. The transition rules here MIRROR
 * `advance_order_status()` in `supabase/migrations/20260902115500_phase2_orders.sql` — the
 * database function is authoritative; this copy drives the seller UI (which buttons to show).
 */
import type { FulfillmentType, OrderStatus } from "@/lib/db/types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

/** The happy-path pipeline, in order, for a progress display. */
export const PIPELINE: OrderStatus[] = [
  "new",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
];

export function pipelineFor(fulfillment: FulfillmentType): OrderStatus[] {
  return fulfillment === "delivery"
    ? PIPELINE
    : PIPELINE.filter((s) => s !== "out_for_delivery");
}

export function isTerminal(status: OrderStatus): boolean {
  return status === "completed" || status === "cancelled" || status === "disputed";
}

/** Legal next statuses a seller may move an order to — keep in sync with the SQL. */
export function nextStatuses(
  status: OrderStatus,
  fulfillment: FulfillmentType,
): OrderStatus[] {
  switch (status) {
    case "new":
      return ["preparing", "cancelled"];
    case "preparing":
      return ["ready", "cancelled"];
    case "ready":
      return fulfillment === "delivery" ? ["out_for_delivery"] : ["completed"];
    case "out_for_delivery":
      return ["completed"];
    default:
      return [];
  }
}

/** Label for the button that performs a transition, e.g. "Mark ready". */
export function transitionLabel(to: OrderStatus): string {
  switch (to) {
    case "preparing":
      return "Start preparing";
    case "ready":
      return "Mark ready";
    case "out_for_delivery":
      return "Out for delivery";
    case "completed":
      return "Mark completed";
    case "cancelled":
      return "Cancel order";
    default:
      return ORDER_STATUS_LABELS[to];
  }
}
