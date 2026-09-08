/**
 * Shape and formatting for nearby-seller results — pure, so the map (a client component) can use
 * them without dragging `server-only` and the Supabase client into the browser bundle. The reads
 * live in `nearby.ts`, the way `pickup-format.ts` splits from `pickup.ts`.
 */

export interface NearbySeller {
  sellerId: string;
  businessName: string;
  storefrontSlug: string;
  avgRating: number | null;
  /** Null when we have no origin to measure from — the list still comes back. */
  distanceMiles: number | null;
  /** Approximate, except for a public market venue. Null when the seller has no located address. */
  lng: number | null;
  lat: number | null;
  locationLabel: string | null;
  isMarket: boolean;
}

/**
 * "3.4 mi" / "under a mile" / "12 mi". Null when there is nothing to measure from, so callers show
 * no distance rather than a zero.
 *
 * Under a mile is deliberately not "0.4 mi": the underlying point is rounded to about a kilometre
 * for anywhere a seller might live, so a tenth-of-a-mile reading would claim a precision the data
 * does not have. Past ten miles the tenths stop meaning anything either, so they go.
 */
export function formatDistance(miles: number | null): string | null {
  if (miles == null || !Number.isFinite(miles) || miles < 0) return null;
  if (miles < 1) return "under a mile";
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}
