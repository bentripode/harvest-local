import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductDisclosures } from "@/lib/labels/disclosure";
import { LabelDisclosure } from "@/components/label-disclosure";

import { Badge } from "@/components/ui/badge";
import { AddToCart } from "@/components/add-to-cart";
import { StarRating } from "@/components/star-rating";
import { ReviewList } from "@/components/review-list";
import { MessageSellerButton } from "@/components/message-seller-button";
import { TrackStorefrontView } from "@/components/track-storefront-view";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSellerReviews, getSellerReviewSummary } from "@/lib/reviews/queries";
import { sameState, stateName } from "@/lib/geo/state";
import { getBrowseState } from "@/lib/geo/browse-state";
import { FollowButton } from "@/components/follow-button";
import { getFollowerCount, isFollowing } from "@/lib/follows/queries";
import { getStorefrontPosts, getStorefrontQuestions } from "@/lib/storefront/queries";
import { StorefrontQuestions } from "@/components/storefront-questions";
import { approximateLocation, getActivePickupLocations } from "@/lib/orders/pickup";
import type { VariantLike } from "@/lib/orders/sale-unit";
import { describePrepTime, summarizeSlots } from "@/lib/orders/pickup-schedule";
import { stockWithDrops } from "@/lib/orders/drops";
import { describeCard } from "@/lib/products/card";
import { getSellerUpcomingEvents } from "@/lib/events/queries";
import { EventStrip, type ListedEvent } from "@/components/event-list";
import { ProductQuickView } from "@/components/product-quick-view";
import { DROP_SELECT, toDrops, type DropRow } from "@/lib/orders/drop-queries";
import type { Product } from "@/lib/db/types";

/**
 * Storefronts are the marketplace's public face — a seller shares this link and search engines
 * index it, so it carries its own title, description and share image.
 */
export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("business_name, bio, home_state, is_paused, pause_reason")
    .eq("storefront_slug", slug)
    .maybeSingle();

  // A seller who closed for the season keeps their page, so it keeps its metadata.
  const closedByUs = seller?.is_paused && seller.pause_reason !== "vacation";
  if (!seller || closedByUs) return { title: "Storefront not found — Harvest Local" };

  const title = `${seller.business_name} — ${stateName(seller.home_state)} | Harvest Local`;
  const description =
    seller.bio?.trim().slice(0, 180) ||
    `Shop ${seller.business_name}, a local seller in ${stateName(seller.home_state)}. Pickup or local delivery.`;

  return {
    title,
    description,
    alternates: { canonical: `/s/${slug}` },
    openGraph: { title, description, type: "website", url: `/s/${slug}` },
  };
}

export default async function StorefrontPage({ params }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select(
      "id, profile_id, business_name, storefront_slug, bio, home_state, is_paused, pause_reason, delivery_enabled, delivery_radius_miles",
    )
    .eq("storefront_slug", slug)
    .maybeSingle();

  // Closed BY THE SELLER: the page stays up, read-only, so the link and the reviews survive a
  // season off. Closed by us — a lapsed licence, a revenue cap — behaves as it always has.
  const onBreak = !!seller?.is_paused && seller.pause_reason === "vacation";
  if (!seller || (seller.is_paused && !onBreak)) notFound();

  const [
    { data: products },
    user,
    browse,
    reviewSummary,
    reviews,
    pickupLocations,
    followerCount,
    viewerFollows,
    posts,
    questions,
    events,
  ] = await Promise.all([
    supabase
      .from("products")
      .select(
        `*, variants:product_variants(id, name, price, quantity_available, is_active, net_weight_value, net_weight_unit), drops:product_drops(${DROP_SELECT})`,
      )
      .eq("seller_id", seller.id)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    getUser(),
    getBrowseState(),
    getSellerReviewSummary(seller.id),
    getSellerReviews(seller.id),
    getActivePickupLocations(seller.id),
    getFollowerCount("seller", seller.id),
    isFollowing("seller", seller.id),
    getStorefrontPosts(seller.id),
    getStorefrontQuestions(seller.id),
    getSellerUpcomingEvents(seller.id),
  ]);

  const upcomingEvents: ListedEvent[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    eventDate: e.eventDate,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    status: e.status,
    cancelledNote: e.cancelledNote,
    description: e.description,
    locationText: e.locationText,
    sellerName: e.sellerName,
    sellerSlug: e.sellerSlug,
    market: e.market,
  }));

  const list = (products ?? []) as (Product & {
    variants?: VariantLike[];
    drops?: DropRow[];
  })[];
  // Where the state requires the label before payment, the listing is the first chance to show it.
  const disclosures = await getProductDisclosures(list.map((p) => p.id));

  // Everything a row says about a listing — price, weight, what's left, whether a batch governs it
  // — resolved once per product, so the sentence on the row and the presence of the basket button
  // cannot disagree.
  const facts = new Map(
    list.map((p) => [
      p.id,
      describeCard({
        id: p.id,
        title: p.title,
        price: p.price,
        quantityAvailable: p.quantity_available,
        netWeightValue: p.net_weight_value,
        netWeightUnit: p.net_weight_unit,
        allergens: p.allergens,
        images: p.images,
        variants: p.variants ?? [],
        drops: toDrops(p.drops),
      }),
    ]),
  );

  // A guest with no state yet may still fill a basket — checkout is where an account and the real
  // same-state check happen (`startCheckoutAction` against `profiles.home_state`). Only a *known*
  // mismatch hides the button, so the block is never guessed into existence.
  const buyerState = browse.state;
  const blockedFrom =
    buyerState != null && !sameState(buyerState, seller.home_state) ? buyerState : null;
  const canOrder = blockedFrom === null && !onBreak;
  const isOwner = !!user && user.id === seller.profile_id;

  return (
    <div className="space-y-8">
      {isOwner ? null : (
        <TrackStorefrontView sellerId={seller.id} productIds={list.map((p) => p.id)} />
      )}
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
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <FollowButton
            target="seller"
            id={seller.id}
            following={viewerFollows}
            count={followerCount}
            path={`/s/${slug}`}
            label="Follow"
          />
          {user && canOrder ? (
            <MessageSellerButton sellerId={seller.id} label={`Message ${seller.business_name}`} />
          ) : null}
        </div>
      </header>

      {onBreak ? (
        <Notice>
          <span className="font-medium">{seller.business_name} is closed right now.</span> You
          can look around and follow them — we&apos;ll email you when they reopen and list
          something.
        </Notice>
      ) : null}

      {blockedFrom ? (
        <Notice>
          {seller.business_name} sells in {stateName(seller.home_state)}. Harvest Local keeps orders
          within a single state, so you can browse here but can&apos;t order from{" "}
          {stateName(blockedFrom)}.{" "}
          <Link href="/shop" className="underline">
            Shop {stateName(blockedFrom)} sellers
          </Link>
          .
        </Notice>
      ) : !user ? (
        <Notice>
          Browsing as a guest — add to your basket now and{" "}
          <Link href={`/login?next=/s/${slug}`} className="underline">
            sign in
          </Link>{" "}
          when you check out.
        </Notice>
      ) : null}

      {posts.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Latest from {seller.business_name}</h2>
          <ul className="divide-y rounded-lg border">
            {posts.map((post) => (
              <li key={post.id} className="space-y-2 p-4 text-sm">
                <p className="whitespace-pre-line">{post.body}</p>
                {post.imageUrl ? (
                  <div className="bg-muted relative aspect-video max-w-sm overflow-hidden rounded-md border">
                    <Image
                      src={post.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 384px"
                    />
                  </div>
                ) : null}
                <p className="text-muted-foreground text-xs">
                  {new Date(post.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/*
        Where to find them in person. Distinct from "where to collect": a pickup location is where
        an order you already placed is handed over, an event is somewhere you could just turn up.
      */}
      {upcomingEvents.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Where to find us</h2>
          <EventStrip events={upcomingEvents} />
          <p className="text-muted-foreground text-xs">
            <Link href="/events" className="underline underline-offset-2">
              See everything on in {stateName(seller.home_state)} →
            </Link>
          </p>
        </section>
      ) : null}

      {/*
        Where to collect, approximately. The town and the market name, never the street: for most
        cottage sellers the collection point is their own house, and a browsing stranger does not
        need the door number to decide whether it's near enough. `order_pickup_address()` hands over
        the exact address once the order is paid for.
      */}
      {pickupLocations.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Where to collect</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {pickupLocations.map((loc) => {
              const where = approximateLocation(loc);
              const schedule = summarizeSlots(loc.slots);
              const notice = describePrepTime(loc.prepHours);
              return (
                <li key={loc.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{loc.label}</p>
                  {where ? <p className="text-muted-foreground">{where}</p> : null}
                  {loc.market ? (
                    <Link
                      href={`/markets/${loc.market.state.toLowerCase()}/${loc.market.slug}`}
                      className="text-muted-foreground text-xs underline"
                    >
                      About this market
                    </Link>
                  ) : null}
                  {schedule.length > 0 ? (
                    <ul className="text-muted-foreground pt-1">
                      {schedule.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  {notice ? (
                    <p className="text-muted-foreground pt-0.5 text-xs">Order ahead · {notice}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground text-xs">
            The exact address appears on your order once you&apos;ve paid.
          </p>
        </section>
      ) : null}

      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">No products listed yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start gap-4 p-4">
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
                {/* Price, weight, stock, allergens and the batch line all come from
                    `describeCard`, the same function the marketplace gallery and the quick view
                    use — so a listing cannot quote one price here and another on /shop. */}
                <p className="pt-1 text-sm font-medium">
                  {facts.get(p.id)!.priceLabel}
                  {facts.get(p.id)!.availability && !facts.get(p.id)!.availabilityIsBatch ? (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {facts.get(p.id)!.availability}
                    </span>
                  ) : null}
                  {facts.get(p.id)!.netWeight ? (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {facts.get(p.id)!.netWeight}
                    </span>
                  ) : null}
                </p>
                {/* Allergens are a buyer-safety fact, not seller admin — show them on the shelf. */}
                {facts.get(p.id)!.allergens ? (
                  <p className="text-muted-foreground pt-0.5 text-xs">
                    <span className="font-medium">Contains:</span> {facts.get(p.id)!.allergens}
                  </p>
                ) : null}
                <LabelDisclosure disclosure={disclosures[p.id]} className="mt-2" />

                {/* A batch listing says so on the shelf: how many are left and when they're
                    collected. */}
                {facts.get(p.id)!.availabilityIsBatch ? (
                  <p className="pt-1 text-sm font-medium">{facts.get(p.id)!.availability}</p>
                ) : null}

                {/* Ingredients and storage instructions are collected for the label and were shown
                    to buyers nowhere. They are exactly what someone choosing food wants to read,
                    and they are too long for a row, so they live behind this. */}
                <ProductQuickView
                  productId={p.id}
                  triggerLabel="Details"
                  className="mt-2 h-7 px-2 text-xs"
                />
              </div>
              {canOrder && facts.get(p.id)!.orderable ? (
                <AddToCart
                  variants={p.variants ?? []}
                  seller={{
                    sellerId: seller.id,
                    sellerSlug: seller.storefront_slug,
                    sellerName: seller.business_name,
                  }}
                  product={{
                    id: p.id,
                    title: p.title,
                    price: p.price,
                    quantityAvailable: stockWithDrops(toDrops(p.drops), p.quantity_available),
                  }}
                />
              ) : (
                <Badge variant="secondary">Pickup</Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      <StorefrontQuestions
        sellerId={seller.id}
        sellerName={seller.business_name}
        slug={slug}
        questions={questions}
      />

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
