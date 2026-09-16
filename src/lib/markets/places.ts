import "server-only";

import { env } from "@/lib/env";

/**
 * Google's photographs of a market, fetched when the page renders and never kept.
 *
 * Google's Places policy is the shape of this module: "You must not pre-fetch, cache, or store
 * Places API content beyond the allowed exceptions", with one exception — "the place_id is exempt
 * from caching restrictions. You can therefore store place ID values indefinitely." So
 * `markets.google_place_id` is all we hold, and the photo, its dimensions and the photographer's
 * name are asked for on every render and thrown away after it.
 *
 * That is also why these photographs are NOT `markets.image_url`. That column is our own copy of a
 * picture a market's own website offered for link previews, taken under that site's terms and
 * served from our bucket. A Places photograph may never be written there.
 *
 * Two obligations travel with the picture and are not optional:
 *
 *   - the photographer is credited ("always credit the author... using all available resources
 *     (avatar, name, and profile link) when space allows"), and
 *   - the reader can reach the original: "end-users must always have access to view the individual
 *     source photo or review on Google Maps using the provided googleMapsUri".
 *
 * `MarketPhoto` therefore has no shape in which the credit is absent — if the attribution is
 * missing from Google's answer, `getMarketPhoto` returns null rather than an uncredited picture.
 */

export interface PhotoCredit {
  name: string;
  /** The photographer's Google Maps contributions page. */
  profileUrl: string | null;
}

export interface MarketPhoto {
  /** Our own route; the Google key never reaches the browser. */
  src: string;
  width: number;
  height: number;
  credit: PhotoCredit;
  /** This photograph on Google Maps, which the reader must be able to open. */
  sourceUrl: string | null;
}

interface PlacesPhoto {
  name?: string;
  widthPx?: number;
  heightPx?: number;
  googleMapsUri?: string;
  authorAttributions?: { displayName?: string; uri?: string }[];
}

/** Whether the integration is configured at all. With no key, markets keep their monogram tiles. */
export function placesConfigured(): boolean {
  return Boolean(env.GOOGLE_MAPS_API_KEY);
}

/**
 * The first usable photograph for a place, or null.
 *
 * Null covers every failure on purpose — no key, no place id, a refused request, no photos, or a
 * photo Google gave us with no author. A market page without a picture is fine; an uncredited or
 * mis-attributed one is a licence breach.
 */
export async function getMarketPhoto(
  placeId: string | null | undefined,
  maxWidthPx = 1200,
): Promise<MarketPhoto | null> {
  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key || !placeId) return null;

  let photo: PlacesPhoto | undefined;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "photos",
        },
        // Next would otherwise cache the response, which is the thing the policy forbids.
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { photos?: PlacesPhoto[] };
    photo = body.photos?.find((p) => p.name && p.authorAttributions?.[0]?.displayName);
  } catch {
    return null;
  }

  const author = photo?.authorAttributions?.[0];
  if (!photo?.name || !author?.displayName) return null;

  return {
    src: `/api/market-photo?photo=${encodeURIComponent(photo.name)}&w=${maxWidthPx}`,
    width: photo.widthPx ?? maxWidthPx,
    height: photo.heightPx ?? Math.round(maxWidthPx * 0.75),
    credit: { name: author.displayName, profileUrl: author.uri ?? null },
    sourceUrl: photo.googleMapsUri ?? null,
  };
}

/**
 * The bytes of one photo, straight from Google.
 *
 * `skipHttpRedirect` asks Google for the image's URI rather than the image, so we can hand the
 * browser a redirect and never proxy the bytes through our own server. The key stays here.
 */
export async function resolvePhotoUri(
  photoName: string,
  maxWidthPx: number,
): Promise<string | null> {
  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  // "places/<id>/photos/<ref>" and nothing else — this arrives from a query string.
  if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(photoName)) return null;

  try {
    const url =
      `https://places.googleapis.com/v1/${photoName}/media` +
      `?maxWidthPx=${Math.min(Math.max(maxWidthPx, 100), 4800)}&skipHttpRedirect=true`;
    const res = await fetch(url, { headers: { "X-Goog-Api-Key": key }, cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { photoUri?: string };
    return body.photoUri ?? null;
  } catch {
    return null;
  }
}
