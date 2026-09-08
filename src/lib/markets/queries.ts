import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MarketHour } from "@/lib/markets/schedule";

/**
 * Reads for the public market directory. Everything here runs as whoever is browsing — the
 * "markets: public read published" policy is the gate, so a hidden market is invisible without any
 * filtering in application code.
 *
 * `location` is never selected: PostGIS geography does not cross PostgREST usefully, and nothing
 * on these pages needs coordinates yet. The map view will add an RPC for that.
 */

const MARKET_COLUMNS =
  "id, slug, name, state, city, address_text, postal_code, season_text, hours_text, website_url, phone";

export interface MarketSummary {
  id: string;
  slug: string;
  name: string;
  state: string;
  city: string | null;
  addressText: string | null;
  postalCode: string | null;
  seasonText: string | null;
  /** The source directory's free text. Null upstream far more often than not. */
  hoursText: string | null;
  websiteUrl: string | null;
  phone: string | null;
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
  hours?: { day_of_week: number; opens: string; closes: string; note: string | null }[] | null;
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
    hours: (row.hours ?? []).map((h) => ({
      dayOfWeek: h.day_of_week,
      opens: h.opens,
      closes: h.closes,
      note: h.note,
    })),
  };
}

export async function getMarketsInState(state: string, limit = 200): Promise<MarketSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select(`${MARKET_COLUMNS}, hours:market_hours(day_of_week, opens, closes, note)`)
    .eq("state", state.toUpperCase())
    .order("name")
    .limit(limit);

  return ((data ?? []) as MarketRow[]).map(toSummary);
}

export async function getMarket(state: string, slug: string): Promise<MarketSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select(`${MARKET_COLUMNS}, hours:market_hours(day_of_week, opens, closes, note)`)
    .eq("state", state.toUpperCase())
    .eq("slug", slug)
    .maybeSingle();

  return data ? toSummary(data as MarketRow) : null;
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
