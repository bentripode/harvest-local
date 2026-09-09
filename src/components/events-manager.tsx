"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  deleteEventAction,
  saveEventAction,
  setEventStatusAction,
  type EventFormState,
} from "@/app/(dashboard)/seller/events/actions";
import {
  formatEventWhen,
  isPast,
  localToday,
  type EventLike,
} from "@/lib/events/schedule";

/**
 * A seller's appearances.
 *
 * `localToday()` is called HERE rather than passed from the server, because "has this already
 * happened" is a question about the seller's own clock and the server's is UTC. Same reason
 * `MarketNextOpen` is a client component.
 *
 * Times are entered as wall clock and stored as wall clock — an `<input type="time">` submits
 * "09:00" with no zone, which is exactly what the `time` column wants. Nothing converts anything,
 * and that is deliberate: a conversion is where a market at 9am becomes a market at 3pm.
 */

export interface ManagedEvent extends EventLike {
  description: string | null;
  locationText: string | null;
  market: { id: string; name: string; city: string | null } | null;
}

export interface MarketOption {
  id: string;
  name: string;
  city: string | null;
}

function Submit({ label, pending: pendingLabel }: { label: string; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

const STATUS_LABEL: Record<string, string> = {
  published: "Listed",
  hidden: "Draft",
  cancelled: "Cancelled",
};

export function EventsManager({
  events,
  markets,
}: {
  events: ManagedEvent[];
  markets: MarketOption[];
}) {
  const today = localToday();
  const [editing, setEditing] = useState<ManagedEvent | null>(null);
  const [showForm, setShowForm] = useState(events.length === 0);

  const upcoming = events.filter((e) => !isPast(e, today));
  const past = events.filter((e) => isPast(e, today));

  return (
    <div className="space-y-6">
      {showForm || editing ? (
        <EventForm
          key={editing?.id ?? "new"}
          event={editing}
          markets={markets}
          onDone={() => {
            setEditing(null);
            setShowForm(false);
          }}
          canCancel={events.length > 0}
        />
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
          Add an event
        </Button>
      )}

      {upcoming.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Coming up</h2>
          <ul className="space-y-3">
            {upcoming.map((e) => (
              <EventRow key={e.id} event={e} onEdit={() => setEditing(e)} />
            ))}
          </ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Been and gone</h2>
          <ul className="space-y-2">
            {past.slice(0, 20).map((e) => (
              <li key={e.id} className="text-muted-foreground text-sm">
                {formatEventWhen(e)} — {e.title}
                {e.market ? ` at ${e.market.name}` : ""}
                {e.status === "cancelled" ? " (cancelled)" : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function EventRow({ event, onEdit }: { event: ManagedEvent; onEdit: () => void }) {
  const [statusState, statusAction] = useActionState<EventFormState, FormData>(
    setEventStatusAction,
    {},
  );
  const [deleteState, deleteFormAction] = useActionState<EventFormState, FormData>(
    deleteEventAction,
    {},
  );
  const [cancelling, setCancelling] = useState(false);

  return (
    <li className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{event.title}</p>
        <Badge variant={event.status === "published" ? "secondary" : "outline"}>
          {STATUS_LABEL[event.status] ?? event.status}
        </Badge>
      </div>

      <p className="text-muted-foreground text-sm">
        {formatEventWhen(event)}
        {event.market ? ` · ${event.market.name}` : ""}
        {!event.market && event.locationText ? ` · ${event.locationText}` : ""}
      </p>

      {event.status === "cancelled" && event.cancelledNote ? (
        <p className="text-muted-foreground text-xs">Reason shown to buyers: {event.cancelledNote}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>

        {event.status !== "cancelled" ? (
          <form action={statusAction}>
            <input type="hidden" name="id" value={event.id} />
            <input
              type="hidden"
              name="status"
              value={event.status === "published" ? "hidden" : "published"}
            />
            <Submit
              label={event.status === "published" ? "Unlist" : "List it"}
              pending="Saving…"
            />
          </form>
        ) : null}

        {event.status !== "cancelled" && !cancelling ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setCancelling(true)}>
            Call it off
          </Button>
        ) : null}

        <form action={deleteFormAction}>
          <input type="hidden" name="id" value={event.id} />
          <Button type="submit" variant="ghost" size="sm">
            Delete
          </Button>
        </form>
      </div>

      {cancelling ? (
        <form action={statusAction} className="space-y-2 border-t pt-2">
          <input type="hidden" name="id" value={event.id} />
          <input type="hidden" name="status" value="cancelled" />
          <div className="space-y-1.5">
            <Label htmlFor={`why-${event.id}`}>Why? Buyers will see this.</Label>
            <Input
              id={`why-${event.id}`}
              name="cancelledNote"
              maxLength={300}
              placeholder="Market cancelled for weather"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            It stays on the calendar until the date passes, marked cancelled — so anyone who planned
            around it finds out.
          </p>
          <div className="flex items-center gap-2">
            <Submit label="Call it off" pending="Cancelling…" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setCancelling(false)}>
              Keep it
            </Button>
          </div>
        </form>
      ) : null}

      {statusState.error ? <p className="text-destructive text-sm">{statusState.error}</p> : null}
      {deleteState.error ? <p className="text-destructive text-sm">{deleteState.error}</p> : null}
    </li>
  );
}

function EventForm({
  event,
  markets,
  onDone,
  canCancel,
}: {
  event: ManagedEvent | null;
  markets: MarketOption[];
  onDone: () => void;
  canCancel: boolean;
}) {
  const [state, action] = useActionState<EventFormState, FormData>(saveEventAction, {});
  const [marketId, setMarketId] = useState(event?.market?.id ?? "");

  return (
    <form action={action} className="space-y-3 rounded-lg border p-4">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="ev-title">What is it?</Label>
        <Input
          id="ev-title"
          name="title"
          defaultValue={event?.title ?? ""}
          placeholder="Saturday market stall"
          maxLength={120}
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ev-date">Date</Label>
          <Input
            id="ev-date"
            name="eventDate"
            type="date"
            defaultValue={event?.eventDate ?? ""}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-start">From</Label>
          <Input
            id="ev-start"
            name="startsAt"
            type="time"
            defaultValue={event?.startsAt?.slice(0, 5) ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-end">Until</Label>
          <Input
            id="ev-end"
            name="endsAt"
            type="time"
            defaultValue={event?.endsAt?.slice(0, 5) ?? ""}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Local time at the venue — the same clock the sign on the stall uses.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="ev-market">At a market</Label>
        <select
          id="ev-market"
          name="marketId"
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
          className="border-input h-9 w-full rounded-lg border bg-transparent px-2.5 text-sm"
        >
          <option value="">Somewhere else…</option>
          {markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.city ? ` — ${m.city}` : ""}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          Picking a market puts you on that market&apos;s page. Only markets in your own state are
          listed.
        </p>
      </div>

      {!marketId ? (
        <div className="space-y-1.5">
          <Label htmlFor="ev-where">Where</Label>
          <Input
            id="ev-where"
            name="locationText"
            defaultValue={event?.locationText ?? ""}
            placeholder="The farm, 14 Cottage Lane"
            maxLength={200}
          />
          <p className="text-muted-foreground text-xs">
            This is public. Only write an address you&apos;re happy for anyone to read.
          </p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="ev-desc">Anything else? (optional)</Label>
        <Input
          id="ev-desc"
          name="description"
          defaultValue={event?.description ?? ""}
          placeholder="Bringing the holiday boxes and hot cider"
          maxLength={2000}
        />
      </div>

      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state.ok ? <p className="text-sm font-medium">Saved.</p> : null}

      <div className="flex items-center gap-2">
        <Submit label={event ? "Save changes" : "Add event"} pending="Saving…" />
        {canCancel || event ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
