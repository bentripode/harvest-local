"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import type { OrderStatus } from "@/lib/db/types";

const schema = z.object({
  orderId: z.string().uuid(),
  toStatus: z.enum([
    "preparing",
    "ready",
    "out_for_delivery",
    "completed",
    "cancelled",
  ] satisfies OrderStatus[]),
  note: z.string().max(500).optional(),
});

export interface AdvanceState {
  error?: string;
}

/**
 * Move an order along the pipeline. Authorization + transition validity live in the
 * `advance_order_status` SQL function (SECURITY DEFINER); this action just forwards the call as
 * the signed-in seller and lets the DB be the referee.
 */
export async function advanceOrderStatusAction(
  _prev: AdvanceState,
  formData: FormData,
): Promise<AdvanceState> {
  await requireRole("seller");

  const parsed = schema.safeParse({
    orderId: formData.get("orderId"),
    toStatus: formData.get("toStatus"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("advance_order_status", {
    p_order_id: parsed.data.orderId,
    p_to_status: parsed.data.toStatus,
    p_note: parsed.data.note ?? undefined,
  });

  if (error) {
    return {
      error: /illegal order transition/.test(error.message)
        ? "That status change isn't allowed."
        : /not authorized/.test(error.message)
          ? "You can't change this order."
          : error.message,
    };
  }

  // The transition is committed. Fire the completion event for the compliance jobs
  // (revenue-cap tally + auto-pause); a send failure must not surface as a user error.
  if (parsed.data.toStatus === "completed") {
    const order = Array.isArray(data) ? data[0] : data;
    if (order) {
      await inngest
        .send({
          name: "harvest/order.completed",
          data: { orderId: order.id, sellerId: order.seller_id },
        })
        .catch((err) => console.error("[inngest] harvest/order.completed send failed:", err));
    }
  }

  revalidatePath("/seller/orders");
  revalidatePath(`/seller/orders/${parsed.data.orderId}`);
  return {};
}
