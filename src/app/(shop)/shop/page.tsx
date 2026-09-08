import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatePicker } from "@/components/state-picker";
import { createClient } from "@/lib/supabase/server";
import { formatUsd, toCents } from "@/lib/money";
import { stateName } from "@/lib/geo/state";
import { getBrowseState } from "@/lib/geo/browse-state";
import type { Product } from "@/lib/db/types";

export const metadata: Metadata = {
  title: "Shop local sellers — Harvest Local",
  description:
    "Browse farmers, bakers, and makers in your state. Pickup or local delivery, direct from the producer.",
};

export default async function ShopPage() {
  // Discovery is public. What a signed-out visitor sees is a *display* decision; what anyone may
  // order is decided again at checkout against `profiles.home_state` (CLAUDE.md rule 1).
  const { state, source } = await getBrowseState();

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

  const supabase = await createClient();
  const { data: sellers } = await supabase
    .from("seller_profiles")
    .select(
      "id, business_name, storefront_slug, bio, home_state, avg_rating, products:products(id, title, price, images, quantity_available, status, seller_id)",
    )
    .eq("is_paused", false)
    .eq("home_state", state)
    .order("business_name");

  const storefronts = (sellers ?? [])
    .map((s) => ({
      ...s,
      products: ((s.products ?? []) as Product[]).filter((p) => p.status === "active"),
    }))
    .filter((s) => s.products.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sellers in {stateName(state)}</h1>
          <p className="text-muted-foreground text-sm">
            Pickup from local farmers, bakers, and makers.
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

      {storefronts.length === 0 ? (
        <Empty title={`No sellers in ${stateName(state)} yet`}>
          Nobody is listing here right now. If you make something —{" "}
          <Link href="/signup?role=seller" className="underline">
            open a storefront
          </Link>{" "}
          and be the first.
        </Empty>
      ) : (
        <div className="space-y-8">
          {storefronts.map((s) => (
            <section key={s.id} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="flex items-baseline gap-2 text-lg font-medium">
                  <Link href={`/s/${s.storefront_slug}`} className="hover:underline">
                    {s.business_name}
                  </Link>
                  {s.avg_rating != null ? (
                    <span className="text-muted-foreground text-sm font-normal">
                      ★ {Number(s.avg_rating).toFixed(1)}
                    </span>
                  ) : null}
                </h2>
                <Link
                  href={`/s/${s.storefront_slug}`}
                  className="text-muted-foreground text-sm hover:underline"
                >
                  View storefront →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {s.products.slice(0, 6).map((p) => (
                  <Link
                    key={p.id}
                    href={`/s/${s.storefront_slug}`}
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
                        <p className="text-sm font-medium">{formatUsd(toCents(p.price))}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
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
