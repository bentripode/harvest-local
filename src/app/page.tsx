import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { getAccessMode, getProfile } from "@/lib/auth";

export default async function HomePage() {
  const [profile, accessMode] = await Promise.all([getProfile(), getAccessMode()]);
  const isSeller = profile?.role === "seller" || profile?.role === "admin";

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          A local map for farmers, artisans &amp; makers
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg">
          Harvest Local connects you with sellers in your own state — fresh produce, baked goods,
          preserves, and handmade craft, for pickup or nearby delivery.
        </p>

        {accessMode === "sellers_only" ? (
          <div className="bg-muted/50 w-full max-w-md rounded-lg border p-5 text-sm">
            <p className="font-medium">We&apos;re in early access.</p>
            <p className="text-muted-foreground mt-1">
              Sellers are still getting their storefronts ready, so it&apos;s quiet in most states.
              Browse what&apos;s live today — no account needed to look.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {!profile ? (
            <>
              {/* Browsing is public in both access modes, so the front door is the shop. */}
              <Button asChild size="lg">
                <Link href="/shop">Browse local sellers</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/signup?role=seller">Sell on Harvest Local</Link>
              </Button>
            </>
          ) : isSeller ? (
            <Button asChild size="lg">
              <Link href="/seller">Go to your storefront</Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href="/shop">Browse local sellers</Link>
            </Button>
          )}
        </div>
      </main>
    </>
  );
}
