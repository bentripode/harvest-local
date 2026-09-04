import { getSellerContext } from "@/lib/auth";
import { getSellerOrders } from "@/lib/orders/queries";
import { ordersToCsv, type OrderCsvRow } from "@/lib/orders/csv";

/**
 * `GET /seller/orders/export` — the seller's orders as a CSV download. The read runs as the
 * signed-in seller, so RLS is what scopes it; this only formats and sets the download headers.
 */
export async function GET() {
  const { profile, seller, onboardingComplete } = await getSellerContext();
  if (profile.role === "buyer" || !seller || !onboardingComplete) {
    return new Response("Not authorized.", { status: 403 });
  }

  const orders = await getSellerOrders(seller.id);
  const rows: OrderCsvRow[] = orders.map((o) => ({
    id: o.id,
    createdAt: o.created_at,
    status: o.status,
    fulfillmentType: o.fulfillment_type,
    itemCount: o.item_count?.[0]?.count ?? 0,
    subtotal: o.subtotal,
    discountTotal: o.discount_total,
    deliveryFee: o.delivery_fee,
    taxTotal: o.tax_total,
    total: o.total,
    buyerName: o.buyer?.display_name ?? null,
    buyerState: o.buyer_state,
    deliveryAddress: o.delivery_address_text ?? null,
  }));

  const date = new Date().toISOString().slice(0, 10);
  return new Response(ordersToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="harvest-orders-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
