import Link from "next/link";
import type { User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";

export function SiteHeader({ user }: { user: User | null }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-semibold tracking-tight">
          Harvest Local
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/seller">Storefront</Link>
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
