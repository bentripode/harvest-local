import Link from "next/link";
import type { Metadata } from "next";

import { FollowButton } from "@/components/follow-button";
import { requireUser } from "@/lib/auth";
import { getMyFollows } from "@/lib/follows/queries";
import { formatUsd, toCents } from "@/lib/money";
import { stateName } from "@/lib/geo/state";

export const metadata: Metadata = { title: "Saved — Harvest Local" };

/**
 * What the viewer follows. Private by construction: `follows` has no policy that lets anyone read
 * another person's rows, so this page can only ever show your own.
 */
export default async function SavedPage() {
  await requireUser("/saved");
  const { sellers, markets, products } = await getMyFollows();

  const empty = sellers.length === 0 && markets.length === 0 && products.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Saved</h1>
        <p className="text-muted-foreground text-sm">
          Sellers, markets and products you follow. We email you when there is something new — turn
          that off in{" "}
          <Link href="/account" className="underline">
            your account
          </Link>
          .
        </p>
      </div>

      {empty ? (
        <div className="mx-auto max-w-md space-y-2 rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Nothing saved yet</p>
          <p className="text-muted-foreground text-sm">
            Follow a seller and you&apos;ll hear when they list something.{" "}
            <Link href="/shop" className="underline">
              Find one
            </Link>
            .
          </p>
        </div>
      ) : null}

      {sellers.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Sellers</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {sellers.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <Link href={`/s/${s.storefrontSlug}`} className="font-medium hover:underline">
                    {s.businessName}
                  </Link>
                  {s.avgRating != null ? (
                    <p className="text-muted-foreground text-sm">★ {s.avgRating.toFixed(1)}</p>
                  ) : null}
                </div>
                <FollowButton
                  target="seller"
                  id={s.id}
                  following
                  path="/saved"
                  followingLabel="Unfollow"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {markets.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Markets</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {markets.map((m) => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <Link
                    href={`/markets/${m.state.toLowerCase()}/${m.slug}`}
                    className="font-medium hover:underline"
                  >
                    {m.name}
                  </Link>
                  <p className="text-muted-foreground text-sm">
                    {m.city ? `${m.city}, ` : ""}
                    {stateName(m.state)}
                  </p>
                </div>
                <FollowButton
                  target="market"
                  id={m.id}
                  following
                  path="/saved"
                  followingLabel="Unfollow"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {products.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Products</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {products.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <Link href={`/s/${p.sellerSlug}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  <p className="text-muted-foreground text-sm">
                    {p.businessName} · {formatUsd(toCents(p.price))}
                  </p>
                </div>
                <FollowButton
                  target="product"
                  id={p.id}
                  following
                  path="/saved"
                  followingLabel="Unsave"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
