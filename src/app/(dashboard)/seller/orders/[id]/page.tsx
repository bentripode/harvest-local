import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { OrderStatusTimeline } from "@/components/order-status-timeline";
import { OrderActions } from "@/components/order-actions";
import { MessageSellerButton } from "@/components/message-seller-button";
import { getSellerContext } from "@/lib/auth";
import { getOrder } from "@/lib/orders/queries";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status";
import { formatUsd, toCents } from "@/lib/money";
import { stateName } from "@/lib/geo/state";
import type { FulfillmentType, OrderStatus } from "@/lib/db/types";

export default async function SellerOrderPage({ params }: PageProps<"/seller/orders/[id]">) {
  const { id } = await params;
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const order = await getOrder(id);
  if (!order || order.seller?.id !== seller.id) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/seller/orders" className="text-muted-foreground text-sm hover:underline">
        ← All orders
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Order {order.id.slice(0, 8)}
          </h1>
          <p className="text-muted-foreground text-sm">
            {order.buyer?.display_name ?? "Buyer"} ·{" "}
            {new Date(order.created_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            · {order.fulfillment_type === "delivery" ? "Delivery" : "Pickup"} ·{" "}
            {stateName(order.seller_state)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant={order.status === "completed" ? "default" : "secondary"}>
            {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
          </Badge>
          <MessageSellerButton orderId={order.id} label="Message buyer" variant="ghost" />
        </div>
      </div>

      <section className="rounded-lg border">
        <ul className="divide-y">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 p-3 text-sm">
              <span>
                {item.quantity} × {item.title_snapshot}
              </span>
              <span className="tabular-nums">{formatUsd(toCents(item.line_total))}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t p-3 text-sm">
          <Row label="Subtotal" value={formatUsd(toCents(order.subtotal))} />
          {toCents(order.discount_total) > 0 ? (
            <Row label="Discount" value={`− ${formatUsd(toCents(order.discount_total))}`} />
          ) : null}
          {toCents(order.delivery_fee) > 0 ? (
            <Row label="Local delivery" value={formatUsd(toCents(order.delivery_fee))} />
          ) : null}
          <Row label="Sales tax" value={formatUsd(toCents(order.tax_total))} />
          <Row label="Total" value={formatUsd(toCents(order.total))} strong />
        </div>
      </section>

      {order.fulfillment_type === "delivery" && order.delivery_address_text ? (
        <section className="rounded-lg border p-4 text-sm">
          <h2 className="mb-1 font-medium">Deliver to</h2>
          <p className="text-muted-foreground">{order.delivery_address_text}</p>
          {order.delivery_distance_miles != null ? (
            <p className="text-muted-foreground text-xs">
              {order.delivery_distance_miles} driving miles from your pickup address
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">Move this order along</h2>
        <OrderActions
          orderId={order.id}
          status={order.status as OrderStatus}
          fulfillment={order.fulfillment_type as FulfillmentType}
        />
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">Status</h2>
        <OrderStatusTimeline
          status={order.status as OrderStatus}
          fulfillment={order.fulfillment_type as FulfillmentType}
          history={order.history}
        />
      </section>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
