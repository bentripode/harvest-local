import type { PickupSlot } from "@/lib/orders/pickup-schedule";

/**
 * Shapes and formatting for collection points — pure, and separate from the reads in `pickup.ts`
 * the way `obligations.ts` is separate from `obligation-queries.ts`.
 *
 * `approximateLocation` in particular decides what a stranger is told about where a seller lives,
 * so it is worth being able to test without a database in the way.
 */

export interface PickupLocation {
  id: string;
  label: string;
  description: string | null;
  city: string | null;
  postalCode: string | null;
  prepHours: number;
  isActive: boolean;
  /** Set when this is a booth at a market in the public directory. */
  market: { id: string; name: string; slug: string; state: string; city: string | null } | null;
  slots: PickupSlot[];
}

export interface OrderPickupAddress {
  source: "market" | "address";
  label: string | null;
  description: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

/** One line, the way it would be written on an envelope. */
export function formatPickupAddress(a: OrderPickupAddress): string {
  return [a.line1, a.line2, a.city, [a.state, a.postalCode].filter(Boolean).join(" ")]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(", ");
}

/**
 * What a stranger is told: the town, never the street.
 *
 * A market booth is a public venue, so it names the market. Anywhere else resolves to the town and
 * ZIP that `pickup_locations` denormalises for exactly this — enough for someone to judge whether
 * it is near enough to bother with, and nothing more. For most cottage sellers the collection point
 * is their own house.
 */
export function approximateLocation(location: PickupLocation): string | null {
  if (location.market) {
    return [location.market.name, location.market.city].filter(Boolean).join(" · ") || null;
  }
  const where = [location.city, location.postalCode]
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0)
    .join(" ");
  return where || null;
}
