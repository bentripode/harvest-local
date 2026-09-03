"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface ReviewFormState {
  error?: string;
  ok?: boolean;
}

const schema = z.object({
  orderId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function submitReviewAction(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const { user } = await requireUser("/orders");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Pick a rating." };
  const { orderId, rating, body } = parsed.data;

  const supabase = await createClient();

  // Fast, friendly checks — the DB trigger + RLS are the real gate.
  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.buyer_id !== user.id) return { error: "Order not found." };
  if (order.status !== "completed") return { error: "You can review an order once it's completed." };

  const { error } = await supabase.from("reviews").insert({
    order_id: orderId,
    reviewer_id: user.id,
    seller_id: order.seller_id,
    rating,
    body: body || null,
  });

  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      return { error: "You've already reviewed this order." };
    }
    if (/completed order by this buyer/i.test(error.message)) {
      return { error: "You can review an order once it's completed." };
    }
    return { error: error.message };
  }

  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function deleteReviewAction(formData: FormData): Promise<void> {
  const { user } = await requireUser("/orders");
  const parsed = z
    .object({ reviewId: z.string().uuid(), orderId: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("reviews")
    .delete()
    .eq("id", parsed.data.reviewId)
    .eq("reviewer_id", user.id);

  revalidatePath(`/orders/${parsed.data.orderId}`);
}
