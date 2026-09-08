import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { shortSummary } from "@/lib/markets/schedule";
import type { MarketSummary } from "@/lib/markets/queries";

/**
 * A market in a list. The schedule line degrades honestly: structured hours if someone recorded
 * them, else the directory's own free text, else an explicit "schedule not recorded" — never a
 * blank that reads as "closed".
 */
export function MarketCard({ market }: { market: MarketSummary }) {
  const structured = shortSummary(market.hours);
  const schedule = structured ?? market.hoursText;

  return (
    <Link
      href={`/markets/${market.state.toLowerCase()}/${market.slug}`}
      className="focus-visible:ring-ring block h-full rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="space-y-1.5 pt-6">
          <p className="font-medium">{market.name}</p>
          {market.city ? (
            <p className="text-muted-foreground text-sm">
              {market.city}, {market.state}
            </p>
          ) : null}
          {market.seasonText ? (
            <p className="text-muted-foreground text-xs">Season · {market.seasonText}</p>
          ) : null}
          <p className="pt-1 text-sm">
            {schedule ?? (
              <span className="text-muted-foreground">Schedule not recorded</span>
            )}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
