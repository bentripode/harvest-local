import Image from "next/image";
import Link from "next/link";
import { Store } from "lucide-react";

import { facebookToShow, websiteLabel, websiteToShow } from "@/lib/markets/directory";
import { hoursProvenance, shortSummary } from "@/lib/markets/schedule";
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
 * The whole card opens the market's page (a stretched link), and the website and Facebook links
 * sit above it so the targets never nest.
 */
export function MarketCard({ market }: { market: MarketSummary }) {
  const structured = shortSummary(market.hours);
  const provenance = hoursProvenance(market.hours);
  const schedule = structured ?? market.hoursText;
  const website = websiteToShow(market.websiteUrl, market.websiteStatus);
  const facebook = facebookToShow(market.facebookUrl);

  return (
    <article className="hover:border-primary/40 relative flex h-full gap-3 rounded-xl border p-3 transition-colors">
      <div
        className={`relative size-20 shrink-0 overflow-hidden rounded-lg ${
          market.imageUrl ? "border bg-white" : "bg-muted"
        }`}
      >
        {/* Contained, not cropped: most of these are the market's logo, and a square crop cut a
            wide one mid-word ("GOOD LOCA"). A photo loses a little size; a logo keeps its name. */}
        {market.imageUrl ? (
          <Image src={market.imageUrl} alt="" fill sizes="80px" className="object-contain p-1" />
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
              {provenance ? (
                <span className="text-muted-foreground text-xs"> · {provenance.short}</span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">
              Hours not listed
              {website ? " — check their website" : facebook ? " — check their Facebook page" : ""}
            </span>
          )}
        </p>
        {website || facebook ? (
          <p className="relative z-10 flex max-w-full flex-wrap gap-x-3 text-xs">
            {website ? (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground max-w-full truncate underline underline-offset-2"
              >
                {websiteLabel(website)} ↗
              </a>
            ) : null}
            {facebook ? (
              <a
                href={facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Facebook ↗
              </a>
            ) : null}
          </p>
        ) : null}
      </div>
    </article>
  );
}
