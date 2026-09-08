import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { getProfile } from "@/lib/auth";

/**
 * The public cottage-food guide. No session required and nothing collected — these pages exist to
 * be read and linked to, including by people who will never sell here.
 */
export default async function GuideLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader profile={profile} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">{children}</main>
      <footer className="border-t">
        <div className="text-muted-foreground mx-auto w-full max-w-4xl px-6 py-8 text-sm">
          <p>
            Harvest Local is a marketplace for cottage-food sellers.{" "}
            <Link href="/cottage-food-laws" className="underline">
              Cottage food laws by state
            </Link>{" "}
            ·{" "}
            <Link href="/shop" className="underline">
              Shop local sellers
            </Link>{" "}
            ·{" "}
            <Link href="/markets" className="underline">
              Farmers markets
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
