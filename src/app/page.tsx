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
              Right now Harvest Local is open to sellers getting their storefronts ready. Buyer
              shopping opens soon.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {!profile ? (
            <>
              <Button asChild size="lg">
                <Link href={accessMode === "public" ? "/signup?role=buyer" : "/signup?role=seller"}>
                  {accessMode === "public" ? "Sign up to shop" : "Start selling"}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href={accessMode === "public" ? "/signup?role=seller" : "/login"}>
                  {accessMode === "public" ? "Sell on Harvest Local" : "Sign in"}
                </Link>
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
