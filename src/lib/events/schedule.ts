import { DAY_ABBR, DAY_NAMES, MONTH_ABBR, formatSpan, formatTime } from "@/lib/time/wall-clock";

/**
 * Events — pure arithmetic over wall-clock dates and times.
 *
 * The time-zone rule is the same one `markets/schedule.ts` and `orders/drops.ts` both landed on,
 * from opposite directions:
 *
 *   - `event_date` is a DATE and `starts_at`/`ends_at` are TIMEs. They are wall clock AT THE VENUE.
 *     Formatting them ("Saturday 14 December · 9:00 AM – 1:00 PM") needs no time zone and is safe
 *     to render on the server, which is what a search engine and a reader with no JS get.
 *   - Deciding whether an event is TODAY needs to know what day it is where the reader is, and the
 *     server runs UTC — at 8pm Pacific it already thinks it is tomorrow. So every function that
 *     compares against "now" takes the reference day as an argument, and the caller supplies it:
 *     the client from its own clock, the server from a deliberately generous window.
 *
 * A date is passed around as "YYYY-MM-DD" rather than as a `Date`, because a `Date` is an instant
 * and the moment one enters this module somebody will compare it to another instant and reintroduce
 * the bug. Strings in this format compare correctly with `<`, which is the whole trick.
 */

export interface EventLike {
  id: string;
  title: string;
  /** "YYYY-MM-DD", local to the venue. */
  eventDate: string;
  /** "HH:MM[:SS]", local to the venue. Null when the seller didn't give a time. */
  startsAt: string | null;
  endsAt: string | null;
  status: "published" | "hidden" | "cancelled";
  cancelledNote?: string | null;
}

/** Today where the READER is, as "YYYY-MM-DD". Never call this on the server. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Shift a "YYYY-MM-DD" by whole days, staying in string space. */
export function addDays(date: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return date;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  return localToday(d);
}

/** Parse "YYYY-MM-DD" as a LOCAL date — `new Date(str)` reads it as UTC and shifts the day. */
export function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Saturday 14 December". */
export function formatEventDate(date: string): string {
  const d = parseLocalDate(date);
  if (!d) return date;
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}

/** "Sat 14 Dec" — for a dense list. */
export function formatEventDateShort(date: string): string {
  const d = parseLocalDate(date);
  if (!d) return date;
  return `${DAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}

/**
 * The time half: "9:00 AM – 1:00 PM", "from 9:00 AM", or null.
 *
 * A seller who gave a start and no end is saying "we arrive at nine", not "we leave at nine" — so
 * it reads as "from", never as a span with an invented end.
 */
export function formatEventTime(event: EventLike): string | null {
  if (!event.startsAt) return null;
  if (!event.endsAt) return `from ${formatTime(event.startsAt)}`;
  return formatSpan(event.startsAt, event.endsAt);
}

/** "Saturday 14 December · 9:00 AM – 1:00 PM". Time-zone free, safe on the server. */
export function formatEventWhen(event: EventLike): string {
  const time = formatEventTime(event);
  const date = formatEventDate(event.eventDate);
  return time ? `${date} · ${time}` : date;
}

/**
 * How to head this event in a list, relative to the reader's own day.
 *
 * "Today" and "Tomorrow" are worth more than a date to someone deciding what to do, and they are
 * exactly the two labels that are wrong if computed on a UTC server — hence `today` being required
 * rather than defaulted.
 */
export function eventDayLabel(event: EventLike, today: string): string {
  if (event.eventDate === today) return "Today";
  if (event.eventDate === addDays(today, 1)) return "Tomorrow";
  return formatEventDate(event.eventDate);
}

export function isPast(event: EventLike, today: string): boolean {
  return event.eventDate < today;
}

/** Within the next `days` days, inclusive of today. */
export function isWithin(event: EventLike, today: string, days: number): boolean {
  return event.eventDate >= today && event.eventDate <= addDays(today, days);
}

/**
 * Upcoming events, soonest first, cancelled ones kept.
 *
 * A cancelled event stays in the list until its date passes, which is deliberate: someone who
 * planned around it needs to find out, and silently removing the row tells them nothing. It sorts
 * with the rest so it appears where they will look for it.
 */
export function upcomingEvents<T extends EventLike>(events: T[], today: string, limit?: number): T[] {
  const out = events
    .filter((e) => e.status !== "hidden" && !isPast(e, today))
    .sort((a, b) => {
      if (a.eventDate !== b.eventDate) return a.eventDate.localeCompare(b.eventDate);
      return (a.startsAt ?? "").localeCompare(b.startsAt ?? "");
    });
  return limit == null ? out : out.slice(0, limit);
}

/** Upcoming events grouped under one heading per day, for a calendar. */
export function groupByDay<T extends EventLike>(
  events: T[],
  today: string,
): { date: string; label: string; events: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const e of upcomingEvents(events, today)) {
    const list = groups.get(e.eventDate) ?? [];
    list.push(e);
    groups.set(e.eventDate, list);
  }

  return [...groups.entries()].map(([date, list]) => ({
    date,
    label: eventDayLabel(list[0], today),
    events: list,
  }));
}

/** One line for a card: "Today · 9:00 AM – 1:00 PM" or "Sat 14 Dec · from 9:00 AM". */
export function summarizeEvent(event: EventLike, today: string): string {
  const time = formatEventTime(event);
  const day =
    event.eventDate === today
      ? "Today"
      : event.eventDate === addDays(today, 1)
        ? "Tomorrow"
        : formatEventDateShort(event.eventDate);

  const base = time ? `${day} · ${time}` : day;
  return event.status === "cancelled" ? `${base} — cancelled` : base;
}
