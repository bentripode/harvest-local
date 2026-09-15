import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { EventLike } from "@/lib/events/schedule";

/**
 * Reading events. The arithmetic and every buyer-facing sentence live in `schedule.ts` (pure).
 *
 * ===========================================================================
 * THE SERVER FILTERS GENEROUSLY, ON PURPOSE
 * ===========================================================================
 * `event_date` is a wall-clock day at the venue and this process runs in UTC, so the server does not
 * actually know what day it is where the reader is. At 8pm Pacific, UTC has already turned over —
 * filtering on `event_date >= current_date` there would hide a market that is still running.
 *
 * So the SQL window starts a day early (`current_date - 1`) and the pure module does the real
 * filtering against the reader's own date. The two failure directions are not equal: showing one
 * stale day is a row someone scrolls past, and hiding today's market is the buyer missing it. We
 * take the first.
 *
 * This is the same decision `markets/schedule.ts` makes by pushing `nextOccurrence` to the client,
 * written the other way round because a list has to be fetched somewhere.
 */

export interface EventRow extends EventLike {
  sellerId: string;
  sellerName: string;
  sellerSlug: string;
  state: string;
  description: string | null;
  locationText: string | null;
  market: { id: string; name: string; slug: string; state: string; city: string | null } | null;
}

const SELECT = `
  id, title, description, event_date, starts_at, ends_at, location_text, status, cancelled_note, state,
  seller:seller_profiles!inner(id, business_name, storefront_slug),
  market:markets(id, name, slug, state, city)
`;

type RawRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  starts_at: string | null;
  ends_at: string | null;
  location_text: string | null;
  status: string;
  cancelled_note: string | null;
  state: string;
  seller: { id: string; business_name: string; storefront_slug: string } | null;
  market: { id: string; name: string; slug: string; state: string; city: string | null } | null;
};

function toEvent(row: RawRow): EventRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventDate: row.event_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    locationText: row.location_text,
    status: row.status as EventLike["status"],
    cancelledNote: row.cancelled_note,
    state: row.state,
    sellerId: row.seller?.id ?? "",
    sellerName: row.seller?.business_name ?? "",
    sellerSlug: row.seller?.storefront_slug ?? "",
    market: row.market,
  };
}

/** The earliest day the SQL will return: one before UTC today. See the note above for why. */
function windowStart(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

/** Everything on in a state, soonest first. The state-wide calendar. */
export async function getStateEvents(state: string, limit = 100): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(SELECT)
    .eq("state", state.toUpperCase())
    .eq("status", "published")
    .gte("event_date", windowStart())
    .order("event_date", { ascending: true })
    .order("starts_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  return ((data ?? []) as unknown as RawRow[]).map(toEvent);
}

/** What's on at one market. */
export async function getMarketEvents(marketId: string, limit = 30): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(SELECT)
    .eq("market_id", marketId)
    .eq("status", "published")
    .gte("event_date", windowStart())
    .order("event_date", { ascending: true })
    .order("starts_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  return ((data ?? []) as unknown as RawRow[]).map(toEvent);
}

/** Where to find one seller — shown on their storefront. */
export async function getSellerUpcomingEvents(sellerId: string, limit = 10): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(SELECT)
    .eq("seller_id", sellerId)
    .eq("status", "published")
    .gte("event_date", windowStart())
    .order("event_date", { ascending: true })
    .order("starts_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  return ((data ?? []) as unknown as RawRow[]).map(toEvent);
}

/**
 * A seller's own list, for managing.
 *
 * Includes hidden, cancelled and past events — a seller needs to see what they have done as well as
 * what is coming, and a past event is the fastest way to schedule the same one again.
 */
export async function getSellerEvents(sellerId: string, limit = 100): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(SELECT)
    .eq("seller_id", sellerId)
    .order("event_date", { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as RawRow[]).map(toEvent);
}

/** The markets a seller can pick as a venue: published ones in their own state. */
export async function getMarketOptions(
  state: string,
): Promise<{ id: string; name: string; city: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select("id, name, city")
    .eq("state", state.toUpperCase())
    .eq("status", "published")
    .order("name")
    .limit(500);

  return data ?? [];
}
