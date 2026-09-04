"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface ReviewResponseState {
  error?: string;
  ok?: boolean;
}

const schema = z.object({
  reviewId: z.string().uuid(),
  response: z.string().trim().max(2000),
});

/**
 * Post, edit, or clear the seller's public reply to a review. RLS ("reviews: seller responds") +
 * the `reviews_guard_columns` trigger are the real gate — this only writes as the signed-in seller
 * and updates the two response columns. An empty string clears the reply.
 */
export async function respondToReviewAction(
  _prev: ReviewResponseState,
  formData: FormData,
): Promise<ReviewResponseState> {
  await requireRole("seller");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your reply." };
  }
  const text = parsed.data.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .update({
      response: text || null,
      responded_at: text ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.reviewId)
    .select("id");

  if (error) {
    return {
      error: /only a review's response/.test(error.message)
        ? "You can only edit the reply."
        : error.message,
    };
  }
  if (!data || data.length === 0) {
    return { error: "That review isn't yours to reply to." };
  }

  revalidatePath("/seller");
  return { ok: true };
}
