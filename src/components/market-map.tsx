"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";

import { MarketCard } from "@/components/market-card";
import type { MarketSummary } from "@/lib/markets/queries";

/**
 * The market directory as a map.
 *
 * One GeoJSON source with clustering rather than a DOM marker per market, which is what the seller
 * map does: that is fine for a dozen sellers and not for California's 608 markets. The map is built
 * once per token; a new search result swaps the source's data and refits the view, so typing does
 * not tear the map down and rebuild it (and bill for it) on every keystroke.
 *
 * Mapbox GL is loaded dynamically so its ~200KB stays off every other page, and a missing token or
 * a failed load degrades to a sentence pointing back at the list.
 */

const GREEN = "#2f5d3f";
const EMPTY = { type: "FeatureCollection" as const, features: [] };

/**
 * The two fields read off a clicked feature. Mapbox types its features as extending
 * `GeoJSON.Feature`, but `@types/geojson` is not installed here, so those members type as missing;
 * naming what we use beats a dependency added for two property reads.
 */
type ClickedFeature =
  | {
      properties?: Record<string, unknown> | null;
      geometry?: { type: string; coordinates?: unknown };
    }
  | undefined;

export function MarketMap({ markets, token }: { markets: MarketSummary[]; token: string | null }) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const located = useMemo(
    () => markets.filter((m) => m.lng != null && m.lat != null),
    [markets],
  );
  const byId = useMemo(() => new Map(located.map((m) => [m.id, m])), [located]);
  // Content, not identity: a fresh array each render must not look like new data.
  const dataKey = useMemo(() => located.map((m) => m.id).join(","), [located]);

  useEffect(() => {
    if (!token || !container.current) return;
    let cancelled = false;
    let map: MapboxMap | null = null;

    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        await import("mapbox-gl/dist/mapbox-gl.css");
        if (cancelled || !container.current) return;

        mapboxgl.accessToken = token;
        const instance = new mapboxgl.Map({
          container: container.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [-98.5, 39.8],
          zoom: 3,
        });
        map = instance;
        instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        instance.on("load", () => {
          instance.addSource("markets", {
            type: "geojson",
            data: EMPTY,
            cluster: true,
            clusterMaxZoom: 11,
            clusterRadius: 44,
          });
          instance.addLayer({
            id: "market-clusters",
            type: "circle",
            source: "markets",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": GREEN,
              "circle-opacity": 0.85,
              "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 50, 24],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          });
          instance.addLayer({
            id: "market-cluster-count",
            type: "symbol",
            source: "markets",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
              "text-size": 12,
            },
            paint: { "text-color": "#ffffff" },
          });
          instance.addLayer({
            id: "market-point",
            type: "circle",
            source: "markets",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": GREEN,
              "circle-radius": 7,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          });

          instance.on("click", "market-clusters", (e) => {
            const feature = e.features?.[0] as ClickedFeature;
            const clusterId = feature?.properties?.cluster_id;
            if (typeof clusterId !== "number" || feature?.geometry?.type !== "Point") return;
            const center = feature.geometry.coordinates as [number, number];
            instance
              .getSource<GeoJSONSource>("markets")
              ?.getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err || zoom == null) return;
                instance.easeTo({ center, zoom });
              });
          });
          instance.on("click", "market-point", (e) => {
            const id = (e.features?.[0] as ClickedFeature)?.properties?.id;
            if (typeof id === "string") setSelectedId(id);
          });
          for (const layer of ["market-clusters", "market-point"]) {
            instance.on("mouseenter", layer, () => (instance.getCanvas().style.cursor = "pointer"));
            instance.on("mouseleave", layer, () => (instance.getCanvas().style.cursor = ""));
          }

          if (!cancelled) {
            mapRef.current = instance;
            setReady(true);
          }
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current = null;
      setReady(false);
      map?.remove();
    };
  }, [token]);

  // New results: swap the data and frame them. Debounced so a burst of typing moves the map once.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    map.getSource<GeoJSONSource>("markets")?.setData({
      type: "FeatureCollection",
      features: located.map((m) => ({
        type: "Feature" as const,
        properties: { id: m.id },
        geometry: { type: "Point" as const, coordinates: [m.lng!, m.lat!] },
      })),
    });
    if (located.length === 0) return;

    const timer = setTimeout(() => {
      let [w, s, e, n] = [180, 90, -180, -90];
      for (const m of located) {
        w = Math.min(w, m.lng!);
        e = Math.max(e, m.lng!);
        s = Math.min(s, m.lat!);
        n = Math.max(n, m.lat!);
      }
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 48, maxZoom: 13, duration: 600 },
      );
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content, not identity
  }, [ready, dataKey]);

  if (!token) {
    return <Notice>The map isn&apos;t set up on this site yet. The list has every market.</Notice>;
  }
  if (failed) {
    return <Notice>The map didn&apos;t load. The list has every market.</Notice>;
  }

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const unplaced = markets.length - located.length;

  return (
    <div className="space-y-3">
      <div
        ref={container}
        className="h-[60vh] min-h-[360px] w-full overflow-hidden rounded-xl border"
        role="region"
        aria-label="Map of farmers markets"
      />
      {selected ? (
        <div className="max-w-md">
          <MarketCard market={selected} />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Tap a market to see its details.</p>
      )}
      {unplaced > 0 ? (
        <p className="text-muted-foreground text-xs">
          {unplaced} {unplaced === 1 ? "market has" : "markets have"} no location on file and
          {unplaced === 1 ? " is" : " are"} only in the list.
        </p>
      ) : null}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
      {children}
    </p>
  );
}
