import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PickupSlot } from "@/lib/orders/pickup-schedule";
import {
  approximateLocation,
  formatPickupAddress,
  type OrderPickupAddress,
  type PickupLocation,
} from "@/lib/orders/pickup-format";

export { approximateLocation, formatPickupAddress };
export type { OrderPickupAddress, PickupLocation };

/**
 * Reads for pickup locations.
 *
 * RLS is the gate throughout ("pickup locations: public read live"), so a paused seller's
 * collection points are invisible to a buyer without any filtering here, and the seller still sees
 * their own while they're paused.
 *
 * The `addresses` row behind a location is deliberately never selected: it is owner-only, and for a
 * home-based seller it is their house. `city` / `postal_code` are denormalised onto the location
 * for exactly this, so a buyer can be told roughly where without being told precisely where.
 */

const SELECT =
  "id, label, description, city, postal_code, prep_hours, is_active, sort_order, " +
  "market:markets(id, name, slug, state, city), " +
  "slots:pickup_slots(day_of_week, specific_date, opens, closes, weeks_of_month)";

type Row = {
  id: string;
  label: string;
  description: string | null;
  city: string | null;
  postal_code: string | null;
  prep_hours: number;
  is_active: boolean;
  sort_order: number;
  market: { id: string; name: string; slug: string; state: string; city: string | null } | null;
  slots:
    | {
        day_of_week: number | null;
        specific_date: string | null;
        opens: string;
        closes: string;
        weeks_of_month: number[] | null;
      }[]
    | null;
};

function toLocation(row: Row): PickupLocation {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    city: row.city,
    postalCode: row.postal_code,
    prepHours: row.prep_hours,
    isActive: row.is_active,
    market: row.market,
    slots: (row.slots ?? []).map((s) => ({
      dayOfWeek: s.day_of_week,
      specificDate: s.specific_date,
      opens: s.opens,
      closes: s.closes,
      weeksOfMonth: s.weeks_of_month ?? [],
    })),
  };
}

/** Every collection point a seller has, active or not. For their own settings page. */
export async function getSellerPickupLocations(sellerId: string): Promise<PickupLocation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pickup_locations")
    .select(SELECT)
    .eq("seller_id", sellerId)
    .order("sort_order")
    .order("label");

  return ((data ?? []) as unknown as Row[]).map(toLocation);
}

/** The active ones a buyer may choose between. */
export async function getActivePickupLocations(sellerId: string): Promise<PickupLocation[]> {
  const all = await getSellerPickupLocations(sellerId);
  return all.filter((l) => l.isActive);
}

export interface MarketSeller {
  sellerId: string;
  businessName: string;
  storefrontSlug: string;
  avgRating: number | null;
  locationLabel: string;
  description: string | null;
  slots: PickupSlot[];
  prepHours: number;
}

/**
 * The sellers who have a booth at this market — the read the market page was built for and
 * couldn't answer until this table existed.
 *
 * Live storefronts only, and by the market link rather than by proximity: "sells at this market"
 * and "is near this market" are different claims, and only the first one is being made here. The
 * insert trigger already refuses a booth at an out-of-state market, so the same-state rule holds
 * without a filter.
 */
export async function getMarketSellers(marketId: string): Promise<MarketSeller[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pickup_locations")
    .select(
      "id, label, description, prep_hours, " +
        "seller:seller_profiles!inner(id, business_name, storefront_slug, avg_rating, is_paused), " +
        "slots:pickup_slots(day_of_week, specific_date, opens, closes, weeks_of_month)",
    )
    .eq("market_id", marketId)
    .eq("is_active", true)
    .eq("seller_profiles.is_paused", false);

  type MarketRow = {
    label: string;
    description: string | null;
    prep_hours: number;
    seller: {
      id: string;
      business_name: string;
      storefront_slug: string;
      avg_rating: number | null;
      is_paused: boolean;
    } | null;
    slots: Row["slots"];
  };

  return ((data ?? []) as unknown as MarketRow[])
    .filter((r) => r.seller && !r.seller.is_paused)
    .map((r) => ({
      sellerId: r.seller!.id,
      businessName: r.seller!.business_name,
      storefrontSlug: r.seller!.storefront_slug,
      avgRating: r.seller!.avg_rating != null ? Number(r.seller!.avg_rating) : null,
      locationLabel: r.label,
      description: r.description,
      prepHours: r.prep_hours,
      slots: (r.slots ?? []).map((s) => ({
        dayOfWeek: s.day_of_week,
        specificDate: s.specific_date,
        opens: s.opens,
        closes: s.closes,
        weeksOfMonth: s.weeks_of_month ?? [],
      })),
    }))
    .sort((a, b) => a.businessName.localeCompare(b.businessName));
}

/**
 * The exact collection address for a paid pickup order.
 *
 * Goes through `order_pickup_address()` rather than reading `addresses` directly, because for a
 * home-based seller that row is their house: it is owner-only, and the SECURITY DEFINER function is
 * what checks the caller is a party to the order and that the order is past `pending_payment`.
 * Returns null before payment, which is the whole point — see the migration.
 */
export async function getOrderPickupAddress(
  orderId: string,
): Promise<OrderPickupAddress | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("order_pickup_address", { p_order_id: orderId });
  if (error) return null;

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  return {
    source: row.source === "market" ? "market" : "address",
    label: row.label ?? null,
    description: row.description ?? null,
    line1: row.line1 ?? null,
    line2: row.line2 ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    postalCode: row.postal_code ?? null,
  };
}

/** Markets in the seller's state they could add a booth at. */
export async function getMarketsForSeller(
  state: string,
): Promise<{ id: string; name: string; city: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select("id, name, city")
    .eq("state", state.toUpperCase())
    .order("name")
    .limit(1000);
  return data ?? [];
}
