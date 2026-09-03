import "server-only";

import { env } from "@/lib/env";
import { geocodeQuery, type AddressInput } from "@/lib/geo/address";

/**
 * Address → coordinates via the Mapbox Geocoding API (permanent v6 endpoint). Server-only. Returns
 * null when there's no token, no confident match, or the match is outside the expected state — the
 * caller then treats delivery as unavailable rather than guessing a location.
 */

export interface GeoPoint {
  lng: number;
  lat: number;
}

const token = () => env.MAPBOX_TOKEN ?? env.NEXT_PUBLIC_MAPBOX_TOKEN;

export async function geocodeAddress(address: AddressInput): Promise<GeoPoint | null> {
  const t = token();
  if (!t) return null;

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", geocodeQuery(address));
  url.searchParams.set("country", "US");
  url.searchParams.set("types", "address");
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", t);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body = (await res.json()) as {
    features?: {
      geometry?: { coordinates?: [number, number] };
      properties?: { context?: { region?: { region_code?: string } } };
    }[];
  };

  const feature = body.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!coords || coords.length !== 2) return null;

  // Reject a match that landed in a different state — the state is authoritative for the geofence.
  const region = feature.properties?.context?.region?.region_code;
  if (region && region !== address.state) return null;

  return { lng: coords[0], lat: coords[1] };
}
