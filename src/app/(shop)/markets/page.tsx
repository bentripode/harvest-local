import Link from "next/link";
import type { Metadata } from "next";

import { StatePicker } from "@/components/state-picker";
import { MarketCard } from "@/components/market-card";
import { getBrowseState } from "@/lib/geo/browse-state";
import { getMarketsInState } from "@/lib/markets/queries";
import { stateName } from "@/lib/geo/state";

export const metadata: Metadata = {
  title: "Farmers markets near you — Harvest Local",
  description:
    "Find farmers markets in your state — when they run, where they are, and which local sellers you can order from.",
};

export default async function MarketsPage() {
  const { state, source } = await getBrowseState();

  if (!state) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Find a farmers market</h1>
        <p className="text-muted-foreground text-sm">
          Pick your state and we&apos;ll show you the markets we know about.
        </p>
        <StatePicker submitLabel="Show me markets" />
      </div>
    );
  }

  const markets = await getMarketsInState(state);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Farmers markets in {stateName(state)}
          </h1>
          <p className="text-muted-foreground text-sm">
            {markets.length > 0
              ? `${markets.length} market${markets.length === 1 ? "" : "s"} we know about.`
              : "Where local sellers set up in person."}
          </p>
          {source === "geo" ? (
            <p className="text-muted-foreground pt-1 text-xs">
              We guessed {stateName(state)} from your connection. Not right? Pick your state.
            </p>
          ) : null}
        </div>
        <StatePicker current={state} hideLabel submitLabel="Change" />
      </div>

      {markets.length === 0 ? (
        <div className="mx-auto max-w-md space-y-2 rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No markets listed in {stateName(state)} yet</p>
          <p className="text-muted-foreground text-sm">
            We&apos;re building the directory state by state. In the meantime,{" "}
            <Link href="/shop" className="underline">
              browse sellers in {stateName(state)}
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((m) => (
            <li key={m.id}>
              <MarketCard market={m} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
