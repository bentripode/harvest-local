import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductDisclosures } from "@/lib/labels/disclosure";
import { LabelDisclosure } from "@/components/label-disclosure";

import { AddToCart } from "@/components/add-to-cart";
import { StarRating } from "@/components/star-rating";
import { SellerAvatar } from "@/components/seller-avatar";
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
      "id, profile_id, business_name, storefront_slug, bio, story, home_state, is_paused, pause_reason, delivery_enabled, delivery_radius_miles, avatar_url, cover_url",
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

  // A required disclosure that could not be resolved is not the same as one that isn't required.
  // `product_label_disclosure()` returns a row for every visible product — `predisclosure_required`
  // simply comes back false in the 40 states with no such rule — so a product MISSING from this map
  // means the call failed, and we do not know what the buyer is owed.
  //
  // The quick view has always failed closed on exactly this (`canAddToBasket`); the storefront row
  // did not, and would have rendered a basket button beside an empty disclosure. Same posture here.
  const disclosureResolved = (id: string) => disclosures[id] !== undefined;

  return (
    <div className="space-y-10">
      {isOwner ? null : (
        <TrackStorefrontView sellerId={seller.id} productIds={list.map((p) => p.id)} />
      )}

      {/* The storefront reads as a profile: who they are, then what they have. */}
      <header className="space-y-4">
        {/* No banner renders no band at all. An empty grey strip across the top looks like a page
            that failed to load, which is worse than a page that simply hasn't got one. */}
        {seller.cover_url ? (
          <div className="bg-muted relative -mx-4 aspect-[3/1] overflow-hidden sm:mx-0 sm:rounded-2xl sm:border">
            <Image
              src={seller.cover_url}
              alt=""
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 1024px"
            />
          </div>
        ) : null}
        <div className="flex items-center gap-4">
          <SellerAvatar name={seller.business_name} src={seller.avatar_url} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl sm:text-3xl">{seller.business_name}</h1>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
              <span>
                {stateName(seller.home_state)} ·{" "}
                {seller.delivery_enabled
                  ? `pickup or delivery${seller.delivery_radius_miles ? ` within ${seller.delivery_radius_miles} mi` : ""}`
                  : "pickup"}
              </span>
              {reviewSummary.count > 0 && reviewSummary.avg != null ? (
                <span className="inline-flex items-center gap-1">
                  · <StarRating value={reviewSummary.avg} />
                  <span className="tabular-nums">
                    {reviewSummary.avg.toFixed(1)} ({reviewSummary.count})
                  </span>
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {seller.bio ? <p className="max-w-2xl">{seller.bio}</p> : null}
        {/* The long version, in full — the home page shows an excerpt, this is where it lands. */}
        {seller.story ? (
          <p className="text-muted-foreground max-w-2xl text-sm whitespace-pre-line">
            {seller.story}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <FollowButton
            target="seller"
            id={seller.id}
            following={viewerFollows}
            count={followerCount}
            path={`/s/${slug}`}
            label="Follow"
          />
          {user && canOrder ? <MessageSellerButton sellerId={seller.id} label="Message" /> : null}
        </div>
      </header>

      {onBreak ? (
        <Notice>
          <span className="font-medium">{seller.business_name} is closed right now.</span> Follow
          them and we&apos;ll email you when they reopen.
        </Notice>
      ) : null}

      {blockedFrom ? (
        <Notice>
          {seller.business_name} sells in {stateName(seller.home_state)}, and orders stay inside one
          state — so you can look, but not order from {stateName(blockedFrom)}.{" "}
          <Link href="/shop" className="underline">
            Shop {stateName(blockedFrom)} sellers
          </Link>
          .
        </Notice>
      ) : !user ? (
        <Notice>
          Add to your basket now and{" "}
          <Link href={`/login?next=/s/${slug}`} className="underline">
            sign in
          </Link>{" "}
          at checkout.
        </Notice>
      ) : null}

      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing listed yet.</p>
      ) : (
        <section className="space-y-3">
          <SectionHeading>Shop</SectionHeading>
          <ul className="space-y-3">
            {list.map((p) => {
              const f = facts.get(p.id)!;
              const showable = disclosureResolved(p.id);
              return (
                <li
                  key={p.id}
                  className="hover:border-primary/30 flex gap-4 rounded-2xl border p-3 transition-colors sm:p-4"
                >
                  <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-xl border sm:size-24">
                    {p.images?.[0] ? (
                      <Image
                        src={p.images[0].url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="text-muted-foreground/50 font-heading absolute inset-0 flex items-center justify-center text-2xl"
                      >
                        {p.title.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="font-medium">{p.title}</p>
                      {/* Price, weight, stock and the batch line all come from `describeCard`, the
                          same function the gallery and the quick view use — so a listing cannot
                          quote one price here and another on /shop. */}
                      <p className="tabular-nums">{f.priceLabel}</p>
                    </div>

                    {f.netWeight || (!f.availabilityIsBatch && f.availability) ? (
                      <p className="text-muted-foreground text-sm">
                        {[f.netWeight, f.availabilityIsBatch ? null : f.availability]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}

                    {/* A batch is the proposition — how many are left and when they are collected. */}
                    {f.availabilityIsBatch && f.availability ? (
                      <p className="text-primary text-sm font-medium">{f.availability}</p>
                    ) : null}

                    {p.description ? (
                      <p className="text-muted-foreground line-clamp-2 text-sm">{p.description}</p>
                    ) : null}

                    {/* Allergens are a buyer-safety fact, not seller admin — show them on the shelf. */}
                    {f.allergens ? (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Contains</span> {f.allergens}
                      </p>
                    ) : null}

                    <LabelDisclosure disclosure={disclosures[p.id]} className="mt-2" />

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {/* Ingredients and storage instructions are collected for the label and were
                          shown to buyers nowhere. Too long for a row, so they live behind this. */}
                      <ProductQuickView
                        productId={p.id}
                        triggerLabel="Details"
                        className="h-8 px-3 text-xs"
                      />
                      {canOrder && f.orderable && showable ? (
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
                            quantityAvailable: stockWithDrops(
                              toDrops(p.drops),
                              p.quantity_available,
                            ),
                          }}
                        />
                      ) : canOrder && f.orderable && !showable ? (
                        <span className="text-muted-foreground text-xs">
                          Label information is unavailable, so this cannot be ordered right now.
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {posts.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading>Latest</SectionHeading>
          <ul className="space-y-3">
            {posts.map((post) => (
              <li key={post.id} className="space-y-2 rounded-2xl border p-4 text-sm">
                <p className="whitespace-pre-line">{post.body}</p>
                {post.imageUrl ? (
                  <div className="bg-muted relative aspect-video max-w-sm overflow-hidden rounded-xl border">
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
        <section className="space-y-3">
          <SectionHeading>Where to find us</SectionHeading>
          <EventStrip events={upcomingEvents} />
          <p className="text-muted-foreground text-xs">
            <Link href="/events" className="underline underline-offset-2">
              Everything on in {stateName(seller.home_state)} →
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
        <section className="space-y-3">
          <SectionHeading>Where to collect</SectionHeading>
          <ul className="grid gap-3 sm:grid-cols-2">
            {pickupLocations.map((loc) => {
              const where = approximateLocation(loc);
              const schedule = summarizeSlots(loc.slots);
              const notice = describePrepTime(loc.prepHours);
              return (
                <li key={loc.id} className="rounded-2xl border p-4 text-sm">
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

      <StorefrontQuestions
        sellerId={seller.id}
        sellerName={seller.business_name}
        slug={slug}
        questions={questions}
      />

      {reviews.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading>
            Reviews{reviewSummary.count > 0 ? ` (${reviewSummary.count})` : ""}
          </SectionHeading>
          <ReviewList reviews={reviews} />
        </section>
      ) : null}
    </div>
  );
}

/** One weight for every section label on the page, so the eye finds them all the same way. */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg">{children}</h2>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="bg-muted/50 rounded-xl border p-3 text-sm">{children}</p>;
}
