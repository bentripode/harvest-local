import Link from "next/link";
import type { Metadata } from "next";

import { StatePicker } from "@/components/state-picker";
import { MarketDirectory } from "@/components/market-directory";
import { env } from "@/lib/env";
import { getBrowseState } from "@/lib/geo/browse-state";
import { parseQuery, parseView } from "@/lib/markets/directory";
import { getMarketsInState } from "@/lib/markets/queries";
import { stateName } from "@/lib/geo/state";

export const metadata: Metadata = {
  title: "Farmers markets near you — Harvest Local",
  description:
    "Find farmers markets in your state — when they run, where they are, and which local sellers you can order from.",
};

export default async function MarketsPage({ searchParams }: PageProps<"/markets">) {
  const [{ state, source }, sp] = await Promise.all([getBrowseState(), searchParams]);

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Explore markets</h1>
          <p className="text-muted-foreground">
            Farmers markets in {stateName(state)} — when they run, where they are, and the local
            sellers you can order from.
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
        <MarketDirectory
          markets={markets}
          stateName={stateName(state)}
          basePath="/markets"
          mapboxToken={env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null}
          initialView={parseView(sp?.view)}
          initialQuery={parseQuery(sp?.q)}
        />
      )}
    </div>
  );
}
