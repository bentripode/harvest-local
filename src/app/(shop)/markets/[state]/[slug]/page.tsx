import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { MarketNextOpen } from "@/components/market-next-open";
import { WatchMarketForm } from "@/components/watch-market-form";
import { getMarket } from "@/lib/markets/queries";
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
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-2 rounded-lg border p-5">
          <h2 className="text-sm font-medium">When it runs</h2>
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
          <h2 className="text-sm font-medium">Where it is</h2>
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
        Sellers at this market. There is deliberately nothing to list yet: a seller has one pickup
        address and no way to say "I have a booth here" until `pickup_locations` exists. Answering
        by proximity instead would quietly answer a different question.
      */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium">Sellers at this market</h2>
        <div className="space-y-4 rounded-lg border border-dashed p-8 text-center">
          <div>
            <p className="font-medium">No Harvest Local sellers here yet</p>
            <p className="text-muted-foreground mx-auto max-w-md pt-1 text-sm">
              Add your email and we&apos;ll tell you when someone starts selling at{" "}
              {market.name} for pickup. We&apos;ll only use it for this.
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
      </section>
    </div>
  );
}
