import Image from "next/image";
import Link from "next/link";
import { Store } from "lucide-react";

import { safeWebsiteUrl, websiteLabel } from "@/lib/markets/directory";
import { hoursFromWebsite, shortSummary } from "@/lib/markets/schedule";
import type { MarketSummary } from "@/lib/markets/queries";

/**
 * A market in a list.
 *
 * The picture is the market's own link-preview image, copied by `scripts/market-websites.mjs`.
 * With none, the tile shows an icon — never a stock photo, which on a named market's card would
 * read as a picture of that market.
 *
 * The schedule line degrades honestly: recorded hours (marked when they came from the market's
 * site rather than a person), else the directory's own free text, else "Hours not listed" — never
 * a blank that reads as "closed". The description upstream calls a season is left to the market's
 * own page: in a list it was a paragraph of prose under every name.
 *
 * The whole card opens the market's page (a stretched link), and the website link sits above it
 * so the two targets never nest.
 */
export function MarketCard({ market }: { market: MarketSummary }) {
  const structured = shortSummary(market.hours);
  const fromSite = hoursFromWebsite(market.hours);
  const schedule = structured ?? market.hoursText;
  const website = safeWebsiteUrl(market.websiteUrl);

  return (
    <article className="hover:border-primary/40 relative flex h-full gap-3 rounded-xl border p-3 transition-colors">
      <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-lg">
        {market.imageUrl ? (
          <Image src={market.imageUrl} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <Store aria-hidden className="text-muted-foreground absolute inset-0 m-auto size-7" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <h3 className="leading-snug font-medium">
          <Link
            href={`/markets/${market.state.toLowerCase()}/${market.slug}`}
            className="no-underline after:absolute after:inset-0 after:rounded-xl hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {market.name}
          </Link>
        </h3>
        {market.city ? (
          <p className="text-muted-foreground text-sm">
            {market.city}, {market.state}
          </p>
        ) : null}
        <p className="pt-0.5 text-sm">
          {schedule ? (
            <>
              {schedule}
              {fromSite ? (
                <span className="text-muted-foreground text-xs"> · from their website</span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">
              Hours not listed{website ? " — check their website" : ""}
            </span>
          )}
        </p>
        {website ? (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground relative z-10 inline-block max-w-full truncate text-xs underline underline-offset-2"
          >
            {websiteLabel(website)} ↗
          </a>
        ) : null}
      </div>
    </article>
  );
}
