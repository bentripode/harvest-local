import { describe, expect, it } from "vitest";

import {
  closesIn,
  describeDrop,
  dropState,
  formatFulfillment,
  isOrderable,
  describeDropGate,
  dropSnapshot,
  gateByDrops,
  parseLocalDate,
  unitsLeft,
  type DropLike,
} from "@/lib/orders/drops";

/**
 * The cap is a physical fact — twenty loaves is twenty loaves — so these tests care most about the
 * cases where a wrong answer would let a twenty-first order through, and about the copy, which is
 * the only place a buyer learns how many are left.
 */

const NOW = new Date("2026-12-10T12:00:00Z");

const drop = (over: Partial<DropLike> = {}): DropLike => ({
  id: "d1",
  name: "Saturday bake",
  opensAt: "2026-12-08T00:00:00Z",
  closesAt: "2026-12-11T23:59:00Z",
  fulfillmentDate: "2026-12-13",
  pickupWindow: "9am–noon",
  unitCap: 20,
  unitsClaimed: 14,
  cancelledAt: null,
  ...over,
});

describe("dropState", () => {
  it("is open inside the window with units left", () => {
    expect(dropState(drop(), NOW)).toBe("open");
    expect(isOrderable(drop(), NOW)).toBe(true);
  });

  it("is scheduled before the window opens", () => {
    expect(dropState(drop({ opensAt: "2026-12-11T00:00:00Z" }), NOW)).toBe("scheduled");
  });

  it("treats a null opens_at as open from creation", () => {
    expect(dropState(drop({ opensAt: null }), NOW)).toBe("open");
  });

  it("is closed once the window has passed", () => {
    expect(dropState(drop({ closesAt: "2026-12-09T00:00:00Z" }), NOW)).toBe("closed");
  });

  it("closes on the boundary, not a moment after it", () => {
    // `now >= closes_at` — the same comparison claim_drop_units makes, so the button disappears at
    // the instant the function starts refusing rather than a minute later.
    expect(dropState(drop({ closesAt: NOW.toISOString() }), NOW)).toBe("closed");
  });

  it("is sold out at the cap even with days left on the window", () => {
    expect(dropState(drop({ unitsClaimed: 20 }), NOW)).toBe("sold_out");
    expect(isOrderable(drop({ unitsClaimed: 20 }), NOW)).toBe(false);
  });

  it("is cancelled whatever else is true", () => {
    expect(dropState(drop({ cancelledAt: "2026-12-09T00:00:00Z" }), NOW)).toBe("cancelled");
    expect(isOrderable(drop({ cancelledAt: "2026-12-09T00:00:00Z" }), NOW)).toBe(false);
  });
});

describe("unitsLeft", () => {
  it("counts what is left", () => {
    expect(unitsLeft(drop())).toBe(6);
  });

  it("never goes negative, so an over-claimed row reads as sold out rather than as a credit", () => {
    // The CHECK constraint should make this impossible. If it ever isn't, "-1 left" must not become
    // an invitation to order one more.
    expect(unitsLeft(drop({ unitsClaimed: 21 }))).toBe(0);
    expect(dropState(drop({ unitsClaimed: 21 }), NOW)).toBe("sold_out");
  });
});

describe("parseLocalDate / formatFulfillment", () => {
  it("reads a date column as the day the seller typed, not the day UTC makes of it", () => {
    // `new Date("2026-12-13")` is midnight UTC, which is 12 December anywhere west of Greenwich —
    // the collection date is the one fact a buyer must not be told wrong.
    const d = parseLocalDate("2026-12-13")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(13);
  });

  it("names the weekday", () => {
    expect(formatFulfillment(drop())).toBe("Sunday 13 December");
  });

  it("returns the raw value rather than a wrong date when it can't parse one", () => {
    expect(parseLocalDate("13/12/2026")).toBeNull();
    expect(formatFulfillment(drop({ fulfillmentDate: "13/12/2026" }))).toBe("13/12/2026");
  });
});

describe("closesIn", () => {
  const at = (iso: string) => closesIn(drop({ closesAt: iso }), NOW);

  it("counts days down, rounding toward the buyer having less time", () => {
    expect(at("2026-12-13T08:00:00Z")).toBe("2 days");
  });

  it("switches to hours inside a day", () => {
    expect(at("2026-12-10T18:30:00Z")).toBe("6 hours");
    expect(at("2026-12-10T13:30:00Z")).toBe("1 hour");
  });

  it("says 'under an hour' rather than rounding to zero", () => {
    expect(at("2026-12-10T12:20:00Z")).toBe("under an hour");
  });

  it("is null once the window has passed", () => {
    expect(at("2026-12-10T12:00:00Z")).toBeNull();
    expect(at("2026-12-09T12:00:00Z")).toBeNull();
  });
});

describe("describeDrop", () => {
  it("leads with the number left, because that is the whole proposition", () => {
    expect(describeDrop(drop(), NOW)).toBe(
      "6 of 20 left — collect Sunday 13 December. Orders close in 1 day.",
    );
  });

  it("never claims stock it does not have", () => {
    expect(describeDrop(drop({ unitsClaimed: 20 }), NOW)).toBe(
      "Sold out — all 20 claimed. Collection Sunday 13 December.",
    );
  });

  it("counts down to opening rather than naming a day on the server's clock", () => {
    // opens_at is an instant and the server runs UTC. Naming the day would print "Friday 11
    // December" for a Texas seller whose window opens at 3am UTC — Thursday evening where they
    // and their buyers are. A duration is right on every clock.
    expect(describeDrop(drop({ opensAt: "2026-12-11T09:00:00Z" }), NOW)).toBe(
      "Orders open in 21 hours — 20 for collection Sunday 13 December.",
    );
  });

  it("says how the batch ended once it has closed", () => {
    expect(describeDrop(drop({ closesAt: "2026-12-09T00:00:00Z" }), NOW)).toBe(
      "Orders closed. 14 of 20 claimed, collect Sunday 13 December.",
    );
  });

  it("says so plainly when the seller cancelled", () => {
    expect(describeDrop(drop({ cancelledAt: "2026-12-09T00:00:00Z" }), NOW)).toBe(
      "Saturday bake was cancelled.",
    );
  });

  it("never uses shelf language", () => {
    for (const d of [drop(), drop({ unitsClaimed: 20 }), drop({ unitsClaimed: 0 })]) {
      expect(describeDrop(d, NOW)).not.toMatch(/in stock|available now|unlimited/i);
    }
  });
});

describe("gateByDrops", () => {
  const open = drop({ id: "open" });
  const scheduled = drop({
    id: "sched",
    opensAt: "2026-12-15T00:00:00Z",
    closesAt: "2026-12-18T00:00:00Z",
    fulfillmentDate: "2026-12-20",
  });
  const closed = drop({
    id: "closed",
    opensAt: "2026-12-01T00:00:00Z",
    closesAt: "2026-12-05T00:00:00Z",
    fulfillmentDate: "2026-12-06",
  });

  it("leaves a listing with no drops alone", () => {
    const gate = gateByDrops([], NOW);
    expect(gate.sellsByDrop).toBe(false);
    expect(gate.orderable).toBeNull();
    expect(describeDropGate(gate, NOW)).toBeNull();
  });

  it("sells through the open batch", () => {
    const gate = gateByDrops([closed, open, scheduled], NOW);
    expect(gate.orderable?.id).toBe("open");
    expect(describeDropGate(gate, NOW)).toBeNull();
  });

  it("does NOT fall back to ordinary selling once a batch closes", () => {
    // The oversell this feature exists to prevent: window shuts Thursday, someone buys five more
    // on Friday against an open-ended stock level with no collection date.
    const gate = gateByDrops([closed], NOW);
    expect(gate.sellsByDrop).toBe(true);
    expect(gate.orderable).toBeNull();
  });

  it("points at the next announced batch rather than at a dead listing", () => {
    const gate = gateByDrops([closed, scheduled], NOW);
    expect(gate.orderable).toBeNull();
    expect(gate.next?.id).toBe("sched");
    expect(describeDropGate(gate, NOW)).toBe(
      "Orders open in 4 days — 20 for collection Sunday 20 December.",
    );
  });

  it("says 'sold out' rather than 'not announced yet' when that is the truth", () => {
    const gate = gateByDrops([drop({ unitsClaimed: 20 })], NOW);
    expect(gate.orderable).toBeNull();
    expect(describeDropGate(gate, NOW)).toMatch(/^Sold out/);
  });

  it("takes a listing back out of batch mode when every drop is cancelled", () => {
    const gate = gateByDrops([drop({ cancelledAt: "2026-12-09T00:00:00Z" })], NOW);
    expect(gate.sellsByDrop).toBe(false);
  });

  it("picks the soonest of several announced batches", () => {
    const later = drop({
      id: "later",
      opensAt: "2026-12-20T00:00:00Z",
      closesAt: "2026-12-22T00:00:00Z",
    });
    expect(gateByDrops([later, scheduled], NOW).next?.id).toBe("sched");
  });
});

describe("dropSnapshot", () => {
  it("freezes the collection date, so editing the drop cannot move a placed order", () => {
    expect(dropSnapshot(drop())).toBe("Saturday bake — collect Sunday 13 December, 9am–noon");
  });

  it("copes with no stated window", () => {
    expect(dropSnapshot(drop({ pickupWindow: null }))).toBe(
      "Saturday bake — collect Sunday 13 December",
    );
  });
});
