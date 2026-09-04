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

  const { last30, prev30, last90 } = stats;
  const trend =
    prev30.revenueCents > 0
      ? Math.round(((last30.revenueCents - prev30.revenueCents) / prev30.revenueCents) * 100)
      : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Revenue · 30 days" value={formatUsd(last30.revenueCents)}>
          {trend !== null ? (
            <span className={trend >= 0 ? "text-green-600" : "text-destructive"}>
              {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% vs prior 30
            </span>
          ) : (
            <span className="text-muted-foreground">no prior-period sales</span>
          )}
        </Stat>
        <Stat label="Completed orders · 30 days" value={String(last30.orders)}>
          {last30.cancelled > 0 ? (
            <span className="text-muted-foreground">{last30.cancelled} cancelled</span>
          ) : null}
        </Stat>
        <Stat
          label="Average order · 30 days"
          value={last30.orders > 0 ? formatUsd(last30.aovCents) : "—"}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Daily revenue · 30 days</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RevenueBars daily={stats.daily} />

          <div className="grid gap-x-8 gap-y-2 border-t pt-3 text-sm sm:grid-cols-2">
            <Row label="Storefront views · 30 days" value={String(last30.views)} />
            <Row
              label="Conversion (completed ÷ views)"
              value={last30.conversionPct != null ? `${last30.conversionPct}%` : "—"}
            />
            <Row label="Pickup / delivery orders" value={`${last30.pickupOrders} / ${last30.deliveryOrders}`} />
            <Row label="Delivery fees collected" value={formatUsd(last30.deliveryRevenueCents)} />
            <Row label="Referral discounts given" value={formatUsd(last30.discountsCents)} />
            <Row
              label="Revenue · 90 days"
              value={`${formatUsd(last90.revenueCents)} · ${last90.orders} orders`}
            />
          </div>

          {stats.topProducts.length > 0 ? (
            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-medium">Top products · 30 days</p>
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

/** Dependency-free daily revenue bars. Theme-aware via `currentColor`. */
function RevenueBars({ daily }: { daily: { date: string; cents: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.cents));
  const W = 100;
  const H = 32;
  const gap = 0.8;
  const barW = (W - gap * (daily.length - 1)) / daily.length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="text-primary h-16 w-full"
      role="img"
      aria-label="Daily revenue for the last 30 days"
    >
      {daily.map((d, i) => {
        const h = d.cents > 0 ? Math.max(1.2, (d.cents / max) * H) : 0.6;
        return (
          <rect
            key={d.date}
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
