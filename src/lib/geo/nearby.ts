import "server-only";

import { createClient } from "@/lib/supabase/server";
import { formatDistance, type NearbySeller } from "@/lib/geo/nearby-format";

export { formatDistance };
export type { NearbySeller };

/**
 * Live storefronts in one state, nearest first.
 *
 * Everything comes from `nearby_sellers()`, which keeps the state filter in SQL — that filter is
 * the discovery layer of rule 1, and one applied in the client is one a client can drop. The
 * coordinates it returns are rounded to about a kilometre for anywhere a seller might live, so a
 * pin says which part of town and not which house (20260908250000).
 */

export async function getNearbySellers(
  state: string,
  origin: { lng: number; lat: number } | null,
  limit = 200,
): Promise<NearbySeller[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nearby_sellers", {
    p_state: state.toUpperCase(),
    p_lng: origin?.lng ?? undefined,
    p_lat: origin?.lat ?? undefined,
    p_limit: limit,
  });
  if (error || !Array.isArray(data)) return [];

  return data.map((r) => ({
    sellerId: r.seller_id,
    businessName: r.business_name,
    storefrontSlug: r.storefront_slug,
    avgRating: r.avg_rating != null ? Number(r.avg_rating) : null,
    distanceMiles: r.distance_miles != null ? Number(r.distance_miles) : null,
    lng: r.approx_lng ?? null,
    lat: r.approx_lat ?? null,
    locationLabel: r.location_label ?? null,
    isMarket: !!r.is_market,
    deliveryEnabled: !!r.delivery_enabled,
    deliveryRadiusMiles: r.delivery_radius_miles ?? null,
  }));
}
