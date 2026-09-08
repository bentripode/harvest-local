/**
 * Pure formatting and aggregation for the public cottage-food guide.
 *
 * Separate from the reads in `guide.ts` for the same reason `obligations.ts` is separate from
 * `obligation-queries.ts`: these two functions turn rows into a legal claim on a page anybody can
 * read, and that is the part worth testing without a database in the way.
 */

/** Whether a state permits taking food orders online, across all its programmes. */
export type OnlineVerdict = "allowed" | "banned" | "unclear" | "mixed";

/**
 * One state's answer from its programmes' answers.
 *
 * Shared by the index and the state page, because stating this rule twice is how the two would
 * eventually disagree about the same state. `mixed` requires at least one `allowed`: a state whose
 * routes are only `banned` and `unclear` has nothing affirmative in it, so "depends which
 * programme" would imply a permission nobody granted.
 */
export function aggregateOnlineVerdict(verdicts: string[]): OnlineVerdict {
  const set = new Set(verdicts);
  if (set.size === 0) return "unclear";
  if (set.size === 1) return [...set][0] as OnlineVerdict;
  return set.has("allowed") ? "mixed" : "unclear";
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

/**
 * "every year, by 15th January" / "every 2 years".
 *
 * Falls back to a bare "recurring" when the row doesn't carry the fields its schedule needs — a
 * reminder on a made-up date is worse than none, since a seller who finds one wrong stops trusting
 * the rest.
 */
export function cadence(row: {
  schedule: string;
  due_month: number | null;
  due_day: number | null;
  interval_months: number | null;
}): string {
  if (row.schedule === "fixed_date" && row.due_month && row.due_day) {
    return `every year, by ${ordinal(row.due_day)} ${MONTHS[row.due_month - 1]}`;
  }
  if (row.schedule === "interval" && row.interval_months) {
    const m = row.interval_months;
    if (m === 12) return "every year";
    if (m % 12 === 0) return `every ${m / 12} years`;
    return `every ${m} months`;
  }
  return "recurring";
}
