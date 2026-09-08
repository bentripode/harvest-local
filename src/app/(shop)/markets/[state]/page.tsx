import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { MarketCard } from "@/components/market-card";
import { getMarketsInState } from "@/lib/markets/queries";
import { isUsState, stateName } from "@/lib/geo/state";

/**
 * Every state gets a permanent page, whether or not a seller has ever listed there — this is the
 * page someone searching "farmers markets in Vermont" should land on.
 */
export async function generateMetadata({
  params,
}: PageProps<"/markets/[state]">): Promise<Metadata> {
  const { state } = await params;
  const code = state.toUpperCase();
  if (!isUsState(code)) return { title: "Not found — Harvest Local" };

  const name = stateName(code);
  return {
    title: `Farmers markets in ${name} | Harvest Local`,
    description: `A directory of farmers markets in ${name} — locations, seasons and opening times, with the local sellers you can order from.`,
    alternates: { canonical: `/markets/${state.toLowerCase()}` },
  };
}

export default async function StateMarketsPage({ params }: PageProps<"/markets/[state]">) {
  const { state } = await params;
  const code = state.toUpperCase();
  if (!isUsState(code)) notFound();

  const markets = await getMarketsInState(code);
  const name = stateName(code);

  return (
    <div className="space-y-8">
      <nav className="text-muted-foreground text-sm">
        <Link href="/markets" className="hover:underline">
          Markets
        </Link>{" "}
        / <span className="text-foreground">{name}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Farmers markets in {name}</h1>
        <p className="text-muted-foreground text-sm">
          {markets.length > 0
            ? `${markets.length} market${markets.length === 1 ? "" : "s"} in our directory.`
            : `We don't have any ${name} markets listed yet.`}
        </p>
      </div>

      {markets.length === 0 ? (
        <div className="mx-auto max-w-md space-y-2 rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Nothing listed for {name} yet</p>
          <p className="text-muted-foreground text-sm">
            <Link href="/shop" className="underline">
              Browse {name} sellers
            </Link>{" "}
            in the meantime.
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
