import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SellerAvatar } from "@/components/seller-avatar";
import { getAccessMode, getProfile } from "@/lib/auth";
import { getBrowseState } from "@/lib/geo/browse-state";
import { getHomeStories } from "@/lib/stories/queries";
import { storyExcerpt, worthShowing } from "@/lib/stories/select";
import { stateName } from "@/lib/geo/state";

export default async function HomePage() {
  const [profile, accessMode, browse] = await Promise.all([
    getProfile(),
    getAccessMode(),
    getBrowseState(),
  ]);
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
