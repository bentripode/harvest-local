import "server-only";

import { env } from "@/lib/env";
import type { GeoPoint } from "@/lib/geo/geocode";

/**
 * Routing provider interface — kept behind this seam so Mapbox can be swapped for Google Distance
 * Matrix or anything else without touching the delivery-fee code (ARCHITECTURE §1.2).
 */

export interface DrivingRoute {
  distanceMiles: number;
  durationMinutes: number;
}

export interface RoutingProvider {
  drivingRoute(from: GeoPoint, to: GeoPoint): Promise<DrivingRoute | null>;
}

const METERS_PER_MILE = 1609.344;

const mapboxRouting: RoutingProvider = {
  async drivingRoute(from, to) {
    const t = env.MAPBOX_TOKEN ?? env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!t) return null;

    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`);
    url.searchParams.set("overview", "false");
    url.searchParams.set("access_token", t);

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    } catch {
      return null;
    }
    if (!res.ok) return null;

    const body = (await res.json()) as {
      routes?: { distance?: number; duration?: number }[];
    };
    const route = body.routes?.[0];
    if (!route?.distance) return null;

    return {
      distanceMiles: route.distance / METERS_PER_MILE,
      durationMinutes: (route.duration ?? 0) / 60,
    };
  },
};

export const routing: RoutingProvider = mapboxRouting;
