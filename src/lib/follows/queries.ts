import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Reads for follows.
 *
 * Two different privacy answers here, on purpose. Whether *you* follow something is your own row
 * and comes back through RLS. How many people follow it is a public number and comes from
 * `follower_counts()`, which returns counts and never identities — so a storefront can say "12
 * following" without telling anyone who.
 */

export type FollowTarget = "seller" | "market" | "product";

/** Counts for a list of targets, batched — a page of twenty markets is one query. */
export async function getFollowerCounts(
  target: FollowTarget,
  ids: string[],
): Promise<Record<string, number>> {
  if (ids.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("follower_counts", {
    p_target_type: target,
    p_target_ids: ids,
  });
  if (error || !Array.isArray(data)) return {};

  const out: Record<string, number> = {};
  for (const row of data) out[row.target_id] = Number(row.follower_count);
  return out;
}

export async function getFollowerCount(target: FollowTarget, id: string): Promise<number> {
  return (await getFollowerCounts(target, [id]))[id] ?? 0;
}

/** Which of these the signed-in viewer follows. Empty for a guest — RLS returns nothing. */
export async function getFollowedIds(target: FollowTarget, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();

  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("target_id")
    .eq("target_type", target)
    .in("target_id", ids);

  return new Set((data ?? []).map((r) => r.target_id));
}

export async function isFollowing(target: FollowTarget, id: string): Promise<boolean> {
  return (await getFollowedIds(target, [id])).has(id);
}

export interface FollowedSeller {
  id: string;
  businessName: string;
  storefrontSlug: string;
  avgRating: number | null;
  followedAt: string;
}

export interface FollowedMarket {
  id: string;
  name: string;
  slug: string;
  state: string;
  city: string | null;
  followedAt: string;
}

export interface SavedProduct {
  id: string;
  title: string;
  price: string;
  sellerSlug: string;
  businessName: string;
  followedAt: string;
}

/**
 * Everything the viewer follows, for their saved page.
 *
 * The joins are separate queries rather than PostgREST embeds because `follows.target_id` carries
 * no foreign key — it can't, pointing at three tables — so there is no relationship for an embed to
 * traverse. A paused seller or an unlisted product simply drops out of the join, which is the right
 * behaviour: a saved link to a storefront that is no longer live would 404.
 */
export async function getMyFollows(): Promise<{
  sellers: FollowedSeller[];
  markets: FollowedMarket[];
  products: SavedProduct[];
}> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("follows")
    .select("target_type, target_id, created_at")
    .order("created_at", { ascending: false });

  const all = rows ?? [];
  const idsOf = (t: FollowTarget) => all.filter((r) => r.target_type === t).map((r) => r.target_id);
  const followedAt = new Map(all.map((r) => [`${r.target_type}:${r.target_id}`, r.created_at]));

  const sellerIds = idsOf("seller");
  const marketIds = idsOf("market");
  const productIds = idsOf("product");

  const [sellers, markets, products] = await Promise.all([
    sellerIds.length
      ? supabase
          .from("seller_profiles")
          .select("id, business_name, storefront_slug, avg_rating")
          .in("id", sellerIds)
          // A seller on a break stays on your saved list — that is precisely when following
          // them is worth something.
          .or("is_paused.eq.false,pause_reason.eq.vacation")
      : Promise.resolve({ data: [] }),
    marketIds.length
      ? supabase.from("markets").select("id, name, slug, state, city").in("id", marketIds)
      : Promise.resolve({ data: [] }),
    productIds.length
      ? supabase
          .from("products")
          .select("id, title, price, seller:seller_profiles!inner(business_name, storefront_slug)")
          .in("id", productIds)
          .eq("status", "active")
      : Promise.resolve({ data: [] }),
  ]);

  return {
    sellers: (sellers.data ?? []).map((s) => ({
      id: s.id,
      businessName: s.business_name,
      storefrontSlug: s.storefront_slug,
      avgRating: s.avg_rating != null ? Number(s.avg_rating) : null,
      followedAt: followedAt.get(`seller:${s.id}`) ?? "",
    })),
    markets: (markets.data ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      state: m.state,
      city: m.city,
      followedAt: followedAt.get(`market:${m.id}`) ?? "",
    })),
    products: (products.data ?? []).map((p) => {
      const seller = p.seller as { business_name: string; storefront_slug: string } | null;
      return {
        id: p.id,
        title: p.title,
        price: p.price,
        sellerSlug: seller?.storefront_slug ?? "",
        businessName: seller?.business_name ?? "",
        followedAt: followedAt.get(`product:${p.id}`) ?? "",
      };
    }),
  };
}
