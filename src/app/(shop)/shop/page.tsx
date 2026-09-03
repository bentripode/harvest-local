import Link from "next/link";
import Image from "next/image";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatePicker } from "@/components/state-picker";
import { getProfile, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatUsd, toCents } from "@/lib/money";
import { stateName } from "@/lib/geo/state";
import type { Product } from "@/lib/db/types";

export const metadata = { title: "Shop — Harvest Local" };

export default async function ShopPage() {
  const [user, profile] = await Promise.all([getUser(), getProfile()]);

  if (!user) {
    return (
      <Empty title="Sign in to shop">
        Harvest Local shows sellers in your own state.{" "}
        <Link href="/login?next=/shop" className="underline">
          Sign in
        </Link>{" "}
        or{" "}
        <Link href="/signup?role=buyer" className="underline">
          create an account
        </Link>
        .
      </Empty>
    );
  }

  if (!profile?.home_state) {
    return (
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Where are you?</h1>
        <p className="text-muted-foreground text-sm">
          Cottage-food sales stay within a single state, so we only show sellers in yours.
        </p>
        <StatePicker />
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
    .eq("home_state", profile.home_state)
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
          <h1 className="text-2xl font-semibold tracking-tight">
            Sellers in {stateName(profile.home_state)}
          </h1>
          <p className="text-muted-foreground text-sm">Pickup from local farmers, bakers, and makers.</p>
        </div>
        <StatePicker current={profile.home_state} />
      </div>

      {storefronts.length === 0 ? (
        <Empty title="No sellers yet">
          No live storefronts in {stateName(profile.home_state)} right now. Check back soon.
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
                <Link href={`/s/${s.storefront_slug}`} className="text-muted-foreground text-sm hover:underline">
                  View storefront →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {s.products.slice(0, 6).map((p) => (
                  <Card key={p.id}>
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
