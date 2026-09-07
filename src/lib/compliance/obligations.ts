/**
 * When a recurring obligation next falls due.
 *
 * Pure, and separate from the reads, because the arithmetic is the part that can be wrong in a way
 * nobody notices: a reminder that fires on the wrong day is worse than none, since a seller who
 * learns the dates are unreliable stops reading them.
 */

export type ObligationSchedule = "fixed_date" | "interval";

export interface ObligationRule {
  id: string;
  kind: string;
  label: string;
  detail: string;
  citation: string | null;
  sourceUrl: string | null;
  schedule: ObligationSchedule;
  dueMonth: number | null;
  dueDay: number | null;
  intervalMonths: number | null;
}

export interface DueOccurrence {
  /** The day it is due, as YYYY-MM-DD. */
  dueDate: string;
  /**
   * Which occurrence this is. A fixed-date obligation keys on the due year; an interval one keys on
   * the date its clock last restarted, since there is no calendar year that identifies it.
   */
  periodKey: string;
  /** Whole days from `today` until it is due. Negative once it is overdue. */
  daysOut: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse YYYY-MM-DD as a UTC date, so a reminder does not shift by a day across time zones. */
function parseDay(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  // Clamp: a clock started on the 31st lands on the last day of a shorter month rather than
  // wrapping into the next one.
  const lastDay = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, lastDay));
  return out;
}

/**
 * The next occurrence of `rule` for a seller, given today and what they have already done.
 *
 * `lastCompleted` is the ISO day of the most recent completion, or null. `startedOn` is the day
 * their storefront began — the anchor for an interval obligation nobody has ever completed, because
 * "annually thereafter" has to count from something and the day they began is the honest choice.
 */
export function nextDue(
  rule: ObligationRule,
  today: string,
  lastCompleted: string | null,
  startedOn: string,
): DueOccurrence | null {
  const now = parseDay(today);

  if (rule.schedule === "fixed_date") {
    if (rule.dueMonth == null || rule.dueDay == null) return null;

    const doneFor = (year: number) =>
      lastCompleted != null && String(year) === periodOf(lastCompleted, rule);
    const dayIn = (year: number) => new Date(Date.UTC(year, rule.dueMonth! - 1, rule.dueDay!));

    // This year's deadline; then next year's if it has passed; then next year's again if the one we
    // landed on is already filed. Both steps are needed and the order matters — a filing made in
    // December satisfies the January deadline that is still ahead of us, so rolling for the date
    // and then checking completion would nag a seller who has done everything right.
    let year = now.getUTCFullYear();
    if (dayIn(year).getTime() < now.getTime()) year += 1;
    if (doneFor(year)) year += 1;
    const due = dayIn(year);
    return {
      dueDate: iso(due),
      periodKey: String(due.getUTCFullYear()),
      daysOut: Math.round((due.getTime() - now.getTime()) / DAY_MS),
    };
  }

  if (rule.intervalMonths == null) return null;
  const anchor = parseDay(lastCompleted ?? startedOn);
  const due = addMonths(anchor, rule.intervalMonths);
  return {
    dueDate: iso(due),
    // The clock's start identifies the occurrence: two renewals a year apart have different anchors.
    periodKey: iso(anchor),
    daysOut: Math.round((due.getTime() - now.getTime()) / DAY_MS),
  };
}

/** For a fixed-date rule, which year a completion counts for. */
function periodOf(completedOn: string, rule: ObligationRule): string {
  const d = parseDay(completedOn);
  if (rule.dueMonth == null || rule.dueDay == null) return String(d.getUTCFullYear());
  // A filing made in December for the January deadline counts for the coming year, not the one
  // ending — which is exactly when a diligent seller does it.
  const deadlineThisYear = new Date(Date.UTC(d.getUTCFullYear(), rule.dueMonth - 1, rule.dueDay));
  return String(d.getTime() > deadlineThisYear.getTime() ? d.getUTCFullYear() + 1 : d.getUTCFullYear());
}

/** The reminder points, furthest out first. */
export const REMINDER_DAYS = [30, 10, 1] as const;
export type ReminderDay = (typeof REMINDER_DAYS)[number];

/**
 * Which reminder, if any, today's scan should send for an occurrence.
 *
 * The bands are inclusive downwards so a scan that misses a day — a deploy, an outage — still sends
 * the 10-day notice at 9 days rather than skipping it silently. `alreadySent` stops the repeat.
 */
export function reminderDue(daysOut: number, alreadySent: readonly number[]): ReminderDay | null {
  if (daysOut < 0) return null;
  for (const band of REMINDER_DAYS) {
    if (daysOut <= band && !alreadySent.includes(band)) return band;
  }
  return null;
}
