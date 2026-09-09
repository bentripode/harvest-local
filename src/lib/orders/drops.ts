/**
 * Pre-order batches — pure logic.
 *
 * A drop is one bake: an order window, a collection date, a hard cap. Everything a buyer reads
 * about one ("orders close Thursday", "6 of 20 left") is derived here, so the storefront, the
 * checkout and the seller's own list cannot describe the same batch differently.
 *
 * The cap is a physical fact rather than a stock level, so the language is deliberately concrete —
 * "6 left of 20" and not "in stock". A buyer who is told there are six needs that to be true.
 */

import { DAY_NAMES } from "@/lib/time/wall-clock";

export interface DropLike {
  id: string;
  name: string;
  opensAt: string | null;
  closesAt: string;
  fulfillmentDate: string;
  pickupWindow: string | null;
  unitCap: number;
  unitsClaimed: number;
  cancelledAt: string | null;
}

export type DropState =
  /** Announced, orders not open yet. */
  | "scheduled"
  /** Taking orders. */
  | "open"
  /** Every unit claimed. */
  | "sold_out"
  /** The order window has passed. */
  | "closed"
  | "cancelled";

export function unitsLeft(drop: DropLike): number {
  return Math.max(0, drop.unitCap - drop.unitsClaimed);
}

export function dropState(drop: DropLike, now: Date = new Date()): DropState {
  if (drop.cancelledAt) return "cancelled";

  const opens = drop.opensAt ? new Date(drop.opensAt) : null;
  const closes = new Date(drop.closesAt);

  if (opens && now < opens) return "scheduled";
  if (now >= closes) return "closed";
  // Sold out is reported ahead of the window closing, because it is the more useful fact: the
  // window may have days left on it and there is still nothing to buy.
  if (unitsLeft(drop) === 0) return "sold_out";
  return "open";
}

/** Whether a buyer may order against this batch right now. */
export function isOrderable(drop: DropLike, now: Date = new Date()): boolean {
  return dropState(drop, now) === "open";
}

const MONTH = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Parse "YYYY-MM-DD" as a LOCAL date — `new Date(str)` reads it as UTC and shifts the day. */
export function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * "Saturday 14 December". The collection date, in the words a seller would use.
 *
 * Safe to render anywhere because `fulfillment_date` is a DATE — a wall-clock day at the seller's
 * place, not an instant. The order WINDOW is the opposite (see `closesIn`).
 */
export function formatFulfillment(drop: DropLike): string {
  const d = parseLocalDate(drop.fulfillmentDate);
  if (!d) return drop.fulfillmentDate;
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

/**
 * How far off an instant is: "2 days", "6 hours", "under an hour". Null once it has passed.
 *
 * The order window is stored as timestamptz — two instants — and a DURATION is the only way to
 * describe an instant that is right for everyone reading it. Naming the day instead would mean
 * picking a clock, and the server's clock is UTC: "orders open Tuesday 15 December" renders on a
 * Texas seller's page for a window that opens at 6pm on the Monday. The same trap as
 * `markets/schedule.ts`, in the same shape.
 *
 * Rounded DOWN throughout. A buyer told "2 days" who actually has two days and twenty hours has
 * lost nothing; one told "3 days" who has two and a bit misses the bake.
 */
export function timeUntil(instant: string, now: Date = new Date()): string | null {
  const ms = new Date(instant).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const hours = ms / 3_600_000;
  if (hours < 1) return "under an hour";
  if (hours < 24) {
    const h = Math.floor(hours);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** How long is left to order. Null once the window has closed. */
export function closesIn(drop: DropLike, now: Date = new Date()): string | null {
  return timeUntil(drop.closesAt, now);
}

/** How long until orders open. Null once they have. */
export function opensIn(drop: DropLike, now: Date = new Date()): string | null {
  return drop.opensAt ? timeUntil(drop.opensAt, now) : null;
}

/**
 * The one line a buyer reads on the listing. Never says "in stock" — a batch either has units left
 * or it does not, and the number is the point.
 */
export function describeDrop(drop: DropLike, now: Date = new Date()): string {
  const when = formatFulfillment(drop);
  const left = unitsLeft(drop);

  switch (dropState(drop, now)) {
    case "cancelled":
      return `${drop.name} was cancelled.`;
    case "scheduled": {
      const until = opensIn(drop, now);
      return until
        ? `Orders open in ${until} — ${drop.unitCap} for collection ${when}.`
        : `${drop.unitCap} for collection ${when}.`;
    }
    case "sold_out":
      return `Sold out — all ${drop.unitCap} claimed. Collection ${when}.`;
    case "closed":
      return `Orders closed. ${drop.unitsClaimed} of ${drop.unitCap} claimed, collect ${when}.`;
    case "open": {
      const remaining = closesIn(drop, now);
      const urgency = remaining ? ` Orders close in ${remaining}.` : "";
      return `${left} of ${drop.unitCap} left — collect ${when}.${urgency}`;
    }
  }
}

// ===========================================================================
// Which drop, if any, governs a listing.
//
// A listing that has a drop SELLS THROUGH IT, and is not orderable between batches. The tempting
// alternative — fall back to ordinary open-ended selling once the window shuts — is the oversell
// this whole feature exists to prevent: a baker caps Saturday at twenty loaves, the window closes
// on Thursday night, and on Friday someone buys five more with no batch and no collection date
// attached. So the presence of a non-cancelled drop is what puts a listing into batch mode, and
// cancelling every drop is what takes it back out.
//
// The cost is a listing that goes quiet after its last batch until the seller schedules another.
// That is the direction to fail in, and the seller UI says so in as many words.
// ===========================================================================

export interface DropGate {
  /** True when this listing sells by batch at all. */
  sellsByDrop: boolean;
  /** The batch a new order would join. Null when nothing is open. */
  orderable: DropLike | null;
  /** The next batch announced but not yet open, for "orders open Friday". */
  next: DropLike | null;
  /** The batch to put in front of the buyer, whatever state it is in. */
  current: DropLike | null;
}

export function gateByDrops(drops: DropLike[], now: Date = new Date()): DropGate {
  const live = drops.filter((d) => !d.cancelledAt);
  if (live.length === 0) {
    return { sellsByDrop: false, orderable: null, next: null, current: null };
  }

  const orderable = live.find((d) => dropState(d, now) === "open") ?? null;

  // The soonest announced batch. The exclusion constraint stops two windows overlapping, so
  // "soonest by opens_at" is unambiguous.
  const next =
    live
      .filter((d) => dropState(d, now) === "scheduled")
      .sort((a, b) => (a.opensAt ?? "").localeCompare(b.opensAt ?? ""))[0] ?? null;

  // Failing both, the buyer still deserves to know what happened — most often "sold out", which is
  // a batch that is neither open nor upcoming and is the single most useful thing to say.
  const latest =
    [...live].sort((a, b) => b.closesAt.localeCompare(a.closesAt))[0] ?? null;

  return { sellsByDrop: true, orderable, next, current: orderable ?? next ?? latest };
}

/** Why a buyer can't order right now, in a sentence. Null when they can. */
export function describeDropGate(gate: DropGate, now: Date = new Date()): string | null {
  if (!gate.sellsByDrop || gate.orderable) return null;
  if (gate.current) return describeDrop(gate.current, now);

  return "This is made to order in batches. The next one hasn't been announced yet.";
}

/** What gets frozen onto the order item, so the collection date survives the drop being edited. */
export function dropSnapshot(drop: DropLike): string {
  const when = formatFulfillment(drop);
  return drop.pickupWindow
    ? `${drop.name} — collect ${when}, ${drop.pickupWindow}`
    : `${drop.name} — collect ${when}`;
}

/**
 * How many a buyer may take: the batch and the shelf, whichever is smaller.
 *
 * Both are real limits — `quantity_available` is what the seller says they have, the cap is what
 * the oven holds — so the smaller one governs, which is the under-selling answer. Null means
 * genuinely unlimited, and only an ordinary listing can be that.
 */
export function stockWithDrops(
  drops: DropLike[],
  shelfStock: number | null,
  now: Date = new Date(),
): number | null {
  const gate = gateByDrops(drops, now);
  if (!gate.sellsByDrop) return shelfStock;
  if (!gate.orderable) return 0;

  const left = unitsLeft(gate.orderable);
  return shelfStock == null ? left : Math.min(left, shelfStock);
}
