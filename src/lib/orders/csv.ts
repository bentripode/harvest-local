/**
 * Order → CSV for the seller's "Export CSV" download. Pure; the route handler
 * (`/seller/orders/export`) does the RLS-scoped read and maps rows into `OrderCsvRow`.
 */

export interface OrderCsvRow {
  id: string;
  createdAt: string;
  status: string;
  fulfillmentType: string;
  itemCount: number;
  subtotal: string;
  discountTotal: string;
  deliveryFee: string;
  taxTotal: string;
  total: string;
  buyerName: string | null;
  buyerState: string;
  deliveryAddress: string | null;
}

const HEADERS = [
  "Order ID",
  "Date",
  "Status",
  "Fulfillment",
  "Items",
  "Subtotal",
  "Discount",
  "Delivery fee",
  "Tax",
  "Total",
  "Buyer",
  "Buyer state",
  "Delivery address",
] as const;

/** RFC-4180-ish: quote a field that contains a comma, quote, or newline; double inner quotes. */
export function csvField(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(values: readonly unknown[]): string {
  return values.map(csvField).join(",");
}

export function ordersToCsv(rows: OrderCsvRow[]): string {
  const lines = [row(HEADERS)];
  for (const o of rows) {
    lines.push(
      row([
        o.id,
        o.createdAt.slice(0, 10),
        o.status,
        o.fulfillmentType,
        o.itemCount,
        o.subtotal,
        o.discountTotal,
        o.deliveryFee,
        o.taxTotal,
        o.total,
        o.buyerName ?? "",
        o.buyerState,
        o.deliveryAddress ?? "",
      ]),
    );
  }
  // Trailing newline — some tools expect one.
  return lines.join("\r\n") + "\r\n";
}
