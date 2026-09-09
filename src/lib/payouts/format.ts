import type { Money } from "@/lib/money";
import { DAY_ABBR, MONTH_ABBR } from "@/lib/time/wall-clock";

/**
 * Turning a mirrored Stripe payout into something a seller can read — pure, so it is testable and
 * so the seller page and any future email say the same thing.
 *
 * `status` is Stripe's own string, stored verbatim (see the migration). This module maps it to a
 * sentence WITHOUT collapsing states together: `pending` and `in_transit` are different facts —
 * one is "Stripe has scheduled it", the other is "it has left" — and a seller ringing their bank
 * needs to know which. An unknown status falls through as itself rather than being guessed at,
 * because Stripe can add one and being visibly unfamiliar beats being confidently wrong.
 */

export interface PayoutLike {
  stripePayoutId: string;
  /** Decimal string, as numeric arrives over the wire. */
  amount: Money;
  currency: string;
  status: string;
  /** "YYYY-MM-DD" — a banking day, not an instant. */
  arrivalDate: string | null;
  stripeCreatedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  method: string | null;
}

export type PayoutTone = "settled" | "moving" | "attention";

export interface PayoutStatus {
  label: string;
  tone: PayoutTone;
  /** One sentence. Null where the label already says everything. */
  detail: string | null;
}

export function payoutStatus(payout: PayoutLike): PayoutStatus {
  switch (payout.status) {
    case "paid":
      return { label: "Paid", tone: "settled", detail: null };
    case "in_transit":
      return {
        label: "On its way",
        tone: "moving",
        detail: "Stripe has sent it to your bank. Banks usually take a day or two to post it.",
      };
    case "pending":
      return {
        label: "Scheduled",
        tone: "moving",
        detail: "Stripe has this queued and hasn't sent it yet.",
      };
    case "canceled":
      return {
        label: "Cancelled",
        tone: "attention",
        detail: "This payout was called off. The money went back to your Stripe balance.",
      };
    case "failed":
      return {
        label: "Failed",
        tone: "attention",
        // The reason is rendered separately from `failure_message`, which is Stripe's own wording.
        detail: "Your bank didn't accept it. The money is back in your Stripe balance.",
      };
    default:
      // Stripe added a status we don't know. Show it rather than pretend it is one we do.
      return { label: payout.status, tone: "moving", detail: null };
  }
}

/** Parse "YYYY-MM-DD" as a LOCAL date — `new Date(str)` reads it as UTC and shifts the day. */
export function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Mon 14 Dec". Safe anywhere — `arrival_date` is a banking day, not an instant. */
export function formatArrival(date: string | null): string | null {
  if (!date) return null;
  const d = parseLocalDate(date);
  if (!d) return date;
  return `${DAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}

/**
 * What a payout says on one line, without asserting anything Stripe didn't.
 *
 * Note what is missing: no "of which $X was fees", no order count, no running balance. Those are
 * numbers we would have to derive, and the whole point of this ledger is that it repeats Stripe
 * rather than competing with it.
 */
export function describePayout(payout: PayoutLike): string {
  const status = payoutStatus(payout);
  const arrival = formatArrival(payout.arrivalDate);

  if (payout.status === "paid") {
    return arrival ? `Paid ${arrival}` : "Paid";
  }
  if (payout.status === "failed" || payout.status === "canceled") {
    return status.label;
  }
  return arrival ? `${status.label} — expected ${arrival}` : status.label;
}

/**
 * Split a list into what is still coming and what has settled.
 *
 * Cancelled and failed payouts sit in HISTORY, not in "on the way": they are finished, whatever they
 * finished as. Putting a failed payout under "expected" would have a seller waiting for money that
 * is never arriving.
 */
export function splitPayouts<T extends PayoutLike>(
  payouts: T[],
): { upcoming: T[]; history: T[] } {
  const upcoming: T[] = [];
  const history: T[] = [];

  for (const p of payouts) {
    if (p.status === "pending" || p.status === "in_transit") upcoming.push(p);
    else history.push(p);
  }

  // Soonest first for what's coming; most recent first for what's done.
  upcoming.sort((a, b) => (a.arrivalDate ?? "").localeCompare(b.arrivalDate ?? ""));
  history.sort((a, b) => (b.arrivalDate ?? "").localeCompare(a.arrivalDate ?? ""));

  return { upcoming, history };
}

/**
 * Total of the payouts that are still coming.
 *
 * Deliberately only ever summed over `upcoming`, and never presented as "your balance" — Stripe's
 * balance includes money not yet assigned to a payout, and a figure of ours labelled "balance"
 * would be a second, wrong answer to a question Stripe already answers exactly.
 */
export function sumAmounts(payouts: PayoutLike[]): string {
  const total = payouts.reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0);
  return (total / 100).toFixed(2);
}
