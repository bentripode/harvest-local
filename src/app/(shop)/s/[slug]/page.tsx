import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { AddToCart } from "@/components/add-to-cart";
import { StarRating } from "@/components/star-rating";
import { ReviewList } from "@/components/review-list";
import { getProfile, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSellerReviews, getSellerReviewSummary } from "@/lib/reviews/queries";
import { formatUsd, toCents } from "@/lib/money";
import { sameState, stateName } from "@/lib/geo/state";
import type { Product } from "@/lib/db/types";

export default async function StorefrontPage({ params }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select(
      "id, business_name, storefront_slug, bio, home_state, is_paused, delivery_enabled, delivery_radius_miles",
    )
    .eq("storefront_slug", slug)
    .maybeSingle();

  if (!seller || seller.is_paused) notFound();

  const [{ data: products }, user, profile, reviewSummary, reviews] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("seller_id", seller.id)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    getUser(),
    getProfile(),
    getSellerReviewSummary(seller.id),
    getSellerReviews(seller.id),
  ]);

  const list = (products ?? []) as Product[];
  const buyerState = profile?.home_state ?? null;
  const canOrder = !!user && sameState(buyerState, seller.home_state);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{seller.business_name}</h1>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
          <span>
            {stateName(seller.home_state)}
            {seller.delivery_enabled
              ? ` · pickup or local delivery${seller.delivery_radius_miles ? ` within ${seller.delivery_radius_miles} mi` : ""}`
              : " · pickup"}
          </span>
          {reviewSummary.count > 0 && reviewSummary.avg != null ? (
            <span className="inline-flex items-center gap-1">
              · <StarRating value={reviewSummary.avg} />
              <span>
                {reviewSummary.avg.toFixed(1)} ({reviewSummary.count})
              </span>
            </span>
          ) : null}
        </p>
        {seller.bio ? <p className="max-w-2xl pt-2 text-sm">{seller.bio}</p> : null}
      </header>

      {!user ? (
        <Notice>
          <Link href={`/login?next=/s/${slug}`} className="underline">
            Sign in
          </Link>{" "}
          to order from {seller.business_name}.
        </Notice>
      ) : !buyerState ? (
        <Notice>
          Set your state on the{" "}
          <Link href="/shop" className="underline">
            shop page
          </Link>{" "}
          to order.
        </Notice>
      ) : !canOrder ? (
        <Notice>
          {seller.business_name} sells in {stateName(seller.home_state)}. Harvest Local keeps orders
          within a single state, so you can browse here but can&apos;t order from{" "}
          {stateName(buyerState)}.
        </Notice>
      ) : null}

      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">No products listed yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-md border">
                {p.images?.[0] ? (
                  <Image src={p.images[0].url} alt="" fill className="object-cover" sizes="64px" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.title}</p>
                {p.description ? (
                  <p className="text-muted-foreground line-clamp-2 text-sm">{p.description}</p>
                ) : null}
                <p className="pt-1 text-sm font-medium">
                  {formatUsd(toCents(p.price))}
                  {p.quantity_available != null ? (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {p.quantity_available} available
                    </span>
                  ) : null}
                </p>
              </div>
              {canOrder ? (
                <AddToCart
                  seller={{
                    sellerId: seller.id,
                    sellerSlug: seller.storefront_slug,
                    sellerName: seller.business_name,
                  }}
                  product={{
                    id: p.id,
                    title: p.title,
                    price: p.price,
                    quantityAvailable: p.quantity_available,
                  }}
                />
              ) : (
                <Badge variant="secondary">Pickup</Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {reviews.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">
            Reviews{reviewSummary.count > 0 ? ` (${reviewSummary.count})` : ""}
          </h2>
          <ReviewList reviews={reviews} />
        </section>
      ) : null}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="bg-muted/50 rounded-md border p-3 text-sm">{children}</p>
  );
}
