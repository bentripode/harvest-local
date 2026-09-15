"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { MarketCard } from "@/components/market-card";
import { MarketMap } from "@/components/market-map";
import {
  directoryHref,
  filterMarkets,
  type DirectoryView,
} from "@/lib/markets/directory";
import type { MarketSummary } from "@/lib/markets/queries";

/**
 * A state's markets: search, and a list/map toggle.
 *
 * The server hands over the whole state (608 at most) and search filters it here, so results
 * change as you type with no round trip. The URL follows along through `history.replaceState`, so
 * a search can be reloaded or shared, and the server reads the same `?q=` / `?view=` to render the
 * matching list first. Without JavaScript the search box is an ordinary GET form and still works.
 */
export function MarketDirectory({
  markets,
  stateName,
  basePath,
  mapboxToken,
  initialView,
  initialQuery,
}: {
  markets: MarketSummary[];
  stateName: string;
  basePath: string;
  mapboxToken: string | null;
  initialView: DirectoryView;
  initialQuery: string;
}) {
  const [view, setView] = useState<DirectoryView>(initialView);
  const [query, setQuery] = useState(initialQuery);

  const results = useMemo(() => filterMarkets(markets, query), [markets, query]);
  const searching = query.trim().length > 0;

  useEffect(() => {
    window.history.replaceState(window.history.state, "", directoryHref(basePath, { view, query }));
  }, [basePath, view, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <form
          action={basePath}
          method="get"
          role="search"
          className="relative min-w-0 flex-1 basis-64"
          onSubmit={(e) => e.preventDefault()}
        >
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${stateName} markets by name, town or ZIP`}
            aria-label={`Search farmers markets in ${stateName}`}
            maxLength={100}
            autoComplete="off"
            className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-full border pr-4 pl-9 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          {view === "map" ? <input type="hidden" name="view" value="map" /> : null}
        </form>

        <div className="flex gap-1" role="group" aria-label="View">
          <ViewButton active={view === "list"} onClick={() => setView("list")}>
            List
          </ViewButton>
          <ViewButton active={view === "map"} onClick={() => setView("map")}>
            Map
          </ViewButton>
        </div>
      </div>

      <p className="text-muted-foreground text-sm" aria-live="polite">
        {searching
          ? `${results.length} of ${markets.length} markets match “${query.trim()}”.`
          : `${markets.length} ${markets.length === 1 ? "market" : "markets"}.`}
      </p>

      {results.length === 0 ? (
        <div className="mx-auto max-w-md space-y-2 rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">No {stateName} market matches that.</p>
          <p className="text-muted-foreground text-sm">
            Try part of the name, the town, or the ZIP code.{" "}
            <button type="button" onClick={() => setQuery("")} className="underline">
              Clear the search
            </button>
          </p>
        </div>
      ) : view === "map" ? (
        <MarketMap markets={results} token={mapboxToken} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((m) => (
            <li key={m.id}>
              <MarketCard market={m} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-sm ${
        active ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  );
}
