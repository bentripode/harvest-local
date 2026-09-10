import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { getSellerContext } from "@/lib/auth";
import { getSellerOrders } from "@/lib/orders/queries";
import { ORDER_STATUS_LABELS, isTerminal } from "@/lib/orders/status";
import { formatUsd, toCents } from "@/lib/money";
import type { OrderStatus } from "@/lib/db/types";

export default async function SellerOrdersPage() {
  const { profile, seller, onboardingComplete } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");
  if (!onboardingComplete) redirect("/seller/onboarding");

  const orders = await getSellerOrders(seller.id);
  const open = orders.filter((o) => !isTerminal(o.status as OrderStatus));
  const done = orders.filter((o) => isTerminal(o.status as OrderStatus));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl">Orders</h1>
          <p className="text-muted-foreground text-sm">
            Confirmed orders from buyers. Move each one along as you prepare it.
          </p>
        </div>
        {orders.length > 0 ? (
          <a
            href="/seller/orders/export"
            download
            className="text-muted-foreground hover:text-foreground shrink-0 rounded-md border px-3 py-1.5 text-sm"
          >
            Export CSV
          </a>
        ) : null}
      </div>

      <Group title="Active" empty="No open orders." orders={open} />
      {done.length > 0 ? <Group title="Completed & cancelled" orders={done} /> : null}
    </div>
  );
}

function Group({
  title,
  orders,
  empty,
}: {
  title: string;
  empty?: string;
  orders: Awaited<ReturnType<typeof getSellerOrders>>;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg">{title}</h2>
      {orders.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {empty}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {orders.map((o) => (
            <li key={o.id} className="p-4">
              <Link href={`/seller/orders/${o.id}`} className="block space-y-1 no-underline">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">
                    {o.buyer?.display_name ?? "Buyer"}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatUsd(toCents(o.total))}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge variant={o.status === "completed" ? "default" : "secondary"}>
                    {ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    {new Date(o.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    {" · "}
                    {o.item_count?.[0]?.count ?? 0} item(s)
                    {o.fulfillment_type === "delivery"
                      ? ` · delivery${o.delivery_window ? ` (${o.delivery_window})` : ""}`
                      : ""}
                  </span>
                </span>
                <span className="text-muted-foreground block font-mono text-xs">
                  {o.id.slice(0, 8)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
