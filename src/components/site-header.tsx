import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/db/types";

export function SiteHeader({ profile }: { profile: Profile | null }) {
  const isSeller = profile?.role === "seller" || profile?.role === "admin";

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-semibold tracking-tight">
          Harvest Local
        </Link>
        <nav className="flex items-center gap-2">
          {profile ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href={isSeller ? "/seller" : "/shop"}>
                  {isSeller ? "Storefront" : "Shop"}
                </Link>
              </Button>
              <form action="/auth/signout" method="post">
                <Button variant="outline" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup?role=seller">Start selling</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
