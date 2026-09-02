import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { getAccessMode, getUser } from "@/lib/auth";

export default async function HomePage() {
  const [user, accessMode] = await Promise.all([getUser(), getAccessMode()]);

  return (
    <>
      <SiteHeader user={user} />
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
          <Button asChild size="lg">
            <Link href={user ? "/seller" : "/signup?role=seller"}>
              {user ? "Go to your storefront" : "Start selling"}
            </Link>
          </Button>
          {!user ? (
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          ) : null}
        </div>
      </main>
    </>
  );
}
