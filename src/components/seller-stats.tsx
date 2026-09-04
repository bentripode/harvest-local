import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd } from "@/lib/money";
import type { SellerStats } from "@/lib/analytics/queries";

export function SellerStatsPanel({ stats }: { stats: SellerStats }) {
  if (!stats.hasData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Your sales will show up here once orders start completing.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { current, prior, windowDays } = stats;
  const w = `${windowDays} days`;
  const trend =
    prior.revenueCents > 0
      ? Math.round(((current.revenueCents - prior.revenueCents) / prior.revenueCents) * 100)
      : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={`Revenue · ${w}`} value={formatUsd(current.revenueCents)}>
          {trend !== null ? (
            <span className={trend >= 0 ? "text-green-600" : "text-destructive"}>
              {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% vs prior {windowDays}d
            </span>
          ) : (
            <span className="text-muted-foreground">no prior-period sales</span>
          )}
        </Stat>
        <Stat label={`Completed orders · ${w}`} value={String(current.orders)}>
          {current.cancelled > 0 ? (
            <span className="text-muted-foreground">{current.cancelled} cancelled</span>
          ) : null}
        </Stat>
        <Stat
          label={`Average order · ${w}`}
          value={current.orders > 0 ? formatUsd(current.aovCents) : "—"}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Revenue · {windowDays <= 90 ? "daily" : "weekly"} · {w}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RevenueBars series={stats.series} />

          <div className="grid gap-x-8 gap-y-2 border-t pt-3 text-sm sm:grid-cols-2">
            <Row label={`Storefront views · ${w}`} value={String(current.views)} />
            <Row
              label="Conversion (completed ÷ views)"
              value={current.conversionPct != null ? `${current.conversionPct}%` : "—"}
            />
            <Row
              label="Pickup / delivery orders"
              value={`${current.pickupOrders} / ${current.deliveryOrders}`}
            />
            <Row label="Delivery fees collected" value={formatUsd(current.deliveryRevenueCents)} />
            <Row label="Referral discounts given" value={formatUsd(current.discountsCents)} />
            <Row
              label={`Prior ${windowDays}d revenue`}
              value={`${formatUsd(prior.revenueCents)} · ${prior.orders} orders`}
            />
          </div>

          {stats.topProducts.length > 0 ? (
            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-medium">Top products · {w}</p>
              <ul className="divide-y text-sm">
                {stats.topProducts.map((p) => (
                  <li key={p.title} className="flex justify-between gap-4 py-1.5">
                    <span className="truncate">{p.title}</span>
                    <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                      {p.units}× · {formatUsd(p.revenueCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {stats.mostViewedProducts.length > 0 ? (
            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-medium">Most viewed · {w}</p>
              <ul className="divide-y text-sm">
                {stats.mostViewedProducts.map((p) => (
                  <li key={p.title} className="flex justify-between gap-4 py-1.5">
                    <span className="truncate">{p.title}</span>
                    <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                      {p.views} view{p.views === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        {children ? <p className="mt-0.5 text-xs">{children}</p> : null}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Dependency-free revenue bars. Theme-aware via `currentColor`. */
function RevenueBars({ series }: { series: { label: string; cents: number }[] }) {
  const max = Math.max(1, ...series.map((d) => d.cents));
  const W = 100;
  const H = 32;
  const gap = series.length > 60 ? 0.2 : 0.8;
  const barW = (W - gap * (series.length - 1)) / series.length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="text-primary h-16 w-full"
      role="img"
      aria-label={`Revenue over ${series.length} periods`}
    >
      {series.map((d, i) => {
        const h = d.cents > 0 ? Math.max(1.2, (d.cents / max) * H) : 0.6;
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={H - h}
            width={barW}
            height={h}
            rx={0.4}
            fill="currentColor"
            opacity={d.cents > 0 ? 0.9 : 0.18}
          />
        );
      })}
    </svg>
  );
}
