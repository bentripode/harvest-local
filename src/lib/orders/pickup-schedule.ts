import {
  DAY_NAMES,
  formatDayDate,
  formatSpan,
  formatTime,
  toMinutes,
  weekOfMonth,
} from "@/lib/time/wall-clock";

/**
 * When a buyer can actually collect an order — pure arithmetic over `pickup_slots`.
 *
 * Harder than a market's hours in three ways, each of which is a real thing sellers do:
 *
 *   - **Not every week.** "First and third Saturdays" is an ordinary way to run a stall.
 *     `weeksOfMonth` is empty for weekly, or the ordinals the slot runs on.
 *   - **One-off dates.** A holiday fair is a date, not a weekday, and a recurring slot the seller
 *     has to remember to delete is a slot they will forget to delete.
 *   - **Lead time.** A baker needs notice. `prepHours` pushes the earliest offered slot forward,
 *     so an order is never taken for a loaf due in twenty minutes.
 *
 * Time zones: these are wall-clock times at the collection point, and the arithmetic runs on
 * whatever `from` says. Callers that need "what can I pick today" must pass the *buyer's* clock,
 * which means the client — the server runs UTC and would be a day ahead all evening on the west
 * coast. See `PickupPicker`.
 */

export interface PickupSlot {
  /** 0 = Sunday, matching Date.getDay(). Null for a one-off. */
  dayOfWeek: number | null;
  /** "YYYY-MM-DD" for a one-off. Null for a recurring slot. */
  specificDate: string | null;
  opens: string;
  closes: string;
  /** Empty = every week. Otherwise which occurrences in the month: [1, 3] = 1st and 3rd. */
  weeksOfMonth: number[];
}

export interface PickupOccurrence {
  /** Local calendar date of the session. */
  date: Date;
  /** "YYYY-MM-DD" — the stable key a form submits. */
  dateKey: string;
  opens: string;
  closes: string;
  /** "Sat, Sep 12 · 9:00 AM – 3:00 PM" */
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Parse "YYYY-MM-DD" as a LOCAL date. `new Date(str)` would read it as UTC and shift the day. */
function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * The next `limit` times this location is open, at or after `from` plus `prepHours` of notice.
 *
 * A slot already under way still counts only if it stays open past the lead time — a buyer who
 * needs two hours' notice at 2:30pm cannot have a 3pm close.
 */
export function upcomingPickups(
  slots: PickupSlot[],
  {
    from = new Date(),
    prepHours = 0,
    limit = 8,
    horizonDays = 60,
  }: { from?: Date; prepHours?: number; limit?: number; horizonDays?: number } = {},
): PickupOccurrence[] {
  const earliest = new Date(from.getTime() + prepHours * 60 * 60 * 1000);
  const out: PickupOccurrence[] = [];

  const cursorStart = startOfDay(from);

  for (let offset = 0; offset <= horizonDays && out.length < limit; offset++) {
    const day = new Date(
      cursorStart.getFullYear(),
      cursorStart.getMonth(),
      cursorStart.getDate() + offset,
    );

    const matches = slots.filter((slot) => {
      const opens = toMinutes(slot.opens);
      const closes = toMinutes(slot.closes);
      if (opens === null || closes === null) return false;

      if (slot.specificDate) {
        const on = parseLocalDate(slot.specificDate);
        return on !== null && on.getTime() === day.getTime();
      }

      if (slot.dayOfWeek === null || slot.dayOfWeek !== day.getDay()) return false;
      if (slot.weeksOfMonth.length === 0) return true;
      return slot.weeksOfMonth.includes(weekOfMonth(day));
    });

    for (const slot of matches.sort(
      (a, b) => (toMinutes(a.opens) ?? 0) - (toMinutes(b.opens) ?? 0),
    )) {
      const closes = toMinutes(slot.closes)!;
      const closesAt = new Date(day.getTime() + closes * 60 * 1000);
      // The window has to still be open once the seller's notice period has elapsed.
      if (closesAt.getTime() <= earliest.getTime()) continue;

      out.push({
        date: day,
        dateKey: dateKey(day),
        opens: slot.opens,
        closes: slot.closes,
        label: `${formatDayDate(day)} · ${formatSpan(slot.opens, slot.closes)}`,
      });
      if (out.length >= limit) break;
    }
  }

  return out;
}

/**
 * A human summary of the recurring pattern, for the storefront and the seller's own list.
 * One-off dates are listed separately by the caller — they aren't a pattern.
 */
export function summarizeSlots(slots: PickupSlot[]): string[] {
  const weekly = slots.filter((s) => s.dayOfWeek !== null);
  const oneOff = slots.filter((s) => s.specificDate !== null);

  const lines = [...weekly]
    .sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0);
      return (toMinutes(a.opens) ?? 0) - (toMinutes(b.opens) ?? 0);
    })
    .map((s) => {
      const day = DAY_NAMES[s.dayOfWeek ?? 0] ?? "—";
      const when = s.weeksOfMonth.length > 0 ? `${ordinalList(s.weeksOfMonth)} ${day}` : `Every ${day}`;
      return `${when} · ${formatSpan(s.opens, s.closes)}`;
    });

  for (const s of oneOff) {
    const d = parseLocalDate(s.specificDate!);
    lines.push(
      d
        ? `${formatDayDate(d)} · ${formatSpan(s.opens, s.closes)}`
        : `${s.specificDate} · ${formatSpan(s.opens, s.closes)}`,
    );
  }

  return lines;
}

/** [1,3] → "1st & 3rd". */
export function ordinalList(weeks: number[]): string {
  const sorted = [...new Set(weeks)].sort((a, b) => a - b).map(ordinal);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return sorted[0];
  return `${sorted.slice(0, -1).join(", ")} & ${sorted[sorted.length - 1]}`;
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** How much notice the seller wants, in the words a buyer reads. */
export function describePrepTime(prepHours: number): string | null {
  if (prepHours <= 0) return null;
  if (prepHours < 24) return `${prepHours} hour${prepHours === 1 ? "" : "s"} notice`;
  const days = Math.round(prepHours / 24);
  return `${days} day${days === 1 ? "" : "s"} notice`;
}

export { DAY_MS, formatTime };
