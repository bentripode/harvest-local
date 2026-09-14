import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MarketHour } from "@/lib/markets/schedule";

/**
 * Reads for the public market directory. Everything here runs as whoever is browsing — the
 * "markets: public read published" policy is the gate, so a hidden market is invisible without any
 * filtering in application code.
 *
 * `lng` / `lat` are PostgREST computed fields over `location` (20260914100000), which itself would
 * cross the wire as hex EWKB. They run with the caller's rights, so RLS still applies.
 */

const MARKET_COLUMNS =
  "id, slug, name, state, city, address_text, postal_code, season_text, hours_text, website_url, phone, image_url, lng, lat";
const HOURS_EMBED = "hours:market_hours(day_of_week, opens, closes, note, source)";

/** PostgREST caps a response at 1000 rows on this project, so a state is read in pages of this. */
const PAGE = 1000;

export interface MarketSummary {
  id: string;
  slug: string;
  name: string;
  state: string;
  city: string | null;
  addressText: string | null;
  postalCode: string | null;
  /**
   * Upstream calls the field it comes from `listing_desc`: it is the market's description of
   * itself, and only occasionally a season. Shown on the market's own page, not in lists.
   */
  seasonText: string | null;
  /** The source directory's free text. Null upstream far more often than not. */
  hoursText: string | null;
  websiteUrl: string | null;
  phone: string | null;
  /** Our thumbnail copy of the market's own link-preview image, or null. */
  imageUrl: string | null;
  lng: number | null;
  lat: number | null;
  hours: MarketHour[];
}

type MarketRow = {
  id: string;
  slug: string;
  name: string;
  state: string;
  city: string | null;
  address_text: string | null;
  postal_code: string | null;
  season_text: string | null;
  hours_text: string | null;
  website_url: string | null;
  phone: string | null;
  image_url: string | null;
  lng: number | null;
  lat: number | null;
  hours?:
    | { day_of_week: number; opens: string; closes: string; note: string | null; source: string }[]
    | null;
};

function toSummary(row: MarketRow): MarketSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    state: row.state,
    city: row.city,
    addressText: row.address_text,
    postalCode: row.postal_code,
    seasonText: row.season_text,
    hoursText: row.hours_text,
    websiteUrl: row.website_url,
    phone: row.phone,
    imageUrl: row.image_url,
    lng: row.lng,
    lat: row.lat,
    hours: (row.hours ?? []).map((h) => ({
      dayOfWeek: h.day_of_week,
      opens: h.opens,
      closes: h.closes,
      note: h.note,
      source: h.source === "website" ? "website" : "admin",
    })),
  };
}

/**
 * Every published market in a state, by name. Paged, because a flat `limit` quietly truncated the
 * list: Texas has 236 markets and the directory showed the first 200 alphabetically, so a search
 * for a market in the back of the alphabet found nothing.
 */
export async function getMarketsInState(state: string): Promise<MarketSummary[]> {
  const supabase = await createClient();
  const rows: MarketRow[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("markets")
      .select(`${MARKET_COLUMNS}, ${HOURS_EMBED}`)
      .eq("state", state.toUpperCase())
      .order("name")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Couldn't load markets: ${error.message}`);
    // `unknown` first: the generated types don't know `lng`/`lat` are computed fields and type
    // the whole row as a select error. They are real columns at runtime (20260914100000).
    rows.push(...((data ?? []) as unknown as MarketRow[]));
    if (!data || data.length < PAGE) break;
  }

  return rows.map(toSummary);
}

export async function getMarket(state: string, slug: string): Promise<MarketSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select(`${MARKET_COLUMNS}, ${HOURS_EMBED}`)
    .eq("state", state.toUpperCase())
    .eq("slug", slug)
    .maybeSingle();

  return data ? toSummary(data as unknown as MarketRow) : null;
}

/** How many markets we list per state — drives the directory's "browse by state" list. */
export async function countMarketsByState(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("markets").select("state").limit(20000);

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { state: string }[]) {
    counts[row.state] = (counts[row.state] ?? 0) + 1;
  }
  return counts;
}
