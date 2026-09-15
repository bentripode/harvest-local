"use client";

import { useCallback, useSyncExternalStore } from "react";

import { formatOccurrence, nextOccurrence, type MarketHour } from "@/lib/markets/schedule";

/**
 * "Next open · Sat, Sep 12 · 9:00 AM – 3:00 PM".
 *
 * Computed on the client on purpose. Which day it currently is depends on where the reader is, and
 * the server runs in UTC — at 8pm Pacific it already believes it is tomorrow, which would push a
 * market happening today a week into the future. The weekly schedule beside this is
 * server-rendered and time-zone free, so a reader with no JS still gets the useful part.
 *
 * `useSyncExternalStore` rather than an effect, matching `cart-provider`: the server snapshot is
 * null, the client snapshot is the label, and there is no mount-time setState.
 */

/** Nothing to subscribe to — the label only needs to be right as of render. */
const noopSubscribe = () => () => {};

export function MarketNextOpen({ hours }: { hours: MarketHour[] }) {
  const getSnapshot = useCallback(() => {
    const occ = nextOccurrence(hours);
    return occ ? formatOccurrence(occ) : null;
  }, [hours]);

  // Strings compare by value, so repeated snapshots are stable and this never loops.
  const label = useSyncExternalStore(noopSubscribe, getSnapshot, () => null);

  if (!label) return null;

  return (
    <p className="inline-flex items-center rounded-full border px-3 py-1 text-sm">
      <span className="text-muted-foreground">Next open</span>
      <span className="px-1.5">·</span>
      <span className="font-medium">{label}</span>
    </p>
  );
}
