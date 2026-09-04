import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { OrderStatusTimeline } from "@/components/order-status-timeline";
import { ClearCartOnMount } from "@/components/clear-cart-on-mount";
import { ReviewForm, ExistingReview } from "@/components/review-form";
import { MessageSellerButton } from "@/components/message-seller-button";
import { ReportOrderForm, ExistingReport } from "@/components/report-order-form";
import { requireUser } from "@/lib/auth";
import { getOrder } from "@/lib/orders/queries";
import { getReviewForOrder } from "@/lib/reviews/queries";
import { getReportForOrder } from "@/lib/reports/queries";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status";
import { formatUsd, toCents } from "@/lib/money";
import { stateName } from "@/lib/geo/state";
import type { FulfillmentType, OrderStatus } from "@/lib/db/types";

export default async function BuyerOrderPage({
  params,
  searchParams,
}: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { user } = await requireUser(`/orders/${id}`);

  const order = await getOrder(id);
  if (!order || order.buyer?.id !== user.id) notFound();

  const review = order.status === "completed" ? await getReviewForOrder(id) : null;
  const report =
    order.status !== "pending_payment" ? await getReportForOrder(id, user.id) : null;

  const checkout = typeof sp.checkout === "string" ? sp.checkout : null;
  const pending = order.status === "pending_payment";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {checkout === "success" && !pending ? <ClearCartOnMount /> : null}

      {checkout === "success" ? (
        <Banner tone={pending ? "amber" : "green"}>
          {pending
            ? "Thanks! We're confirming your payment with Stripe — this page updates once it clears."
            : "Payment received. Your order is confirmed."}
        </Banner>
      ) : checkout === "cancelled" ? (
        <Banner tone="amber">Checkout was cancelled. Your basket is still saved.</Banner>
      ) : checkout === "error" ? (
        <Banner tone="red">We couldn&apos;t start checkout for this order. Nothing was charged.</Banner>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {order.seller?.business_name ?? "Order"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Order {order.id.slice(0, 8)} ·{" "}
            {new Date(order.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })} ·{" "}
            {order.fulfillment_type === "delivery" ? "Delivery" : "Pickup"} ·{" "}
            {stateName(order.seller_state)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant={order.status === "completed" ? "default" : "secondary"}>
            {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
          </Badge>
          {!pending ? (
            <MessageSellerButton orderId={order.id} label="Message seller" variant="ghost" />
          ) : null}
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
          {order.refund ? (
            <Row
              label={
                toCents(order.refund.amount) < toCents(order.total) ? "Partially refunded" : "Refunded"
              }
              value={`− ${formatUsd(toCents(order.refund.amount))}`}
            />
          ) : null}
        </div>
      </section>

      {order.fulfillment_type === "delivery" && order.delivery_address_text ? (
        <section className="rounded-lg border p-4 text-sm">
          <h2 className="mb-1 font-medium">Delivery address</h2>
          <p className="text-muted-foreground">{order.delivery_address_text}</p>
        </section>
      ) : null}

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">Status</h2>
        <OrderStatusTimeline
          status={order.status as OrderStatus}
          fulfillment={order.fulfillment_type as FulfillmentType}
          history={order.history}
        />
      </section>

      {order.status === "completed" ? (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-medium">
            {review ? "Your review" : `Review ${order.seller?.business_name ?? "this seller"}`}
          </h2>
          {review ? (
            <ExistingReview orderId={order.id} review={review} />
          ) : (
            <ReviewForm orderId={order.id} />
          )}
        </section>
      ) : null}

      {order.status !== "pending_payment" ? (
        <section className="rounded-lg border p-4">
          {report ? <ExistingReport report={report} /> : <ReportOrderForm orderId={order.id} />}
        </section>
      ) : null}

      <Link href="/orders" className="text-muted-foreground text-sm hover:underline">
        ← All orders
      </Link>
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

function Banner({ tone, children }: { tone: "green" | "amber" | "red"; children: React.ReactNode }) {
  const cls = {
    green: "border-green-600/30 bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-200",
    amber: "border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    red: "border-destructive/30 bg-destructive/5 text-destructive",
  }[tone];
  return <p className={`rounded-md border p-3 text-sm ${cls}`}>{children}</p>;
}
