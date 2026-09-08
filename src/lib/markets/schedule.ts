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
 *     UTC — at 8pm Pacific the server already thinks it is tomorrow. So it is called from the
 *     client against the viewer's own clock, which for a local market is the right one.
 *
 * Nothing here invents a schedule. An empty `hours` array means nobody has recorded one, and the
 * caller says so rather than implying the market is closed.
 */

export interface MarketHour {
  dayOfWeek: number; // 0 = Sunday, matching Date.getDay()
  opens: string; // "09:00" or "09:00:00"
  closes: string;
  note?: string | null;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Minutes past midnight for a "HH:MM[:SS]" string, or null if it isn't one. */
export function toMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "09:00:00" → "9:00 AM". Returns the input unchanged when it isn't a time. */
export function formatTime(time: string): string {
  const mins = toMinutes(time);
  if (mins === null) return time;
  const h24 = Math.floor(mins / 60);
  const min = mins % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${suffix}`;
}

export function formatSpan(hour: MarketHour): string {
  return `${formatTime(hour.opens)} – ${formatTime(hour.closes)}`;
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

/** A compact one-liner for a card: "Sat · 9:00 AM – 3:00 PM", or several days joined. */
export function shortSummary(hours: MarketHour[], max = 2): string | null {
  if (hours.length === 0) return null;
  const sorted = [...hours].sort(byDayThenOpen);
  const shown = sorted
    .slice(0, max)
    .map((h) => `${DAY_ABBR[h.dayOfWeek] ?? "—"} · ${formatSpan(h)}`);
  const rest = sorted.length - shown.length;
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
  const d = occ.date;
  return `${DAY_ABBR[d.getDay()]}, ${MONTH_ABBR[d.getMonth()]} ${d.getDate()} · ${formatSpan(occ.hour)}`;
}
