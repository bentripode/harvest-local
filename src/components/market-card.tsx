import Image from "next/image";
import Link from "next/link";
import { MapPin, Store } from "lucide-react";

import { marketInitials, tileTone, todayLabel, type MarketToday } from "@/lib/markets/card";
import { facebookToShow, websiteLabel, websiteToShow } from "@/lib/markets/directory";
import { hoursProvenance, shortSummary } from "@/lib/markets/schedule";
import type { MarketSummary } from "@/lib/markets/queries";

/**
 * A market in a list.
 *
 * Picture-led, like the product gallery — the old card was an 80px thumbnail with four stacked
 * rows of text beside it, which is the same "chrome around one small picture" the product card
 * had to be rescued from.
 *
 * The catch is that only 12% of markets have a picture (841 of 7,032), so the fallback is what
 * most cards actually show and a grey box would be the whole page. It is a tinted monogram tile
 * instead: keyed to the slug so a market looks the same on every visit, varied across a grid, and
 * unmistakably not a photograph — which matters, because a stock photo on a named market's card
 * would read as a picture of that market. Real pictures stay CONTAINED rather than cropped: most
 * are logos, and a crop cut a wide one mid-word ("GOOD LOCA").
 *
 * `today` is the open-today ribbon and is null on the server on purpose — whether a market is open
 * today depends on the reader's own clock, not the UTC server's. See `markets/card.ts`, which also
 * explains why some ribbons hedge ("Usually open today").
 *
 * The schedule line degrades honestly: recorded hours (marked when they came from the market's
 * site rather than a person), else the directory's own free text, else "Hours not listed" — never
 * a blank that reads as "closed".
 *
 * The whole card opens the market's page (a stretched link); the website and Facebook links sit
 * above it so the targets never nest.
 */

/** Token-based so both themes get them for free; indexed by `tileTone`. */
const TONES = [
  "from-primary/25 to-primary/10",
  "from-accent/30 to-accent/12",
  "from-secondary to-secondary/50",
  "from-primary/18 to-accent/22",
];

function MarketMedia({ market, className }: { market: MarketSummary; className: string }) {
  if (market.imageUrl) {
    return (
      <div className={`relative overflow-hidden bg-white ${className}`}>
        <Image
          src={market.imageUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-contain p-4"
        />
      </div>
    );
  }

  const initials = marketInitials(market.name);
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden bg-gradient-to-br ${TONES[tileTone(market.slug, TONES.length)]} ${className}`}
    >
      <span className="text-primary/55 absolute inset-0 flex items-center justify-center text-5xl font-semibold tracking-tight select-none">
        {initials || <Store className="size-8" />}
      </span>
    </div>
  );
}

function OutboundLinks({ market }: { market: MarketSummary }) {
  const website = websiteToShow(market.websiteUrl, market.websiteStatus);
  const facebook = facebookToShow(market.facebookUrl);
  if (!website && !facebook) return null;

  return (
    <p className="relative z-10 flex max-w-full flex-wrap gap-x-3 pt-0.5 text-xs">
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
  );
}

function ScheduleLine({ market }: { market: MarketSummary }) {
  const schedule = shortSummary(market.hours) ?? market.hoursText;
  const provenance = hoursProvenance(market.hours);
  const website = websiteToShow(market.websiteUrl, market.websiteStatus);
  const facebook = facebookToShow(market.facebookUrl);

  if (!schedule) {
    return (
      <p className="text-muted-foreground text-sm">
        Hours not listed
        {website ? " — check their website" : facebook ? " — check their Facebook page" : ""}
      </p>
    );
  }

  return (
    <p className="text-sm">
      {schedule}
      {provenance ? (
        <span className="text-muted-foreground block text-xs">{provenance.short}</span>
      ) : null}
    </p>
  );
}

export function MarketCard({
  market,
  today = null,
  compact = false,
}: {
  market: MarketSummary;
  /** Today's session as of the READER's clock, or null on the server. See `markets/card.ts`. */
  today?: MarketToday | null;
  /** The map popup, where a full-height picture would push the details off screen. */
  compact?: boolean;
}) {
  const href = `/markets/${market.state.toLowerCase()}/${market.slug}`;
  const nameLink = (
    <Link
      href={href}
      className="no-underline after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
    >
      {market.name}
    </Link>
  );

  if (compact) {
    return (
      <article className="hover:border-primary/40 relative flex h-full gap-3 rounded-xl border p-3 transition-colors">
        <MarketMedia market={market} className="size-16 shrink-0 rounded-lg border" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="leading-snug font-medium">{nameLink}</h3>
          {market.city ? (
            <p className="text-muted-foreground text-sm">
              {market.city}, {market.state}
            </p>
          ) : null}
          <ScheduleLine market={market} />
          <OutboundLinks market={market} />
        </div>
      </article>
    );
  }

  const open = today?.kind === "open_now";

  return (
    <article
      className={`group bg-card relative flex h-full flex-col overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-md ${
        today ? "border-accent/60 shadow-sm" : "hover:border-primary/40"
      }`}
    >
      <MarketMedia market={market} className="aspect-[16/9] w-full border-b" />

      {today ? (
        <p
          className={`px-4 py-1.5 text-center text-xs font-medium ${
            open ? "bg-accent text-accent-foreground" : "bg-accent/20 text-foreground"
          }`}
        >
          {todayLabel(today)}
        </p>
      ) : null}

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {market.city ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <MapPin aria-hidden className="size-3.5 shrink-0" />
            {market.city}, {market.state}
          </p>
        ) : null}

        <h3 className="text-base leading-snug font-semibold tracking-tight group-hover:underline">
          {nameLink}
        </h3>

        <ScheduleLine market={market} />
        <OutboundLinks market={market} />

        <span className="text-primary mt-auto pt-2 text-sm font-medium">Details →</span>
      </div>
    </article>
  );
}
