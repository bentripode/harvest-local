import { cents, toCents, type Cents } from "@/lib/money";

/**
 * The delivery-fee formula, isolated so it can be exercised without a DB or a routing provider.
 * `fee = base + per_mile * ceil(miles)`, billed for a minimum of one mile, all in integer cents.
 * Inputs are decimal-dollar values as stored on `seller_profiles` (Postgres `numeric`).
 */
export function deliveryFeeCents(
  baseFeeDollars: string | number | null | undefined,
  perMileFeeDollars: string | number | null | undefined,
  routeMiles: number,
): Cents {
  const base = toCents(baseFeeDollars ?? 0);
  const perMile = toCents(perMileFeeDollars ?? 0);
  const billableMiles = Math.max(1, Math.ceil(routeMiles));
  return cents(base + perMile * billableMiles);
}
