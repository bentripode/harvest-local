import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SellerAvatar } from "@/components/seller-avatar";
import { getAccessMode, getProfile } from "@/lib/auth";
import { getCategories } from "@/lib/catalog";
import { getBrowseState } from "@/lib/geo/browse-state";
import { shopHref, topLevelCategories } from "@/lib/products/category-filter";
import { getHomeStories } from "@/lib/stories/queries";
import { storyExcerpt, worthShowing } from "@/lib/stories/select";
import { stateName } from "@/lib/geo/state";
import { categoryPhoto, stockPhoto } from "@/lib/stock/photos";

const hero = stockPhoto("/stock/home-preserves-shelf.jpg");

export default async function HomePage() {
  const [profile, accessMode, browse, allCategories] = await Promise.all([
    getProfile(),
    getAccessMode(),
    getBrowseState(),
    getCategories(),
  ]);
  const categories = topLevelCategories(allCategories);
  const isSeller = profile?.role === "seller" || profile?.role === "admin";

  // The strongest argument this page can make is that the marketplace is made of people. It is also
  // the one that cannot be written in advance — it only exists once sellers have opted in.
  const stories = await getHomeStories(browse.state);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-14 py-8 sm:py-14">
      {/*
          One sentence and one button. This was a centred column of 24 units of padding holding a
          two-line headline, a three-line paragraph, an early-access box, two buttons and a
          five-line pitch for the compliance data — five blocks of prose before anything a buyer
          could act on, and on a phone the fold landed in the middle of the second paragraph.
        */}
      <section className="space-y-5 text-center">
        <h1 className="text-4xl sm:text-5xl">Food and craft from your own state</h1>
        <p className="text-muted-foreground mx-auto max-w-md text-lg">
          Bought from the person who made it. Collect nearby, or have it dropped round.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          {isSeller ? (
            <Button asChild size="lg" variant="accent">
              <Link href="/seller">Your storefront</Link>
            </Button>
          ) : (
            <Button asChild size="lg" variant="accent">
              <Link href="/shop">Find sellers near you</Link>
            </Button>
          )}
          {!profile ? (
            <Button asChild variant="ghost" size="lg">
              <Link href="/sell">Start selling</Link>
            </Button>
          ) : null}
        </div>

        {accessMode === "sellers_only" ? (
          <p className="text-muted-foreground text-sm">
            We&apos;re early — quiet in most states, and no account needed to look.
          </p>
        ) : null}
      </section>

      {/* Below the buttons, not above the headline: on a phone the call to action has to stay above
            the fold. It is a stock photo, so it illustrates the idea and stands for no seller here. */}
      <figure className="space-y-2">
        <Image
          src={hero.src}
          width={hero.width}
          height={hero.height}
          alt="A row of jars of homemade preserves on a wooden shelf"
          preload
          sizes="(max-width: 768px) 100vw, 768px"
          className="aspect-[3/2] w-full rounded-2xl object-cover sm:aspect-[2/1]"
          style={{ backgroundColor: hero.avgColor }}
        />
        <figcaption className="text-muted-foreground text-right text-xs">
          Photo by{" "}
          <a href={hero.authorUrl} className="underline underline-offset-2">
            {hero.author}
          </a>{" "}
          on{" "}
          <a href={hero.pexelsUrl} className="underline underline-offset-2">
            Pexels
          </a>
        </figcaption>
      </figure>

      {/* The makers come before the pitch now. Three real people are a better argument for the
            marketplace than any sentence about it, and they were below every one of them. */}
      {worthShowing(stories) ? (
        <section className="space-y-5">
          <h2 className="text-center text-xl">
            {browse.state ? `Makers in ${stateName(browse.state)}` : "A few makers"}
          </h2>

          {/* No photograph on these cards. A product shot is a picture of a jar, not of a person,
                and with only some sellers having one the cards came out at different heights with a
                grey box where a face should be. The words are the point; the storefront has the
                pictures. */}
          <ul className="grid gap-4 sm:grid-cols-3">
            {stories.map((s) => (
              <li key={s.sellerId}>
                <Link
                  href={`/s/${s.storefrontSlug}`}
                  className="hover:border-primary/40 flex h-full flex-col gap-2 rounded-2xl border p-4 no-underline transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <SellerAvatar name={s.businessName} src={s.avatarUrl} size="sm" />
                    <span className="truncate font-medium">{s.businessName}</span>
                  </span>
                  <span className="text-muted-foreground flex-1 text-sm">
                    {storyExcerpt(s.story)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-center text-xs">This changes daily.</p>
        </section>
      ) : null}

      {/* A way in by what you want rather than by who is near. Every tile is shown even in a thin
            state: /shop says plainly when nobody is listing a category, which is a truer answer
            than a home page that quietly hides it. The photos are stock and show no seller's
            goods — alt is empty because the label beside each one already names the link. */}
      {categories.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-center text-xl">Shop by category</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map((c) => {
              const photo = categoryPhoto(c.slug);
              return (
                <li key={c.id}>
                  <Link
                    href={shopHref({ view: "list", category: c.slug })}
                    className="group block space-y-1.5 no-underline"
                  >
                    <span
                      className="bg-muted block aspect-square overflow-hidden rounded-2xl"
                      style={photo ? { backgroundColor: photo.avgColor } : undefined}
                    >
                      {photo ? (
                        <Image
                          src={photo.src}
                          width={photo.width}
                          height={photo.height}
                          alt=""
                          sizes="(min-width: 640px) 190px, 50vw"
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : null}
                    </span>
                    <span className="block text-sm font-medium group-hover:underline">
                      {c.name}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground text-center text-xs">
            Photos from Pexels ·{" "}
            <Link href="/credits" className="underline underline-offset-2">
              credits
            </Link>
          </p>
        </section>
      ) : null}

      {/*
          The compliance data is the most defensible thing here and the reason a seller should pick
          us, so it keeps a door on the front page — but it is a door now, not a paragraph. Anyone
          who wants the detail is one tap from all of it.
        */}
      <section className="flex flex-col gap-3 border-t pt-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          Selling food you make at home? We read every state&apos;s law, with a link to the statute
          on every claim.
        </p>
        <p className="flex shrink-0 gap-4">
          <Link href="/cottage-food-laws" className="underline underline-offset-4">
            Cottage food laws
          </Link>
          <Link href="/markets" className="underline underline-offset-4">
            Farmers markets
          </Link>
        </p>
      </section>
    </div>
  );
}
