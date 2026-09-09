import Link from "next/link";
import type { Metadata } from "next";

import { EventList, type ListedEvent } from "@/components/event-list";
import { StatePicker } from "@/components/state-picker";
import { getStateEvents } from "@/lib/events/queries";
import { getBrowseState } from "@/lib/geo/browse-state";
import { stateName } from "@/lib/geo/state";

export const metadata: Metadata = {
  title: "What's on near you — Harvest Local",
  description:
    "Farmers market stalls, pop-ups and farm open days from local sellers. Find out who is where, and when.",
};

/**
 * The state calendar.
 *
 * State-scoped like every other discovery surface, because cottage-food selling is (rule 1) — and
 * because a calendar of events three states away is noise even where it would be legal to read.
 */
export default async function EventsPage() {
  const { state, source } = await getBrowseState();

  if (!state) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">What&apos;s on near you?</h1>
        <p className="text-muted-foreground text-sm">
          Market stalls, pop-ups and open days from local sellers. Tell us your state and we&apos;ll
          show you what&apos;s coming up.
        </p>
        <StatePicker submitLabel="Show me" />
      </div>
    );
  }

  const events = await getStateEvents(state);

  const listed: ListedEvent[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    eventDate: e.eventDate,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    status: e.status,
    cancelledNote: e.cancelledNote,
    description: e.description,
    locationText: e.locationText,
    sellerName: e.sellerName,
    sellerSlug: e.sellerSlug,
    market: e.market,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            What&apos;s on in {stateName(state)}
          </h1>
          <p className="text-muted-foreground text-sm">
            Where to find local sellers in person — market stalls, pop-ups and open days.
          </p>
          {source === "geo" ? (
            <p className="text-muted-foreground pt-1 text-xs">
              We guessed {stateName(state)} from your connection. Not right? Pick your state.
            </p>
          ) : null}
        </div>
        <StatePicker current={state} hideLabel submitLabel="Change" />
      </div>

      <EventList
        events={listed}
        emptyText={`Nothing listed in ${stateName(state)} yet. Sellers add their market days and pop-ups here — check back, or browse the ${stateName(state)} market directory.`}
      />

      <p className="text-muted-foreground text-sm">
        <Link href={`/markets/${state.toLowerCase()}`} className="underline underline-offset-2">
          Browse every farmers market in {stateName(state)} →
        </Link>
      </p>
    </div>
  );
}
