import Link from "next/link";
import type { Metadata } from "next";

import { ProductCard } from "@/components/product-card";
import { StatePicker } from "@/components/state-picker";
import { OriginPicker } from "@/components/origin-picker";
import { SellerMap } from "@/components/seller-map";
import { createClient } from "@/lib/supabase/server";
import { stateName } from "@/lib/geo/state";
import { getBrowseOrigin, getBrowseState } from "@/lib/geo/browse-state";
import { formatDistance, getNearbySellers } from "@/lib/geo/nearby";
import { describeDensity } from "@/lib/geo/density";
import { env } from "@/lib/env";
import { DROP_SELECT, toDrops, type DropRow } from "@/lib/orders/drop-queries";
import type { CardProduct } from "@/lib/products/card";
import type { VariantLike } from "@/lib/orders/sale-unit";
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


  const supabase = await createClient();
  // The card needs more than a title and a price: options decide the price, batches decide whether
  // there is anything to buy, and allergens are a safety fact that belongs on the shelf. All still
  // one round trip.
  const { data: products } = await supabase
    .from("products")
    .select(
      `id, title, price, images, quantity_available, status, seller_id,
       net_weight_value, net_weight_unit, allergens,
       variants:product_variants(id, name, price, quantity_available, is_active),
       drops:product_drops(${DROP_SELECT})`,
    )
    .in(
      "seller_id",
      nearby.map((s) => s.sellerId),
    )
    .eq("status", "active");

  type GalleryRow = Product & { variants?: VariantLike[]; drops?: DropRow[] };

  // Reachable vs merely-in-the-state. The list order stays the same; what changes is that a seller
  // 200 miles away is no longer presented as a result.
  const density = describeDensity(nearby, stateName(state));

  const bySeller = new Map<string, CardProduct[]>();
  for (const row of (products ?? []) as GalleryRow[]) {
    const list = bySeller.get(row.seller_id) ?? [];
    list.push({
      id: row.id,
      title: row.title,
      price: row.price,
      quantityAvailable: row.quantity_available,
      netWeightValue: row.net_weight_value,
      netWeightUnit: row.net_weight_unit,
      allergens: row.allergens,
      images: row.images,
      variants: row.variants ?? [],
      drops: toDrops(row.drops),
    });
    bySeller.set(row.seller_id, list);
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

      {/* What the page says about itself, before the list. In a thin state this is the honest
          answer and the list underneath is the footnote — see lib/geo/density.ts. */}
      <div>
        <p className="font-medium">{density.headline}</p>
        {density.detail ? (
          <p className="text-muted-foreground text-sm">{density.detail}</p>
        ) : null}
      </div>

      {nearby.length === 0 ? (
        <Empty title={`No sellers in ${stateName(state)} yet`}>
          Nobody is listing here right now. If you make something —{" "}
          <Link href="/signup?role=seller" className="underline">
            open a storefront
          </Link>{" "}
          and be the first. In the meantime,{" "}
          <Link href={`/markets/${state.toLowerCase()}`} className="underline">
            the market directory
          </Link>{" "}
          covers the whole state.
        </Empty>
      ) : view === "map" ? (
        <SellerMap
          sellers={nearby}
          token={env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null}
          center={origin ? { lng: origin.lng, lat: origin.lat } : null}
        />
      ) : (
        <div className="space-y-8">
          {density.reachable.map((s) => {
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
                    <ProductCard
                      key={p.id}
                      product={p}
                      sellerSlug={s.storefrontSlug}
                      footnote={distance}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {/* Kept, but under a heading that cannot be mistaken for a result. Someone deciding
              whether to come back next month is better served by "there are four here, all a long
              way off" than by a page that looks empty. */}
          {density.distant.length > 0 ? (
            <section className="space-y-2 border-t pt-6">
              <h2 className="text-sm font-medium">
                Elsewhere in {stateName(state)}
              </h2>
              <p className="text-muted-foreground text-sm">
                Too far to collect from, and outside their delivery area — but they are trading.
              </p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
                {density.distant.map((s) => (
                  <li key={s.sellerId}>
                    <Link href={`/s/${s.storefrontSlug}`} className="hover:underline">
                      {s.businessName}
                    </Link>
                    {formatDistance(s.distanceMiles) ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatDistance(s.distanceMiles)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
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
