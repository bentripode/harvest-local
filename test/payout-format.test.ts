import { describe, expect, it } from "vitest";

import {
  describePayout,
  formatArrival,
  payoutStatus,
  splitPayouts,
  sumAmounts,
  type PayoutLike,
} from "@/lib/payouts/format";

/**
 * A payout ledger is read by someone who is short of money they expected. So the tests care about
 * two things: that a failed payout never reads as one that is still coming, and that nothing here
 * invents a figure Stripe didn't send.
 */

const payout = (over: Partial<PayoutLike> = {}): PayoutLike => ({
  stripePayoutId: "po_1",
  amount: "372.18",
  currency: "usd",
  status: "paid",
  arrivalDate: "2026-12-14",
  stripeCreatedAt: "2026-12-11T10:00:00Z",
  failureCode: null,
  failureMessage: null,
  method: "standard",
  ...over,
});

describe("payoutStatus", () => {
  it("keeps 'scheduled' and 'on its way' apart", () => {
    // Different facts: one is queued at Stripe, the other has left. A seller ringing their bank
    // needs to know which, so they are never collapsed into one "processing".
    expect(payoutStatus(payout({ status: "pending" })).label).toBe("Scheduled");
    expect(payoutStatus(payout({ status: "in_transit" })).label).toBe("On its way");
    expect(payoutStatus(payout({ status: "pending" })).detail).not.toBe(
      payoutStatus(payout({ status: "in_transit" })).detail,
    );
  });

  it("marks a failure and a cancellation as needing attention", () => {
    expect(payoutStatus(payout({ status: "failed" })).tone).toBe("attention");
    expect(payoutStatus(payout({ status: "canceled" })).tone).toBe("attention");
  });

  it("says where the money went when a payout fails", () => {
    // The seller's next question is "so where is it?" — answered before they have to ask.
    expect(payoutStatus(payout({ status: "failed" })).detail).toMatch(/back in your Stripe balance/);
  });

  it("shows an unfamiliar status as itself rather than guessing", () => {
    // Stripe can add one. Being visibly unfamiliar beats being confidently wrong about money.
    const status = payoutStatus(payout({ status: "some_new_state" }));
    expect(status.label).toBe("some_new_state");
    expect(status.detail).toBeNull();
  });
});

describe("formatArrival", () => {
  it("names the banking day", () => {
    expect(formatArrival("2026-12-14")).toBe("Mon 14 Dec");
  });

  it("reads the date as the day Stripe meant, not the day UTC makes of it", () => {
    // `new Date("2026-12-14")` is midnight UTC — the 13th anywhere west of Greenwich.
    expect(formatArrival("2026-12-14")).toContain("14");
  });

  it("is null when Stripe didn't give one", () => {
    expect(formatArrival(null)).toBeNull();
  });
});

describe("describePayout", () => {
  it("says when a paid one landed", () => {
    expect(describePayout(payout())).toBe("Paid Mon 14 Dec");
  });

  it("says when a scheduled one is expected", () => {
    expect(describePayout(payout({ status: "pending" }))).toBe("Scheduled — expected Mon 14 Dec");
  });

  it("NEVER offers an arrival date for a payout that failed", () => {
    // Stripe leaves `arrival_date` populated on a failed payout. Repeating it would have a seller
    // waiting on a Monday for money that is not coming.
    expect(describePayout(payout({ status: "failed" }))).toBe("Failed");
    expect(describePayout(payout({ status: "canceled" }))).toBe("Cancelled");
  });

  it("copes with no arrival date at all", () => {
    expect(describePayout(payout({ arrivalDate: null }))).toBe("Paid");
    expect(describePayout(payout({ status: "pending", arrivalDate: null }))).toBe("Scheduled");
  });
});

describe("splitPayouts", () => {
  const pending = payout({ stripePayoutId: "po_pending", status: "pending", arrivalDate: "2026-12-20" });
  const transit = payout({ stripePayoutId: "po_transit", status: "in_transit", arrivalDate: "2026-12-15" });
  const paid = payout({ stripePayoutId: "po_paid", status: "paid", arrivalDate: "2026-12-10" });
  const older = payout({ stripePayoutId: "po_older", status: "paid", arrivalDate: "2026-12-01" });
  const failed = payout({ stripePayoutId: "po_failed", status: "failed", arrivalDate: "2026-12-18" });

  it("puts a FAILED payout in history, not in what's coming", () => {
    // The bug this guards: a failed payout with a future arrival_date sorting into "on the way".
    const { upcoming, history } = splitPayouts([failed, pending]);
    expect(upcoming.map((p) => p.stripePayoutId)).toEqual(["po_pending"]);
    expect(history.map((p) => p.stripePayoutId)).toEqual(["po_failed"]);
  });

  it("puts a cancelled payout in history too", () => {
    const cancelled = payout({ stripePayoutId: "po_cancelled", status: "canceled" });
    expect(splitPayouts([cancelled]).upcoming).toHaveLength(0);
  });

  it("orders what's coming soonest first", () => {
    const { upcoming } = splitPayouts([pending, transit]);
    expect(upcoming.map((p) => p.stripePayoutId)).toEqual(["po_transit", "po_pending"]);
  });

  it("orders history most recent first", () => {
    const { history } = splitPayouts([older, paid]);
    expect(history.map((p) => p.stripePayoutId)).toEqual(["po_paid", "po_older"]);
  });

  it("is empty on both sides for no payouts", () => {
    expect(splitPayouts([])).toEqual({ upcoming: [], history: [] });
  });
});

describe("sumAmounts", () => {
  it("adds in minor units, so nothing drifts in floating point", () => {
    expect(sumAmounts([payout({ amount: "0.10" }), payout({ amount: "0.20" })])).toBe("0.30");
  });

  it("totals a realistic run exactly", () => {
    expect(
      sumAmounts([
        payout({ amount: "372.18" }),
        payout({ amount: "104.55" }),
        payout({ amount: "9.99" }),
      ]),
    ).toBe("486.72");
  });

  it("is zero for nothing", () => {
    expect(sumAmounts([])).toBe("0.00");
  });
});
