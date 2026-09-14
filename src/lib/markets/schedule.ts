import {
  DAY_ABBR,
  DAY_NAMES,
  formatDayDate,
  formatSpan as spanOf,
  formatTime,
  toMinutes,
} from "@/lib/time/wall-clock";

/**
 * Market opening hours — pure arithmetic over `market_hours` rows.
 *
 * A note on time zones, because it decides where each of these is called from. We do not store a
 * time zone per market: `opens` / `closes` are wall-clock times at the market, and a market is by
 * definition local to whoever is looking at it. So:
 *
 *   - `summarizeHours` is time-zone free ("Saturday · 9:00 AM – 3:00 PM") and is rendered on the
 *     server, which is what search engines and a reader with no JS get.
 *   - `nextOccurrence` needs to know what day it is *where the market is*, and the server runs in
 *     UTC — at 8pm Pacific it already thinks it is tomorrow. So it is called from the client
 *     against the viewer's own clock, which for a local market is the right one.
 *
 * Nothing here invents a schedule. An empty `hours` array means nobody has recorded one, and the
 * caller says so rather than implying the market is closed.
 */

export { formatTime, toMinutes };

export interface MarketHour {
  dayOfWeek: number; // 0 = Sunday, matching Date.getDay()
  opens: string; // "09:00" or "09:00:00"
  closes: string;
  note?: string | null;
  /**
   * Who said so: a person (`admin`), the market's own site's schema.org hours (`website`), or
   * research across other listings (`research`), which carries `sourceNote` / `sourceUrl`.
   */
  source?: "admin" | "website" | "research";
  sourceNote?: string | null;
  sourceUrl?: string | null;
}

export interface HoursProvenance {
  source: "website" | "research";
  /** Short, for a card: "from their website" / "from other listings". */
  short: string;
  /** For the market page, e.g. "Yelp, Nextdoor and a 2026 event listing". Research only. */
  note: string | null;
  url: string | null;
}

/**
 * Where the recorded hours came from, when it was not a person — so the page can say so beside the
 * times, because a website can be years out of date, listings can disagree, and a buyer may drive
 * on the strength of it. Null when a person entered them (or there are none).
 */
export function hoursProvenance(hours: MarketHour[]): HoursProvenance | null {
  if (hours.length === 0) return null;
  if (hours.every((h) => h.source === "website")) {
    return { source: "website", short: "from their website", note: null, url: null };
  }
  if (hours.every((h) => h.source === "research")) {
    const first = hours.find((h) => h.sourceNote) ?? hours[0];
    return {
      source: "research",
      short: "from other listings",
      note: first.sourceNote ?? null,
      url: first.sourceUrl ?? null,
    };
  }
  return null;
}

/** A season or other qualifier recorded with the hours ("February to November"), if any. */
export function hoursNote(hours: MarketHour[]): string | null {
  return hours.find((h) => h.note)?.note ?? null;
}

export function formatSpan(hour: MarketHour): string {
  return spanOf(hour.opens, hour.closes);
}

function byDayThenOpen(a: MarketHour, b: MarketHour): number {
  if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
  return (toMinutes(a.opens) ?? 0) - (toMinutes(b.opens) ?? 0);
}

/**
 * One line per opening slot, in week order: ["Saturday · 9:00 AM – 3:00 PM"].
 * Time-zone free, so it is safe to render on the server.
 */
export function summarizeHours(hours: MarketHour[]): string[] {
  return [...hours]
    .sort(byDayThenOpen)
    .map((h) => `${DAY_NAMES[h.dayOfWeek] ?? "—"} · ${formatSpan(h)}`);
}

/** Monday-first position, so a weekend reads "Sat, Sun" and a working week is one run. */
const mondayFirst = (day: number) => (day + 6) % 7;

/** "Daily", "Mon–Fri", "Sat, Sun", "Tue, Thu": days that share a time span, as a reader says them. */
function dayLabel(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => mondayFirst(a) - mondayFirst(b));
  if (sorted.length === 7) return "Daily";
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && mondayFirst(sorted[j + 1]) === mondayFirst(sorted[j]) + 1) j++;
    const run = sorted.slice(i, j + 1).map((d) => DAY_ABBR[d] ?? "—");
    parts.push(run.length >= 3 ? `${run[0]}–${run[run.length - 1]}` : run.join(", "));
    i = j + 1;
  }
  return parts.join(", ");
}

/**
 * A compact one-liner for a card. Days sharing a time span are grouped — a market hall open every
 * day reads "Daily · 10:00 AM – 7:00 PM", not seven repetitions of it — and groups past `max` are
 * counted rather than silently dropped.
 */
export function shortSummary(hours: MarketHour[], max = 2): string | null {
  if (hours.length === 0) return null;
  const groups = new Map<string, number[]>();
  for (const h of [...hours].sort(byDayThenOpen)) {
    const span = formatSpan(h);
    groups.set(span, [...(groups.get(span) ?? []), h.dayOfWeek]);
  }
  const ordered = [...groups.entries()].sort(
    ([, a], [, b]) => Math.min(...a.map(mondayFirst)) - Math.min(...b.map(mondayFirst)),
  );
  const shown = ordered.slice(0, max).map(([span, days]) => `${dayLabel(days)} · ${span}`);
  const rest = ordered.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} +${rest} more` : shown.join(", ");
}

export interface Occurrence {
  /** Local calendar date of the next (or current) session. */
  date: Date;
  hour: MarketHour;
  /** True when `from` falls inside this slot right now. */
  openNow: boolean;
}

/**
 * The next time this market is open, at or after `from`, using `from`'s own local calendar.
 * A slot that is open right now wins; a slot earlier today has already passed and rolls to next
 * week. Returns null when no hours are recorded.
 */
export function nextOccurrence(hours: MarketHour[], from: Date = new Date()): Occurrence | null {
  const nowMins = from.getHours() * 60 + from.getMinutes();
  const today = from.getDay();

  let best: { daysAhead: number; startMins: number; hour: MarketHour; openNow: boolean } | null =
    null;

  for (const hour of hours) {
    const opens = toMinutes(hour.opens);
    const closes = toMinutes(hour.closes);
    if (opens === null || closes === null) continue;

    let daysAhead = (hour.dayOfWeek - today + 7) % 7;
    let openNow = false;

    if (daysAhead === 0) {
      if (nowMins < closes) {
        // Either open right now, or opening later today.
        openNow = nowMins >= opens;
      } else {
        daysAhead = 7; // already finished today
      }
    }

    const candidate = { daysAhead, startMins: opens, hour, openNow };
    if (
      best === null ||
      candidate.daysAhead < best.daysAhead ||
      (candidate.daysAhead === best.daysAhead && candidate.startMins < best.startMins)
    ) {
      best = candidate;
    }
  }

  if (!best) return null;

  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + best.daysAhead);
  return { date, hour: best.hour, openNow: best.openNow };
}

/** "Sat, Sep 12 · 9:00 AM – 3:00 PM", or "Open now · until 3:00 PM". */
export function formatOccurrence(occ: Occurrence): string {
  if (occ.openNow) return `Open now · until ${formatTime(occ.hour.closes)}`;
  return `${formatDayDate(occ.date)} · ${formatSpan(occ.hour)}`;
}
