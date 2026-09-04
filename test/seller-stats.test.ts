import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  orders: [] as unknown[],
  order_items: [] as unknown[],
  seller_view_counts: [] as unknown[],
}));

vi.mock("@/lib/supabase/server", () => {
  type T = "orders" | "order_items" | "seller_view_counts";
  const builder = (table: T) => {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b,
      eq: () => b,
      neq: () => b,
      gte: () => b,
      then: (resolve: (r: unknown) => void) => resolve({ data: h[table], error: null }),
    });
    return b;
  };
  return { createClient: async () => ({ from: (t: T) => builder(t) }) };
});

import { getSellerDashboardStats, parseWindowDays } from "@/lib/analytics/queries";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function order(over: Record<string, unknown> = {}) {
  return {
    total: "10.00",
    discount_total: "0",
    delivery_fee: "0",
    fulfillment_type: "pickup",
    status: "completed",
    created_at: daysAgo(3),
    ...over,
  };
}

beforeEach(() => {
  h.orders = [];
  h.order_items = [];
  h.seller_view_counts = [];
});

describe("parseWindowDays", () => {
  it("accepts 30 / 90 / 365 and defaults everything else to 30", () => {
    expect(parseWindowDays("90")).toBe(90);
    expect(parseWindowDays(365)).toBe(365);
    expect(parseWindowDays("7")).toBe(30);
    expect(parseWindowDays(undefined)).toBe(30);
    expect(parseWindowDays("banana")).toBe(30);
  });
});

describe("getSellerDashboardStats", () => {
  it("splits completed revenue into the current window and the prior one", async () => {
    h.orders = [
      order({ total: "20.00", created_at: daysAgo(5) }), // current 30d
      order({ total: "8.00", created_at: daysAgo(40) }), // prior 30d
      order({ total: "99.00", created_at: daysAgo(200) }), // outside both
    ];

    const s = await getSellerDashboardStats("seller-1", 30);
    expect(s.windowDays).toBe(30);
    expect(s.current.revenueCents).toBe(2000);
    expect(s.current.orders).toBe(1);
    expect(s.prior.revenueCents).toBe(800);
    expect(s.current.aovCents).toBe(2000);
  });

  it("counts cancellations and pickup/delivery split, ignores non-completed revenue", async () => {
    h.orders = [
      order({ total: "10.00", fulfillment_type: "delivery", delivery_fee: "5.00" }),
      order({ total: "10.00", fulfillment_type: "pickup" }),
      order({ status: "cancelled", total: "10.00" }),
    ];
    const s = await getSellerDashboardStats("seller-1", 30);
    expect(s.current.orders).toBe(2);
    expect(s.current.deliveryOrders).toBe(1);
    expect(s.current.pickupOrders).toBe(1);
    expect(s.current.cancelled).toBe(1);
    expect(s.current.deliveryRevenueCents).toBe(500);
  });

  it("computes conversion from storefront views", async () => {
    h.orders = [order(), order()];
    h.seller_view_counts = [{ views: 8 }, { views: 2 }];
    const s = await getSellerDashboardStats("seller-1", 30);
    expect(s.current.views).toBe(10);
    expect(s.current.conversionPct).toBe(20);
  });

  it("buckets the revenue series: daily for 30/90, weekly for a year", async () => {
    expect((await getSellerDashboardStats("s", 30)).series).toHaveLength(30);
    expect((await getSellerDashboardStats("s", 90)).series).toHaveLength(90);
    expect((await getSellerDashboardStats("s", 365)).series).toHaveLength(Math.ceil(365 / 7));
  });

  it("aggregates top products from order_items", async () => {
    h.orders = [order()];
    h.order_items = [
      { title_snapshot: "Sourdough", quantity: 2, line_total: "12.00" },
      { title_snapshot: "Sourdough", quantity: 1, line_total: "6.00" },
      { title_snapshot: "Baguette", quantity: 4, line_total: "16.00" },
    ];
    const s = await getSellerDashboardStats("seller-1", 30);
    expect(s.topProducts[0]).toEqual({ title: "Sourdough", units: 3, revenueCents: 1800 });
    expect(s.topProducts[1]).toEqual({ title: "Baguette", units: 4, revenueCents: 1600 });
  });

  it("hasData is false with nothing to show", async () => {
    expect((await getSellerDashboardStats("seller-1", 30)).hasData).toBe(false);
  });
});
