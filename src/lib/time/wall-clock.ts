/**
 * Wall-clock times and weekday names, shared by everything that shows an opening time.
 *
 * A market's hours and a seller's pickup slots are both "9:00 AM – 3:00 PM on a Saturday" and both
 * are stored the same way, so they format through one module rather than two that drift into
 * "9:00 AM" and "9am" on adjacent lines of the same page.
 *
 * No time zone anywhere in here on purpose. These are wall-clock times at a place, not instants:
 * `market_hours.opens` and `pickup_slots.opens` are what the sign on the stall says. Anything that
 * needs to know what day it is *now* has to decide whose clock to ask, and that decision belongs to
 * the caller — see the note in `markets/schedule.ts`.
 */

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const MONTH_ABBR = [
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

/** "9:00 AM – 3:00 PM". */
export function formatSpan(opens: string, closes: string): string {
  return `${formatTime(opens)} – ${formatTime(closes)}`;
}

/** "Sat, Sep 12" from a local Date. */
export function formatDayDate(d: Date): string {
  return `${DAY_ABBR[d.getDay()]}, ${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

/** Which occurrence of its weekday a date is within its month: the 3rd Saturday → 3. */
export function weekOfMonth(d: Date): number {
  return Math.floor((d.getDate() - 1) / 7) + 1;
}
