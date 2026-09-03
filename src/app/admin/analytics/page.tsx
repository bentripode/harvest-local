import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformStats } from "@/lib/admin/analytics";
import { formatUsd } from "@/lib/money";

export const metadata = { title: "Platform analytics — Admin" };

export default async function AdminAnalyticsPage() {
  const s = await getPlatformStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform analytics</h1>
        <p className="text-muted-foreground text-sm">Marketplace-wide, all sellers.</p>
      </div>

      <Group title="Volume">
        <Stat label="GMV · all time" value={formatUsd(s.gmvCents)} sub={`${s.ordersCompleted} completed orders`} />
        <Stat label="GMV · 30 days" value={formatUsd(s.gmv30Cents)} sub={`${s.ordersCompleted30} orders`} />
        <Stat label="Average order" value={s.ordersCompleted > 0 ? formatUsd(s.aovCents) : "—"} />
        <Stat
          label="Refunded"
          value={formatUsd(s.refundedCents)}
          sub={`${s.refundCount} refund${s.refundCount === 1 ? "" : "s"}`}
        />
      </Group>

      <Group title="Subscription revenue">
        <Stat label="MRR" value={formatUsd(s.mrrCents)} sub="active subscriptions × $20" />
        <Stat label="Paying sellers" value={String(s.subsActive)} />
        <Stat label="In trial" value={String(s.subsTrialing)} sub="90-day free trial" />
      </Group>

      <Group title="Marketplace">
        <Stat label="Sellers" value={String(s.sellersTotal)} sub={`${s.sellersLive} live`} />
        <Stat label="Active sellers · 30d" value={String(s.sellersActive30)} sub="had a completed order" />
        <Stat label="Buyers" value={String(s.buyersTotal)} sub={`${s.buyersOrdered} have ordered`} />
        <Stat label="New signups · 30d" value={String(s.signups30)} />
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        {sub ? <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}
