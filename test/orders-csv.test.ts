import { describe, expect, it } from "vitest";

import { csvField, ordersToCsv, type OrderCsvRow } from "@/lib/orders/csv";

describe("csvField", () => {
  it("leaves a plain value alone", () => {
    expect(csvField("preparing")).toBe("preparing");
    expect(csvField(3)).toBe("3");
    expect(csvField(null)).toBe("");
  });

  it("quotes and escapes commas, quotes, and newlines", () => {
    expect(csvField("Austin, TX")).toBe('"Austin, TX"');
    expect(csvField('the "good" stuff')).toBe('"the ""good"" stuff"');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("ordersToCsv", () => {
  const base: OrderCsvRow = {
    id: "ord-1",
    createdAt: "2026-09-04T12:30:00Z",
    status: "completed",
    fulfillmentType: "delivery",
    itemCount: 2,
    subtotal: "20.00",
    discountTotal: "2.00",
    deliveryFee: "5.00",
    taxTotal: "1.49",
    total: "24.49",
    buyerName: "Tex Buyer",
    buyerState: "TX",
    deliveryAddress: "1 Main St, Austin, TX 78701",
  };

  it("writes a header plus one line per order, date-only", () => {
    const csv = ordersToCsv([base]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Order ID,Date,Status,/);
    expect(lines[1]).toBe(
      'ord-1,2026-09-04,completed,delivery,2,20.00,2.00,5.00,1.49,24.49,Tex Buyer,TX,"1 Main St, Austin, TX 78701"',
    );
  });

  it("is just the header for no orders, with a trailing CRLF", () => {
    const csv = ordersToCsv([]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.trimEnd().split("\r\n")).toHaveLength(1);
  });

  it("handles a missing buyer name / address", () => {
    const csv = ordersToCsv([{ ...base, buyerName: null, deliveryAddress: null }]);
    expect(csv.trimEnd().split("\r\n")[1]).toContain("completed,delivery,2,20.00,2.00,5.00,1.49,24.49,,TX,");
  });
});
