import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { LaunchFacts } from "@/lib/launch/checklist";
import type { SellerProfile } from "@/lib/db/types";

/**
 * Gathering what a seller has actually done.
 *
 * Every field is a count or an existence check against a table the seller already owns — nothing is
 * remembered, so nothing can go stale, and a seller who deletes their last listing correctly goes
 * back to "put up your first listing".
 *
 * Counts use `head: true`, so this is a page of `count(*)` rather than a page of rows.
 */
export async function getLaunchFacts(seller: SellerProfile): Promise<LaunchFacts> {
  const supabase = await createClient();
  const today = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // Written out per table rather than through a shared helper: a generic over six tables narrows
  // the filterable columns to what they all share, which is `id` and `seller_id`.
  const head = { count: "exact" as const, head: true };

  const [active, drafts, foodListings, pickups, events, promos, orders, reviews, views] =
    await Promise.all([
      supabase
        .from("products")
        .select("id", head)
        .eq("seller_id", seller.id)
        .eq("status", "active"),
      supabase.from("products").select("id", head).eq("seller_id", seller.id).eq("status", "draft"),
      // "Do they sell food" is derived from their categories, never self-declared — the same rule
      // the licence gate uses (`seller_sells_cottage_food`).
      supabase
        .from("products")
        .select("id, categories!inner(requires_food_permit)", head)
        .eq("seller_id", seller.id)
        .eq("categories.requires_food_permit", true),
      supabase
        .from("pickup_locations")
        .select("id", head)
        .eq("seller_id", seller.id)
        .eq("is_active", true),
      supabase
        .from("events")
        .select("id", head)
        .eq("seller_id", seller.id)
        .eq("status", "published")
        .gte("event_date", today),
      supabase.from("promo_codes").select("id", head).eq("seller_id", seller.id),
      supabase
        .from("orders")
        .select("id", head)
        .eq("seller_id", seller.id)
        .eq("status", "completed"),
      supabase.from("reviews").select("id", head).eq("seller_id", seller.id),
      supabase.from("seller_view_counts").select("views").eq("seller_id", seller.id),
    ]);

  const storefrontViews = (views.data ?? []).reduce((sum, row) => sum + (row.views ?? 0), 0);

  return {
    isLive: !seller.is_paused,
    pauseReason: seller.pause_reason,
    sellsFood: (foodListings.count ?? 0) > 0,
    hasProgramChoice: !!seller.food_program_id,
    activeListings: active.count ?? 0,
    draftListings: drafts.count ?? 0,
    // Label gaps are resolved per listing by `describeListingGaps`, which needs the state's rule and
    // the whole product row. Left at zero here rather than approximated: `/seller/products` already
    // renders the real answer, and a wrong count on this page would send a seller looking for a
    // problem that isn't there.
    listingsWithGaps: 0,
    hasPickupLocation: (pickups.count ?? 0) > 0,
    hasStory: !!seller.story?.trim(),
    hasUpcomingEvent: (events.count ?? 0) > 0,
    hasPromoCode: (promos.count ?? 0) > 0,
    storefrontViews,
    completedOrders: orders.count ?? 0,
    reviewCount: reviews.count ?? 0,
  };
}
