import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatePicker } from "@/components/state-picker";
import { OriginPicker } from "@/components/origin-picker";
import { SellerMap } from "@/components/seller-map";
import { createClient } from "@/lib/supabase/server";
import { formatUsd, toCents } from "@/lib/money";
import { stateName } from "@/lib/geo/state";
import { getBrowseOrigin, getBrowseState } from "@/lib/geo/browse-state";
import { formatDistance, getNearbySellers } from "@/lib/geo/nearby";
import { env } from "@/lib/env";
import type { Product } from "@/lib/db/types";

export const metadata: Metadata = {
  title: "Shop local sellers — Harvest Local",
  description:
    "Browse farmers, bakers, and makers near you. Pickup or local delivery, direct from the producer.",
};

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  // Discovery is public. What a signed-out visitor sees is a *display* decision; what anyone may
  // order is decided again at checkout against `profiles.home_state` (CLAUDE.md rule 1).
  const [{ state, source }, origin, sp] = await Promise.all([
    getBrowseState(),
    getBrowseOrigin(),
    searchParams,
  ]);

  if (!state) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Where are you shopping?</h1>
        <p className="text-muted-foreground text-sm">
          Cottage-food sales stay inside one state, so Harvest Local shows you the sellers in
          yours. No account needed to look around.
        </p>
        <StatePicker submitLabel="Show me sellers" />
      </div>
    );
  }

  const view = sp?.view === "map" ? "map" : "list";

  // Ordering, distances and the state filter all come from SQL — see `nearby_sellers`.
  const nearby = await getNearbySellers(state, origin);

  // Products for the cards, in one round trip, then stitched onto the ordered seller list.
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, title, price, images, quantity_available, status, seller_id")
    .in(
      "seller_id",
      nearby.map((s) => s.sellerId),
    )
    .eq("status", "active");

  const bySeller = new Map<string, Product[]>();
  for (const p of (products ?? []) as Product[]) {
    const list = bySeller.get(p.seller_id) ?? [];
    list.push(p);
    bySeller.set(p.seller_id, list);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sellers in {stateName(state)}</h1>
          <p className="text-muted-foreground text-sm">
            {origin
              ? "Nearest first."
              : "Pickup from local farmers, bakers, and makers."}
          </p>
          {/* An IP guess is a guess — say so rather than quietly showing the wrong state. */}
          {source === "geo" ? (
            <p className="text-muted-foreground pt-1 text-xs">
              We guessed {stateName(state)} from your connection. Not right? Pick your state.
            </p>
          ) : null}
        </div>
        <StatePicker current={state} hideLabel submitLabel="Change" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-y py-3">
        <OriginPicker current={origin?.label ?? null} />
        <div className="flex gap-1" role="group" aria-label="View">
          <ViewLink current={view} target="list">
            List
          </ViewLink>
          <ViewLink current={view} target="map">
            Map
          </ViewLink>
        </div>
      </div>

      {nearby.length === 0 ? (
        <Empty title={`No sellers in ${stateName(state)} yet`}>
          Nobody is listing here right now. If you make something —{" "}
          <Link href="/signup?role=seller" className="underline">
            open a storefront
          </Link>{" "}
          and be the first.
        </Empty>
      ) : view === "map" ? (
        <SellerMap
          sellers={nearby}
          token={env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null}
          center={origin ? { lng: origin.lng, lat: origin.lat } : null}
        />
      ) : (
        <div className="space-y-8">
          {nearby.map((s) => {
            const items = bySeller.get(s.sellerId) ?? [];
            const distance = formatDistance(s.distanceMiles);
            return (
              <section key={s.sellerId} className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="flex flex-wrap items-baseline gap-2 text-lg font-medium">
                    <Link href={`/s/${s.storefrontSlug}`} className="hover:underline">
                      {s.businessName}
                    </Link>
                    {s.avgRating != null ? (
                      <span className="text-muted-foreground text-sm font-normal">
                        ★ {s.avgRating.toFixed(1)}
                      </span>
                    ) : null}
                    {distance ? (
                      <span className="text-muted-foreground text-sm font-normal">
                        {distance} away
                      </span>
                    ) : null}
                  </h2>
                  <Link
                    href={`/s/${s.storefrontSlug}`}
                    className="text-muted-foreground text-sm hover:underline"
                  >
                    View storefront →
                  </Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.slice(0, 6).map((p) => (
                    <Link
                      key={p.id}
                      href={`/s/${s.storefrontSlug}`}
                      className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Card className="h-full transition-shadow hover:shadow-md">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">{p.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="bg-muted relative aspect-video overflow-hidden rounded-md border">
                            {p.images?.[0] ? (
                              <Image
                                src={p.images[0].url}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 100vw, 33vw"
                              />
                            ) : null}
                          </div>
                          <p className="flex items-baseline justify-between text-sm font-medium">
                            <span>{formatUsd(toCents(p.price))}</span>
                            {distance ? (
                              <span className="text-muted-foreground font-normal">{distance}</span>
                            ) : null}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ViewLink({
  current,
  target,
  children,
}: {
  current: string;
  target: "list" | "map";
  children: React.ReactNode;
}) {
  const active = current === target;
  return (
    <Link
      href={target === "list" ? "/shop" : "/shop?view=map"}
      aria-current={active ? "true" : undefined}
      className={`rounded-md border px-3 py-1.5 text-sm ${
        active ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/50"
      }`}
    >
      {children}
    </Link>
  );
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-2 rounded-lg border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground text-sm">{children}</p>
    </div>
  );
}
