import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { getBuyerOrders } from "@/lib/orders/queries";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status";
import { formatUsd, toCents } from "@/lib/money";
import type { OrderStatus } from "@/lib/db/types";

export const metadata = { title: "My orders — Harvest Local" };

export default async function BuyerOrdersPage() {
  const { user } = await requireUser("/orders");
  const orders = await getBuyerOrders(user.id);

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-2 rounded-lg border border-dashed p-10 text-center">
        <p className="font-medium">No orders yet</p>
        <p className="text-muted-foreground text-sm">
          <Link href="/shop" className="underline">
            Start shopping
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">My orders</h1>
      <ul className="divide-y rounded-lg border">
        {orders.map((o) => (
          <li key={o.id} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <Link href={`/orders/${o.id}`} className="font-medium hover:underline">
                {o.seller?.business_name ?? "Order"}
              </Link>
              <p className="text-muted-foreground text-sm">
                {new Date(o.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })} ·{" "}
                {o.item_count?.[0]?.count ?? 0} item(s)
              </p>
            </div>
            <Badge variant={o.status === "completed" ? "default" : "secondary"}>
              {ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}
            </Badge>
            <span className="w-20 text-right text-sm font-medium tabular-nums">
              {formatUsd(toCents(o.total))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
