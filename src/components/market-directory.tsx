"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LayoutGrid, Map as MapIcon, Search } from "lucide-react";

import { MarketCard } from "@/components/market-card";
import { MarketMap } from "@/components/market-map";
import { todayStatus, type MarketToday } from "@/lib/markets/card";
import { directoryHref, filterMarkets, type DirectoryView } from "@/lib/markets/directory";
import type { MarketSummary } from "@/lib/markets/queries";

/**
 * A state's markets: search, a list/map toggle, and which of them are on today.
 *
 * The server hands over the whole state (608 at most) and search filters it here, so results
 * change as you type with no round trip. The URL follows along through `history.replaceState`, so
 * a search can be reloaded or shared, and the server reads the same `?q=` / `?view=` to render the
 * matching list first. Without JavaScript the search box is an ordinary GET form and still works.
 */

/** Nothing to subscribe to — the clock only has to be right as of render, as in `MarketNextOpen`. */
const noopSubscribe = () => () => {};

/**
 * The reader's own clock, to the minute, or null on the server and through hydration.
 *
 * A minute number rather than a `Date` because `useSyncExternalStore` compares snapshots by
 * identity: returning `new Date()` would be a new object every render and loop forever. Null on
 * the server is the point — the server runs UTC and at 8pm Pacific already believes it is
 * tomorrow, so it must not be the one deciding what is open today.
 */
function useLocalMinute(): number | null {
  const getSnapshot = useCallback(() => Math.floor(Date.now() / 60_000), []);
  return useSyncExternalStore(noopSubscribe, getSnapshot, () => null);
}

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

  const minute = useLocalMinute();
  const today = useMemo(() => {
    const map = new Map<string, MarketToday>();
    if (minute === null) return map;
    const now = new Date(minute * 60_000);
    for (const m of results) {
      const status = todayStatus(m.hours, now);
      if (status) map.set(m.id, status);
    }
    return map;
  }, [results, minute]);

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
            className="border-input bg-background focus-visible:ring-ring h-11 w-full rounded-full border pr-4 pl-9 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          {view === "map" ? <input type="hidden" name="view" value="map" /> : null}
        </form>

        <div
          className="bg-muted/60 flex shrink-0 gap-1 rounded-full p-1"
          role="group"
          aria-label="View"
        >
          <ViewButton active={view === "list"} onClick={() => setView("list")} label="List">
            <LayoutGrid aria-hidden className="size-4" />
          </ViewButton>
          <ViewButton active={view === "map"} onClick={() => setView("map")} label="Map">
            <MapIcon aria-hidden className="size-4" />
          </ViewButton>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {searching ? "Matching markets" : `Markets in ${stateName}`}
        </h2>
        <p className="text-muted-foreground flex items-center gap-3 text-sm" aria-live="polite">
          <span>
            {searching
              ? `${results.length} of ${markets.length} match “${query.trim()}”`
              : `${markets.length} ${markets.length === 1 ? "market" : "markets"}`}
          </span>
          {/* Empty until the reader's clock is available, so this never renders a UTC answer. */}
          {today.size > 0 ? (
            <span className="text-foreground font-medium">
              <span className="bg-accent mr-1.5 inline-block size-2 rounded-full align-middle" />
              {today.size} on today
            </span>
          ) : null}
        </p>
      </div>

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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((m, i) => (
            <li key={m.id}>
              {/* `position` picks the stock photograph for a market with no picture of its own, so
                  the grid cycles through them instead of repeating one three cards in a row. */}
              <MarketCard market={m} today={today.get(m.id) ?? null} position={i} />
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
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`focus-visible:ring-ring rounded-full px-3 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
