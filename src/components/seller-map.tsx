"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { formatDistance, type NearbySeller } from "@/lib/geo/nearby-format";

/**
 * The map view of a state's sellers.
 *
 * Every pin for a seller-owned location is drawn at a coordinate `nearby_sellers()` has already
 * rounded to roughly a kilometre — the map cannot be more precise than the data it is given, which
 * is the point. A pin at a public market is exact. The legend says which is which, because a map
 * that looks precise while being approximate is worse than one that admits it.
 *
 * Mapbox GL is loaded dynamically so its ~200KB stays off every other page, and the whole thing
 * degrades to the list when `NEXT_PUBLIC_MAPBOX_TOKEN` is unset — the token is optional in
 * `env.ts` and a missing map must not take discovery down with it.
 */
export function SellerMap({
  sellers,
  token,
  center,
}: {
  sellers: NearbySeller[];
  token: string | null;
  center: { lng: number; lat: number } | null;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<NearbySeller | null>(null);

  // Memoised, and the effect depends on a serialised key rather than on the array: a fresh array
  // identity each render would tear the map down and rebuild it on every render, which thrashes
  // Mapbox and bills for it.
  const located = useMemo(
    () => sellers.filter((s) => s.lng != null && s.lat != null),
    [sellers],
  );
  const pinKey = useMemo(
    () => located.map((s) => `${s.sellerId}:${s.lng},${s.lat}`).join("|"),
    [located],
  );
  const centerKey = center ? `${center.lng},${center.lat}` : "";

  useEffect(() => {
    if (!token || !container.current || located.length === 0) return;

    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        await import("mapbox-gl/dist/mapbox-gl.css");
        if (cancelled || !container.current) return;

        mapboxgl.accessToken = token;

        const start = center ?? { lng: located[0].lng!, lat: located[0].lat! };
        const instance = new mapboxgl.Map({
          container: container.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [start.lng, start.lat],
          zoom: center ? 9 : 6,
        });
        map = instance;
        instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        const bounds = new mapboxgl.LngLatBounds();
        for (const s of located) {
          const el = document.createElement("button");
          el.type = "button";
          el.setAttribute("aria-label", s.businessName);
          el.className =
            "size-4 rounded-full border-2 border-white shadow " +
            (s.isMarket ? "bg-sky-600" : "bg-emerald-600");
          el.addEventListener("click", () => setSelected(s));

          new mapboxgl.Marker({ element: el }).setLngLat([s.lng!, s.lat!]).addTo(instance);
          bounds.extend([s.lng!, s.lat!]);
        }

        if (center) bounds.extend([center.lng, center.lat]);
        if (located.length > 1) instance.fitBounds(bounds, { padding: 56, maxZoom: 12 });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content, not identity
  }, [token, centerKey, pinKey]);

  if (!token) {
    return (
      <Notice>
        The map isn&apos;t configured on this deployment. The list below has everything on it.
      </Notice>
    );
  }

  if (located.length === 0) {
    return <Notice>None of these sellers have a location on file yet.</Notice>;
  }

  if (failed) {
    return <Notice>The map didn&apos;t load. The list below has everything on it.</Notice>;
  }

  return (
    <div className="space-y-2">
      <div ref={container} className="h-[420px] w-full overflow-hidden rounded-lg border" />

      {selected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <div>
            <Link href={`/s/${selected.storefrontSlug}`} className="font-medium hover:underline">
              {selected.businessName}
            </Link>
            <p className="text-muted-foreground">
              {[selected.locationLabel, formatDistance(selected.distanceMiles)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Link href={`/s/${selected.storefrontSlug}`} className="underline">
            View storefront →
          </Link>
        </div>
      ) : null}

      <p className="text-muted-foreground text-xs">
        <span className="mr-1 inline-block size-2 rounded-full bg-sky-600 align-middle" /> market
        stall (exact)
        <span className="mx-1.5">·</span>
        <span className="mr-1 inline-block size-2 rounded-full bg-emerald-600 align-middle" />{" "}
        approximate, to about a mile — sellers work from home, so we show the neighbourhood and not
        the address
      </p>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
      {children}
    </p>
  );
}
