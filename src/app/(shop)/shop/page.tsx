import Link from "next/link";
import type { Metadata } from "next";

import { ProductCard } from "@/components/product-card";
import { StatePicker } from "@/components/state-picker";
import { OriginPicker } from "@/components/origin-picker";
import { SellerMap } from "@/components/seller-map";
import { SellerAvatar } from "@/components/seller-avatar";
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
        <h1 className="text-2xl">Where are you shopping?</h1>
        <p className="text-muted-foreground text-sm">
          Cottage-food sales stay inside one state, so we show you the sellers in yours.
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

  const hasSellers = nearby.length > 0;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl">Sellers in {stateName(state)}</h1>
        {/* The density sentence IS the subtitle. It used to sit in a block of its own under two
            rows of controls, below a generic line ("Nearest first.") that said less and was read
            first — see lib/geo/density.ts. In a thin state this is the honest answer and the list
            underneath is the footnote. */}
        {hasSellers ? (
          <>
            <p className="text-foreground">{density.headline}</p>
            {density.detail ? (
              <p className="text-muted-foreground text-sm">{density.detail}</p>
            ) : null}
          </>
        ) : null}
      </header>

      {/* One control row instead of three. On a phone these used to stack into four rows of chrome
          above the first photo. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-y py-3">
        <StatePicker current={state} hideLabel submitLabel="Change" />
        <OriginPicker current={origin?.label ?? null} />
        <div className="ml-auto flex gap-1" role="group" aria-label="View">
          <ViewLink current={view} target="list">
            List
          </ViewLink>
          <ViewLink current={view} target="map">
            Map
          </ViewLink>
        </div>
      </div>

      {/* An IP guess is a guess — say so rather than quietly showing the wrong state. */}
      {source === "geo" ? (
        <p className="text-muted-foreground -mt-3 text-xs">
          We guessed {stateName(state)} from your connection.
        </p>
      ) : null}

      {!hasSellers ? (
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
        <div className="space-y-10">
          {density.reachable.map((s) => {
            const items = bySeller.get(s.sellerId) ?? [];
            const distance = formatDistance(s.distanceMiles);
            return (
              <section key={s.sellerId} className="space-y-3">
                {/* The seller's row reads as a person, not a table header: their mark, their name,
                    and the two facts that decide whether they're any use to you. */}
                <Link
                  href={`/s/${s.storefrontSlug}`}
                  className="group flex items-center gap-3 no-underline"
                >
                  <SellerAvatar name={s.businessName} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium group-hover:underline">
                      {s.businessName}
                    </span>
                    <span className="text-muted-foreground block truncate text-sm">
                      {[
                        distance ? `${distance} away` : null,
                        s.avgRating != null ? `★ ${s.avgRating.toFixed(1)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </Link>

                {items.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nothing listed right now.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
                    {items.slice(0, 8).map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {/* Kept, but under a heading that cannot be mistaken for a result. Someone deciding
              whether to come back next month is better served by "there are four here, all a long
              way off" than by a page that looks empty. */}
          {density.distant.length > 0 ? (
            <section className="space-y-2 border-t pt-6">
              <h2 className="text-lg">Elsewhere in {stateName(state)}</h2>
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
      className={`rounded-full border px-3 py-1.5 text-sm no-underline ${
        active ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/50"
      }`}
    >
      {children}
    </Link>
  );
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-2 rounded-2xl border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground text-sm">{children}</p>
    </div>
  );
}
