import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Reviews are public (RLS `select using (true)`); these run as whoever is signed in. */

export interface ReviewListItem {
  id: string;
  rating: number;
  body: string | null;
  reviewerName: string;
  createdAt: string;
}

export interface ReviewSummary {
  avg: number | null;
  count: number;
}

const firstName = (name: string | null | undefined) =>
  (name ?? "Buyer").trim().split(/\s+/)[0] || "Buyer";

export async function getSellerReviews(
  sellerId: string,
  limit = 10,
): Promise<ReviewListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, body, created_at, reviewer:profiles!reviews_reviewer_id_fkey(display_name)")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    reviewerName: firstName((r.reviewer as { display_name?: string } | null)?.display_name),
    createdAt: r.created_at,
  }));
}

export async function getSellerReviewSummary(sellerId: string): Promise<ReviewSummary> {
  const supabase = await createClient();
  const [{ data: seller }, { count }] = await Promise.all([
    supabase.from("seller_profiles").select("avg_rating").eq("id", sellerId).maybeSingle(),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("seller_id", sellerId),
  ]);
  return {
    avg: seller?.avg_rating != null ? Number(seller.avg_rating) : null,
    count: count ?? 0,
  };
}

/** The signed-in buyer's own review for an order, if any. */
export async function getReviewForOrder(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, body, created_at")
    .eq("order_id", orderId)
    .maybeSingle();
  return data;
}
