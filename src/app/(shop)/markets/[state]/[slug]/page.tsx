import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { MarketNextOpen } from "@/components/market-next-open";
import { WatchMarketForm } from "@/components/watch-market-form";
import { getMarket } from "@/lib/markets/queries";
import { getMarketSellers } from "@/lib/orders/pickup";
import { getMarketEvents } from "@/lib/events/queries";
import { EventList, type ListedEvent } from "@/components/event-list";
import { FollowButton } from "@/components/follow-button";
import { getFollowerCount, isFollowing } from "@/lib/follows/queries";
import { describePrepTime, summarizeSlots } from "@/lib/orders/pickup-schedule";
import { summarizeHours } from "@/lib/markets/schedule";
import { isUsState, stateName } from "@/lib/geo/state";

export async function generateMetadata({
  params,
}: PageProps<"/markets/[state]/[slug]">): Promise<Metadata> {
  const { state, slug } = await params;
  const code = state.toUpperCase();
  if (!isUsState(code)) return { title: "Not found — Harvest Local" };

  const market = await getMarket(code, slug);
  if (!market) return { title: "Market not found — Harvest Local" };

  const where = market.city ? `${market.city}, ${stateName(code)}` : stateName(code);
  return {
    title: `${market.name} — farmers market in ${where} | Harvest Local`,
    description: `${market.name} is a farmers market in ${where}. Opening times, location, and the local sellers you can order from for pickup.`,
    alternates: { canonical: `/markets/${state.toLowerCase()}/${slug}` },
    openGraph: { title: market.name, type: "website" },
  };
}

export default async function MarketPage({ params }: PageProps<"/markets/[state]/[slug]">) {
  const { state, slug } = await params;
  const code = state.toUpperCase();
  if (!isUsState(code)) notFound();

  const market = await getMarket(code, slug);
  if (!market) notFound();

  const [sellers, events, followerCount, viewerFollows] = await Promise.all([
    getMarketSellers(market.id),
    getMarketEvents(market.id),
    getFollowerCount("market", market.id),
    isFollowing("market", market.id),
  ]);

  const listedEvents: ListedEvent[] = events.map((e) => ({
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
  const schedule = summarizeHours(market.hours);
  const directionsQuery = encodeURIComponent(
    [market.name, market.addressText, market.city, code, market.postalCode]
      .filter(Boolean)
      .join(", "),
  );

  return (
    <div className="space-y-8">
      <nav className="text-muted-foreground text-sm">
        <Link href="/markets" className="hover:underline">
          Markets
        </Link>{" "}
        /{" "}
        <Link href={`/markets/${state.toLowerCase()}`} className="hover:underline">
          {stateName(code)}
        </Link>{" "}
        / <span className="text-foreground">{market.name}</span>
      </nav>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{market.name}</h1>
        <p className="text-muted-foreground text-sm">
          {market.city ? `${market.city}, ` : ""}
          {stateName(code)}
          {market.seasonText ? ` · Season: ${market.seasonText}` : ""}
        </p>
        {/* Server-rendered summary is time-zone free; the "next open" line uses the reader's own
            clock, because at 8pm Pacific the server already thinks it's tomorrow. */}
        <MarketNextOpen hours={market.hours} />
        <div className="pt-1">
          <FollowButton
            target="market"
            id={market.id}
            following={viewerFollows}
            count={followerCount}
            path={`/markets/${state.toLowerCase()}/${slug}`}
            label="Follow this market"
            followingLabel="Following this market"
          />
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-2 rounded-lg border p-5">
          <h2 className="text-lg">When it runs</h2>
          {schedule.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {schedule.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : market.hoursText ? (
            <p className="text-sm">{market.hoursText}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              We don&apos;t have opening times for this market. Check the market&apos;s own listing
              before you travel.
            </p>
          )}
        </section>

        <section className="space-y-2 rounded-lg border p-5">
          <h2 className="text-lg">Where it is</h2>
          {market.addressText ? (
            <p className="text-sm">
              {market.addressText}
              {market.postalCode ? ` ${market.postalCode}` : ""}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">No address recorded.</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${directionsQuery}`}
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              Get directions
            </a>
            {market.websiteUrl ? (
              <a
                href={market.websiteUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="underline"
              >
                Market website
              </a>
            ) : null}
            {market.phone ? <span className="text-muted-foreground">{market.phone}</span> : null}
          </div>
        </section>
      </div>

      {/*
        What's on. Distinct from the opening hours above: `market_hours` is the market's standing
        schedule, this is who has said they will actually be there on a given day. A buyer deciding
        whether Saturday is worth the trip needs the second.
      */}
      <section className="space-y-4">
        <h2 className="text-lg">What&apos;s on</h2>
        <EventList
          events={listedEvents}
          showVenue={false}
          emptyText="No seller has listed a date here yet."
        />
      </section>

      {/*
        Sellers who have told us they have a booth here — by the `pickup_locations.market_id` link,
        never by proximity, because "sells at this market" and "is near this market" are different
        claims and only the first is being made.
      */}
      <section className="space-y-4">
        <h2 className="text-lg">Sellers at this market</h2>
        {sellers.length > 0 ? (
          <>
            <ul className="grid gap-4 sm:grid-cols-2">
              {sellers.map((s) => {
                const schedule = summarizeSlots(s.slots);
                const notice = describePrepTime(s.prepHours);
                return (
                  <li key={s.sellerId}>
                    <Link
                      href={`/s/${s.storefrontSlug}`}
                      className="hover:bg-muted/50 focus-visible:ring-ring block h-full rounded-lg border p-4 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <p className="font-medium">
                        {s.businessName}
                        {s.avgRating != null ? (
                          <span className="text-muted-foreground text-sm font-normal">
                            {" "}
                            ★ {s.avgRating.toFixed(1)}
                          </span>
                        ) : null}
                      </p>
                      {s.description ? (
                        <p className="text-muted-foreground pt-0.5 text-sm">{s.description}</p>
                      ) : null}
                      {schedule.length > 0 ? (
                        <p className="text-muted-foreground pt-1 text-sm">{schedule[0]}</p>
                      ) : null}
                      {notice ? (
                        <p className="text-muted-foreground pt-0.5 text-xs">
                          Order ahead · {notice}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="text-muted-foreground text-xs">
              Sell here too?{" "}
              <Link href="/signup?role=seller" className="underline">
                Open a storefront
              </Link>{" "}
              and take pre-orders for your booth.
            </p>
          </>
        ) : (
          <div className="space-y-4 rounded-lg border border-dashed p-8 text-center">
            <div>
              <p className="font-medium">No Harvest Local sellers here yet</p>
              <p className="text-muted-foreground mx-auto max-w-md pt-1 text-sm">
                Add your email and we&apos;ll tell you when someone starts selling at {market.name}{" "}
                for pickup. We&apos;ll only use it for this.
              </p>
            </div>
            <WatchMarketForm marketId={market.id} marketName={market.name} />
            <p className="text-muted-foreground text-xs">
              Sell at this market?{" "}
              <Link href="/signup?role=seller" className="underline">
                Open a storefront
              </Link>{" "}
              and take pre-orders for your booth.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
