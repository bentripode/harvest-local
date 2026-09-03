import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { routing } from "@/lib/geo/routing";
import type { GeoPoint } from "@/lib/geo/geocode";
import type { Cents } from "@/lib/money";
import { deliveryFeeCents } from "@/lib/orders/delivery-fee";

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

  return {
    ok: true,
    feeCents: deliveryFeeCents(row.base_fee, row.per_mile_fee, route.distanceMiles),
    distanceMiles: Math.round(route.distanceMiles * 10) / 10,
  };
}
