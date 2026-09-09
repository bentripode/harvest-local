import { redirect } from "next/navigation";

import { EventsManager, type ManagedEvent } from "@/components/events-manager";
import { getSellerContext } from "@/lib/auth";
import { getMarketOptions, getSellerEvents } from "@/lib/events/queries";
import { stateName } from "@/lib/geo/state";

export const metadata = { title: "Events — Harvest Local" };

/**
 * Where a seller says they will be.
 *
 * Separate from batches: a batch is a promise to make something, an event is a promise to be
 * somewhere. A seller can have either without the other — a stall with no pre-orders, a bake with no
 * market — and collapsing them would force one to imply the other.
 */
export default async function SellerEventsPage() {
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const [events, markets] = await Promise.all([
    getSellerEvents(seller.id),
    getMarketOptions(seller.home_state),
  ]);

  const managed: ManagedEvent[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    eventDate: e.eventDate,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    status: e.status,
    cancelledNote: e.cancelledNote,
    description: e.description,
    locationText: e.locationText,
    market: e.market ? { id: e.market.id, name: e.market.name, city: e.market.city } : null,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="text-muted-foreground text-sm">
          Market stalls, pop-ups, farm open days. Anything you list here shows on your storefront,
          on the {stateName(seller.home_state)} calendar, and — if you pick a market — on that
          market&apos;s page.
        </p>
      </div>

      <EventsManager events={managed} markets={markets} />
    </div>
  );
}
