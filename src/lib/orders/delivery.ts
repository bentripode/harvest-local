import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { routing } from "@/lib/geo/routing";
import type { GeoPoint } from "@/lib/geo/geocode";
import { cents, toCents, type Cents } from "@/lib/money";

/**
 * Server-side delivery-fee quote. Straight-line radius check in PostGIS (`delivery_route_inputs`),
 * then the billed distance from the Mapbox driving route. `fee = base + per_mile * ceil(miles)`,
 * minimum one mile, all in integer cents — never trusts anything from the client.
 */

export type DeliveryQuote =
  | { ok: true; feeCents: Cents; distanceMiles: number }
  | { ok: false; reason: "disabled" | "out_of_range" | "no_route" };

export async function quoteDelivery(sellerId: string, buyer: GeoPoint): Promise<DeliveryQuote> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("delivery_route_inputs", {
    p_seller_id: sellerId,
    p_lng: buyer.lng,
    p_lat: buyer.lat,
  });
  if (error) throw new Error(`delivery_route_inputs: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.pickup_lng == null || row.pickup_lat == null) {
    return { ok: false, reason: "disabled" };
  }
  if (!row.deliverable) {
    return { ok: false, reason: "out_of_range" };
  }

  const route = await routing.drivingRoute(
    { lng: row.pickup_lng, lat: row.pickup_lat },
    buyer,
  );
  if (!route) return { ok: false, reason: "no_route" };

  const base = toCents(row.base_fee ?? 0);
  const perMile = toCents(row.per_mile_fee ?? 0);
  const billableMiles = Math.max(1, Math.ceil(route.distanceMiles));

  return {
    ok: true,
    feeCents: cents(base + perMile * billableMiles),
    distanceMiles: Math.round(route.distanceMiles * 10) / 10,
  };
}
