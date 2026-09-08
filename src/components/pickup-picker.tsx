"use client";

import { Label } from "@/components/ui/label";
import type { PickupLocation } from "@/lib/orders/pickup";
import { describePrepTime, type PickupOccurrence } from "@/lib/orders/pickup-schedule";

/**
 * Where and when the buyer collects.
 *
 * The list of times is computed by the caller on the *buyer's* clock, not the server's — the server
 * runs UTC and would push a slot happening today into tomorrow all evening on the west coast.
 * `startCheckoutAction` re-derives the same list server-side and refuses anything that isn't in it,
 * so this chooses what to show and never what is allowed.
 */
export function PickupPicker({
  locations,
  chosen,
  options,
  locationId,
  onLocation,
  window: selectedWindow,
  onWindow,
}: {
  locations: PickupLocation[];
  chosen: PickupLocation | null;
  options: PickupOccurrence[];
  locationId: string;
  onLocation: (id: string) => void;
  window: string;
  onWindow: (w: string) => void;
}) {
  const notice = chosen ? describePrepTime(chosen.prepHours) : null;

  return (
    <div className="space-y-3 rounded-md border p-3">
      {locations.length > 1 ? (
        <div className="space-y-1.5">
          <Label htmlFor="p-location">Pickup point</Label>
          <select
            id="p-location"
            value={locationId}
            onChange={(e) => onLocation(e.target.value)}
            className="border-input h-9 w-full rounded-md border bg-transparent px-2.5 text-sm"
          >
            <option value="">Choose where to collect…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
                {l.market ? ` — ${l.market.name}` : l.city ? ` — ${l.city}` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : chosen ? (
        <div>
          <p className="text-sm font-medium">{chosen.label}</p>
          <p className="text-muted-foreground text-sm">
            {chosen.market ? chosen.market.name : chosen.city}
          </p>
        </div>
      ) : null}

      {chosen?.description ? (
        <p className="text-muted-foreground text-sm">{chosen.description}</p>
      ) : null}

      {chosen ? (
        options.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="p-window">Pickup time</Label>
            <select
              id="p-window"
              value={selectedWindow}
              onChange={(e) => onWindow(e.target.value)}
              className="border-input h-9 w-full rounded-md border bg-transparent px-2.5 text-sm"
            >
              <option value="">Choose a time…</option>
              {options.map((o) => (
                <option key={`${o.dateKey}-${o.opens}`} value={o.label}>
                  {o.label}
                </option>
              ))}
            </select>
            {notice ? (
              <p className="text-muted-foreground text-xs">
                This seller needs {notice}, so earlier slots aren&apos;t offered.
              </p>
            ) : null}
          </div>
        ) : (
          // Slots exist in principle but none are reachable — say so rather than showing an empty
          // dropdown the buyer can't satisfy.
          <p className="text-muted-foreground text-sm">
            No pickup times are scheduled here at the moment. The seller will be in touch to
            arrange one.
          </p>
        )
      ) : null}

      {chosen ? (
        <p className="text-muted-foreground text-xs">
          {/* Precise on purpose: it appears on the order page, and we don't email it. */}
          The exact address appears on your order once you&apos;ve paid.
        </p>
      ) : null}
    </div>
  );
}
