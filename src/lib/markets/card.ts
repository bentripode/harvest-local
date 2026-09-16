import { MONTH_ABBR } from "@/lib/time/wall-clock";
import {
  formatSpan,
  formatTime,
  hoursNote,
  toMinutes,
  type MarketHour,
} from "@/lib/markets/schedule";

/**
 * What a market's card says about itself. Pure, so the list, the map popup and the tests agree —
 * the same arrangement as `products/card.ts`.
 *
 * The hard part is the "open today" highlight, which is the one claim on this page a reader will
 * act on by getting in a car. Two separate facts have to line up before we make it:
 *
 *   1. a recorded slot falls on the reader's own weekday — so `todayStatus` takes `now` as an
 *      argument and the caller supplies the reader's clock, never the UTC server's. Same rule as
 *      `events/schedule.ts` and `MarketNextOpen`, and for the same reason: at 8pm Pacific the
 *      server already believes it is tomorrow;
 *   2. the market is IN SEASON, which is where this gets interesting. `market_hours.note` is free
 *      prose from a directory - 741 distinct strings across 1,000 rows, mixing season with address
 *      and exceptions ("Weekly April to December; 2nd and 4th Saturdays January to March",
 *      "Year-round, except two weeks over Christmas and New Year"). Most markets shut for the
 *      winter, so a badge that ignores it is wrong for half the year in the direction that sends
 *      somebody to an empty car park.
 *
 * So `parseSeason` is deliberately timid: year-round, or exactly two month names with a range word
 * between them, and nothing else. Anything it cannot read stays `unknown`, and an unknown season
 * downgrades the claim from "Open today" to "Usually open today" with the season text printed
 * beside it. We say what we know and mark what we are guessing rather than rounding it up.
 */

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

export type Season =
  | { kind: "year_round" }
  /**
   * A closed range, inclusive. `from` may be later in the year than `to` — "October to July"
   * wraps. Days are captured when the note gives them: month precision alone reported a
   * "Late May to Sep 10" market as open on 16 September.
   */
  | {
      kind: "months";
      from: number;
      to: number;
      fromDay: number | null;
      toDay: number | null;
    }
  | { kind: "unknown" };
/**
 * A day of the month written immediately after a month name ("Sep 10"), or null.
 *
 * Bounded to 1-31 so the year in "Sep 30, 2026" is not read as a day, and anchored to the end of
 * the month word so "October 31" is read while "October ... 41 Homer" is not.
 */
function dayAfter(text: string, from: number): number | null {
  const m = /^[\s.,]*(\d{1,2})(?:st|nd|rd|th)?\b/.exec(text.slice(from));
  if (!m) return null;
  const day = Number(m[1]);
  return day >= 1 && day <= 31 ? day : null;
}

/** The month a name or three-letter abbreviation refers to (0-11), or null. */
function monthIndex(word: string): number | null {
  const w = word.toLowerCase();
  const exact = MONTHS.indexOf(w as (typeof MONTHS)[number]);
  if (exact >= 0) return exact;
  const abbr = MONTH_ABBR.findIndex((m) => m.toLowerCase() === w.slice(0, 3));
  return abbr >= 0 && w.length === 3 ? abbr : null;
}

/**
 * The season a note describes, when it describes one unambiguously.
 *
 * Refuses rather than guesses. Two month names joined by "to", "through", "til" or a dash is a
 * range we can act on; three or more means the note is describing more than one arrangement and we
 * cannot tell which applies, so it comes back `unknown`.
 */
export function parseSeason(note: string | null | undefined): Season {
  const text = note?.toLowerCase().trim();
  if (!text) return { kind: "unknown" };
  if (/year[\s-]?round|open daily|every day of the year|all year/.test(text)) {
    return { kind: "year_round" };
  }

  const found: { month: number; at: number; end: number }[] = [];
  for (const m of text.matchAll(/[a-z]+/g)) {
    const idx = monthIndex(m[0]);
    if (idx !== null) found.push({ month: idx, at: m.index, end: m.index + m[0].length });
  }
  if (found.length !== 2) return { kind: "unknown" };

  const between = text.slice(found[0].end, found[1].at);
  if (!/\b(to|through|thru|till?|until)\b|[-–—]/.test(between)) return { kind: "unknown" };

  return {
    kind: "months",
    from: found[0].month,
    to: found[1].month,
    fromDay: dayAfter(text, found[0].end),
    toDay: dayAfter(text, found[1].end),
  };
}

/** Whether `date`'s month falls inside the season. An unknown season is not a "no" — see below. */
export function inSeason(season: Season, date: Date): boolean {
  if (season.kind === "year_round") return true;
  if (season.kind === "unknown") return false;
  // Month-and-day as one comparable number. A missing day opens on the 1st and closes on the 31st,
  // which is the generous reading at each end — we only narrow on a day the note actually gave.
  const from = season.from * 100 + (season.fromDay ?? 1);
  const to = season.to * 100 + (season.toDay ?? 31);
  const now = date.getMonth() * 100 + date.getDate();
  return from <= to ? now >= from && now <= to : now >= from || now <= to;
}

export type MarketToday =
  /** A slot is running right now. */
  | { kind: "open_now"; until: string; confirmed: boolean }
  /** A slot falls later today. */
  | { kind: "open_later"; span: string; confirmed: boolean };

/**
 * Today's session, if there is one, as of `now` — which must be the reader's own clock.
 *
 * `confirmed` is the difference between "we know this market runs in September" and "our record
 * says Saturdays and we cannot read the season". Both are worth showing; only one of them is
 * worth saying plainly.
 */
export function todayStatus(
  hours: MarketHour[],
  now: Date,
  note?: string | null,
): MarketToday | null {
  if (hours.length === 0) return null;

  const season = parseSeason(note ?? hoursNote(hours));
  // A season we CAN read and that excludes today is a definite no - no badge at all.
  if (season.kind === "months" && !inSeason(season, now)) return null;
  const confirmed = inSeason(season, now);

  const today = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();

  let soonest: MarketHour | null = null;
  for (const h of hours) {
    if (h.dayOfWeek !== today) continue;
    const opens = toMinutes(h.opens);
    const closes = toMinutes(h.closes);
    if (opens === null || closes === null) continue;
    if (mins >= opens && mins < closes) {
      return { kind: "open_now", until: formatTime(h.closes), confirmed };
    }
    if (mins < opens && (soonest === null || opens < (toMinutes(soonest.opens) ?? 0))) {
      soonest = h;
    }
  }

  return soonest ? { kind: "open_later", span: formatSpan(soonest), confirmed } : null;
}

/** The ribbon's words. Kept here so the card and its test cannot disagree about the claim. */
export function todayLabel(status: MarketToday): string {
  if (status.kind === "open_now") {
    return status.confirmed
      ? `Open now · until ${status.until}`
      : `Probably open now · until ${status.until}`;
  }
  return status.confirmed ? `Open today · ${status.span}` : `Usually open today · ${status.span}`;
}

/**
 * Up to two letters for a market with no picture of its own.
 *
 * 88% of markets have no image (841 of 7,032), so the fallback is what most cards actually show
 * and it cannot be a grey box - that is the mistake the seller story cards already made. Words
 * like "farmers" and "market" are dropped because initialising every card to "FM" would defeat
 * the point of having initials at all.
 */
const SKIP = new Set([
  "farmers",
  "farmer",
  "farmers'",
  "market",
  "markets",
  "the",
  "at",
  "of",
  "and",
  "on",
  "co",
]);

export function marketInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  // A street number is not an initial: "6701 Burnet Road Market" gave "6B".
  const meaningful = words.filter((w) => !SKIP.has(w.toLowerCase()) && !/^\d+$/.test(w));
  const use = meaningful.length > 0 ? meaningful : words;
  return use
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * A stable tone for a market's fallback tile, so a card looks the same on every visit and a grid
 * of them is varied rather than striped. FNV-1a over the slug, mixed at the end - the plain hash
 * correlates badly across short similar ids, which is the bug `stories/select.ts` records.
 */
export function tileTone(slug: string, tones: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return Math.abs(h) % tones;
}
