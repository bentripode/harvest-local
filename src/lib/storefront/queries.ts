import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Storefront posts and public questions.
 *
 * RLS does the deciding in both cases, which is why neither read filters on status here: a
 * question is visible to a stranger only once answered, to its asker always, and to the seller
 * always — so the same query returns the right rows to each of them without the caller knowing who
 * is asking.
 */

export interface StorefrontPost {
  id: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface StorefrontQuestion {
  id: string;
  body: string;
  askerName: string;
  answer: string | null;
  answeredAt: string | null;
  status: "open" | "answered" | "hidden";
  productId: string | null;
  createdAt: string;
}

const firstName = (name: string | null | undefined) =>
  (name ?? "Someone").trim().split(/\s+/)[0] || "Someone";

export async function getStorefrontPosts(sellerId: string, limit = 10): Promise<StorefrontPost[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_posts")
    .select("id, body, image_url, created_at")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((p) => ({
    id: p.id,
    body: p.body,
    imageUrl: p.image_url,
    createdAt: p.created_at,
  }));
}

export async function getStorefrontQuestions(
  sellerId: string,
  limit = 30,
): Promise<StorefrontQuestion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_questions")
    .select("id, body, asker_name, answer, answered_at, status, product_id, created_at")
    .eq("seller_id", sellerId)
    .neq("status", "hidden")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((q) => ({
    id: q.id,
    body: q.body,
    askerName: firstName(q.asker_name),
    answer: q.answer,
    answeredAt: q.answered_at,
    status: q.status as StorefrontQuestion["status"],
    productId: q.product_id,
    createdAt: q.created_at,
  }));
}

/** The seller's own view: everything, including what nobody else can see yet. */
export async function getSellerQuestionQueue(sellerId: string): Promise<StorefrontQuestion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_questions")
    .select("id, body, asker_name, answer, answered_at, status, product_id, created_at")
    .eq("seller_id", sellerId)
    .order("status")
    .order("created_at", { ascending: false });

  return (data ?? []).map((q) => ({
    id: q.id,
    body: q.body,
    askerName: firstName(q.asker_name),
    answer: q.answer,
    answeredAt: q.answered_at,
    status: q.status as StorefrontQuestion["status"],
    productId: q.product_id,
    createdAt: q.created_at,
  }));
}

/** How many are waiting on the seller — for a badge on their dashboard. */
export async function countUnansweredQuestions(sellerId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("seller_questions")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", sellerId)
    .eq("status", "open");
  return count ?? 0;
}
