"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelDropAction,
  createDropAction,
  setDropCapAction,
  type DropFormState,
} from "@/app/(dashboard)/seller/products/drop-actions";
import {
  closesIn,
  describeDrop,
  dropState,
  formatFulfillment,
  opensIn,
  unitsLeft,
  type DropLike,
} from "@/lib/orders/drops";

/**
 * Batches for one listing — "twenty loaves for Saturday, order by Thursday".
 *
 * Two things this has to be honest about, because getting either wrong costs a seller a Saturday
 * morning:
 *
 *   1. Once a listing has a batch it sells ONLY through batches, and goes quiet between them. Said
 *      up front, not discovered when the orders stop.
 *   2. Cancelling a batch stops new orders and does nothing to the ones already placed. Those are
 *      real people expecting bread, and unwinding them is a separate act on the orders board.
 *
 * The times are entered as the seller's own wall clock and converted to an instant HERE, in the
 * browser, which is the only place that knows what zone they meant.
 */

function localToIso(value: string): string {
  // `datetime-local` gives "2026-12-11T18:00" with no zone; the Date constructor reads it in the
  // browser's zone, which is the seller's. That is the conversion, and it belongs on the client.
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

const STATE_LABEL: Record<string, string> = {
  scheduled: "Announced",
  open: "Taking orders",
  sold_out: "Sold out",
  closed: "Closed",
  cancelled: "Cancelled",
};

export function DropsManager({
  productId,
  drops,
}: {
  productId: string;
  drops: DropLike[];
}) {
  const [createState, createFormAction] = useActionState<DropFormState, FormData>(
    createDropAction,
    {},
  );
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [showForm, setShowForm] = useState(drops.length === 0);

  const live = drops.filter((d) => !d.cancelledAt);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium">Batches</p>
        <p className="text-muted-foreground text-sm">
          {live.length === 0
            ? "Bake to demand instead of to guess: set how many you're making, when orders close, and when buyers collect."
            : "This listing sells through its batches. Between them it stops taking orders — schedule the next one to reopen it."}
        </p>
      </div>

      {drops.length > 0 ? (
        <ul className="space-y-3">
          {drops.map((d) => {
            const status = dropState(d);
            const left = unitsLeft(d);
            return (
              <li key={d.id} className="space-y-3 rounded-md border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{d.name}</p>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">
                    {STATE_LABEL[status] ?? status}
                  </span>
                </div>

                <p className="text-muted-foreground text-sm">
                  Collect {formatFulfillment(d)}
                  {d.pickupWindow ? `, ${d.pickupWindow}` : ""} · {d.unitsClaimed} of {d.unitCap}{" "}
                  ordered
                  {status === "open" && closesIn(d)
                    ? ` · orders close in ${closesIn(d)}`
                    : status === "scheduled" && opensIn(d)
                      ? ` · orders open in ${opensIn(d)}`
                      : ""}
                </p>

                <p className="text-muted-foreground text-xs">
                  Buyers see: “{describeDrop(d)}”
                </p>

                {status !== "cancelled" ? (
                  <div className="flex flex-wrap items-end gap-4">
                    <CapForm dropId={d.id} productId={productId} unitCap={d.unitCap} />
                    <CancelForm dropId={d.id} productId={productId} claimed={d.unitsClaimed} />
                  </div>
                ) : null}

                {status === "open" && left === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Every one is spoken for. Raise the number above only if you can actually bake
                    more.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {showForm ? (
        <form action={createFormAction} className="space-y-3 rounded-md border p-3">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="opensAt" value={localToIso(opensAt)} />
          <input type="hidden" name="closesAt" value={localToIso(closesAt)} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="drop-name">Batch name</Label>
              <Input
                id="drop-name"
                name="name"
                placeholder="Saturday 14 December bake"
                required
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="drop-cap">How many are you making?</Label>
              <Input
                id="drop-cap"
                name="unitCap"
                type="number"
                min={1}
                max={10000}
                inputMode="numeric"
                placeholder="20"
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="drop-opens">Orders open (optional)</Label>
              <Input
                id="drop-opens"
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">Leave blank to start taking orders now.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="drop-closes">Orders close</Label>
              <Input
                id="drop-closes"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                required
              />
              <p className="text-muted-foreground text-xs">
                Your local time. Give yourself enough notice to shop and bake.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="drop-date">Collection date</Label>
              <Input id="drop-date" name="fulfillmentDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="drop-window">Collection time</Label>
              <Input
                id="drop-window"
                name="pickupWindow"
                placeholder="9am – noon"
                maxLength={120}
              />
            </div>
          </div>

          {createState.error ? (
            <p className="text-destructive text-sm">{createState.error}</p>
          ) : null}
          {createState.ok ? <p className="text-sm font-medium">Batch scheduled.</p> : null}

          <div className="flex items-center gap-2">
            <Submit label="Schedule batch" pendingLabel="Scheduling…" />
            {drops.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
          Schedule a batch
        </Button>
      )}
    </div>
  );
}

function CapForm({
  dropId,
  productId,
  unitCap,
}: {
  dropId: string;
  productId: string;
  unitCap: number;
}) {
  const [state, action] = useActionState<DropFormState, FormData>(setDropCapAction, {});
  return (
    <form action={action} className="flex items-end gap-2">
      <input type="hidden" name="dropId" value={dropId} />
      <input type="hidden" name="productId" value={productId} />
      <div className="space-y-1.5">
        <Label htmlFor={`cap-${dropId}`}>Making</Label>
        <Input
          id={`cap-${dropId}`}
          name="unitCap"
          type="number"
          min={1}
          max={10000}
          defaultValue={unitCap}
          className="w-24"
        />
      </div>
      <Submit label="Update" pendingLabel="Saving…" />
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
    </form>
  );
}

function CancelForm({
  dropId,
  productId,
  claimed,
}: {
  dropId: string;
  productId: string;
  claimed: number;
}) {
  const [state, action] = useActionState<DropFormState, FormData>(cancelDropAction, {});
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Call it off
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="dropId" value={dropId} />
      <input type="hidden" name="productId" value={productId} />
      <p className="text-muted-foreground text-xs">
        {claimed > 0
          ? `Stops new orders. The ${claimed} already placed stay open — cancel those on your orders board if you can't fill them.`
          : "Stops new orders. Nobody has ordered yet."}
      </p>
      <div className="flex items-center gap-2">
        <Submit label="Call it off" pendingLabel="Cancelling…" />
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
    </form>
  );
}
