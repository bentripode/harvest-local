import { afterAll, beforeAll, expect, it } from "vitest";

import {
  adminDb,
  addOrderItem,
  cleanupAll,
  completeOrder,
  createOrder,
  createProduct,
  createSeller,
  createTestUser,
  describeDb,
  type Db,
} from "./helpers";

/**
 * Sales caps that aren't annual totals (`20260904230000_cap_variants.sql`).
 *
 * Colorado caps $10,000 PER PRODUCT, Virginia caps only acidified foods at $3,000, and Minnesota
 * and Vermont use thresholds that require a LICENCE rather than stopping sales. All three break the
 * single-annual-number assumption `record_order_revenue` was built on.
 */
describeDb("revenue cap variants", () => {
  let admin: Db;
  /** Shared across every sale — creating an auth user per order rate-limits the auth API. */
  let buyerByState: Map<string, string>;

  async function buyerIn(state: string): Promise<string> {
    const existing = buyerByState.get(state);
    if (existing) return existing;
    const buyer = await createTestUser({ homeState: state });
    buyerByState.set(state, buyer.id);
    return buyer.id;
  }

  async function sellerOn(state: string, programName: string) {
    const user = await createTestUser({ role: "seller", homeState: state });
    const seller = await createSeller(user.id, { homeState: state });
    const { data: program } = await admin
      .from("state_food_programs")
      .select("id")
      .eq("state_code", state)
      .eq("name", programName)
      .single();
    await admin
      .from("seller_profiles")
      .update({ food_program_id: program!.id })
      .eq("id", seller.id);
    return { sellerId: seller.id, buyerState: state };
  }

  /** One completed order for `total`, recorded through the real function. */
  async function sell(
    sellerId: string,
    state: string,
    product: { id: string; title: string },
    total: string,
  ) {
    const order = await createOrder({
      buyerId: await buyerIn(state),
      sellerId,
      buyerState: state,
      status: "new",
      subtotal: total,
      total,
    });
    await addOrderItem(order.id, product, { quantity: 1, unitPrice: total });
    await completeOrder(order.id);
    const { data, error } = await admin.rpc("record_order_revenue", { p_order_id: order.id });
    if (error) throw new Error(error.message);
    return data;
  }

  async function buckets(sellerId: string) {
    const { data } = await admin
      .from("seller_revenue_buckets")
      .select("basis, bucket_key, gross_revenue, is_over_cap")
      .eq("seller_id", sellerId);
    return data ?? [];
  }

  async function isPaused(sellerId: string) {
    const { data } = await admin
      .from("seller_profiles")
      .select("is_paused, pause_reason")
      .eq("id", sellerId)
      .single();
    return data!;
  }

  beforeAll(() => {
    admin = adminDb();
    buyerByState = new Map();
  });

  afterAll(cleanupAll);

  // -- annual total, the common case, unchanged ------------------------------
  it("still counts an annual cap the way it always did", async () => {
    const { sellerId } = await sellerOn("TX", "Cottage Food"); // TX: $150,000 a year
    const product = await createProduct(sellerId, { price: "100.00" });
    const result = await sell(sellerId, "TX", product, "100.00");
    expect(Number(result?.[0]?.gross)).toBe(100);
    expect(Number(result?.[0]?.cap)).toBe(150000);
    expect(result?.[0]?.over).toBe(false);
    expect(await buckets(sellerId)).toHaveLength(0);
  });

  // -- per product -----------------------------------------------------------
  it("tallies Colorado per product, not overall", async () => {
    const { sellerId } = await sellerOn("CO", "Cottage Foods Act"); // $10,000 per product
    const bread = await createProduct(sellerId, { price: "6000.00" });
    const jam = await createProduct(sellerId, { price: "6000.00" });

    await sell(sellerId, "CO", bread, "6000.00");
    await sell(sellerId, "CO", jam, "6000.00");

    const rows = await buckets(sellerId);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.basis === "per_product")).toBe(true);
    // $12,000 in total, but neither product is over its own $10,000 cap.
    expect(rows.every((r) => !r.is_over_cap)).toBe(true);
    // Test sellers hold no verified documents, so they are paused for that — but not for revenue.
    expect((await isPaused(sellerId)).pause_reason).not.toBe("revenue_cap");
  });

  it("pauses when a single product crosses its own cap", async () => {
    const { sellerId } = await sellerOn("CO", "Cottage Foods Act");
    const bread = await createProduct(sellerId, { price: "11000.00" });

    await sell(sellerId, "CO", bread, "11000.00");

    const rows = await buckets(sellerId);
    expect(rows.some((r) => r.is_over_cap)).toBe(true);
    expect(await isPaused(sellerId)).toMatchObject({
      is_paused: true,
      pause_reason: "revenue_cap",
    });
  });

  // -- per category ----------------------------------------------------------
  it("caps only the category Virginia actually caps", async () => {
    // The per-category cap belongs to Home Kitchen Exemptions, which also bans online orders — so
    // the listings have to exist before the program is assigned, exactly as they would for a
    // seller who switched programs after listing.
    const user = await createTestUser({ role: "seller", homeState: "VA" });
    const seller = await createSeller(user.id, { homeState: "VA" });

    const ids = Object.fromEntries(
      (
        await admin
          .from("categories")
          .select("id, slug")
          .in("slug", ["pantry-pickles-ferments", "baked-goods"])
      ).data!.map((c) => [c.slug, c.id]),
    );

    const pickleJar = await createProduct(seller.id, { price: "100.00" });
    await admin
      .from("products")
      .update({ category_id: ids["pantry-pickles-ferments"], status: "draft" })
      .eq("id", pickleJar.id);
    const loaf = await createProduct(seller.id, { price: "100.00" });
    await admin
      .from("products")
      .update({ category_id: ids["baked-goods"], status: "draft" })
      .eq("id", loaf.id);

    const { data: program } = await admin
      .from("state_food_programs")
      .select("id, cap_basis, cap_category")
      .eq("state_code", "VA")
      .eq("name", "Home Kitchen Exemptions")
      .single();
    expect(program?.cap_basis).toBe("per_category");
    expect(program?.cap_category).toBe("acidified");

    await admin
      .from("seller_profiles")
      .update({ food_program_id: program!.id })
      .eq("id", seller.id);

    await sell(seller.id, "VA", pickleJar, "100.00");
    await sell(seller.id, "VA", loaf, "100.00");

    const rows = await buckets(seller.id);
    // Only the capped axis is tallied; baked goods are uncapped and get no bucket at all.
    expect(rows.map((r) => r.bucket_key).sort()).toEqual(["acidified"]);
  });

  // -- licensing threshold ---------------------------------------------------
  it("records a licensing threshold crossing without pausing anyone", async () => {
    const { sellerId } = await sellerOn("MN", "Cottage Food"); // $7,665 triggers registration
    const product = await createProduct(sellerId, { price: "8000.00" });

    await sell(sellerId, "MN", product, "8000.00");

    const { data } = await admin
      .from("seller_revenue_tracking")
      .select("license_threshold_crossed_at, is_over_cap")
      .eq("seller_id", sellerId)
      .single();
    expect(data?.license_threshold_crossed_at).not.toBeNull();
    // $8,000 is past the registration threshold but nowhere near Minnesota's $78,000 cap.
    expect(data?.is_over_cap).toBe(false);
    expect((await isPaused(sellerId)).pause_reason).not.toBe("revenue_cap");
  });

  it("records the crossing once, not on every later sale", async () => {
    const { sellerId } = await sellerOn("MN", "Cottage Food");
    const product = await createProduct(sellerId, { price: "8000.00" });

    await sell(sellerId, "MN", product, "8000.00");
    const { data: first } = await admin
      .from("seller_revenue_tracking")
      .select("license_threshold_crossed_at")
      .eq("seller_id", sellerId)
      .single();

    await sell(sellerId, "MN", product, "1000.00");
    const { data: second } = await admin
      .from("seller_revenue_tracking")
      .select("license_threshold_crossed_at")
      .eq("seller_id", sellerId)
      .single();

    expect(second?.license_threshold_crossed_at).toBe(first?.license_threshold_crossed_at);
  });

  // -- unchanged guarantees --------------------------------------------------
  it("is still idempotent — a redelivered order is not counted twice", async () => {
    const { sellerId } = await sellerOn("TX", "Cottage Food");
    const product = await createProduct(sellerId, { price: "50.00" });

    const order = await createOrder({
      buyerId: await buyerIn("TX"),
      sellerId,
      buyerState: "TX",
      status: "new",
      subtotal: "50.00",
      total: "50.00",
    });
    await addOrderItem(order.id, product, { quantity: 1, unitPrice: "50.00" });
    await completeOrder(order.id);

    await admin.rpc("record_order_revenue", { p_order_id: order.id });
    const { data: again } = await admin.rpc("record_order_revenue", { p_order_id: order.id });
    expect(Number(again?.[0]?.gross)).toBe(50);
  });

  it("a seller can read their own buckets and no one else's", async () => {
    const { sellerId } = await sellerOn("CO", "Cottage Foods Act");
    const product = await createProduct(sellerId, { price: "100.00" });
    await sell(sellerId, "CO", product, "100.00");

    const stranger = await createTestUser({ role: "seller", homeState: "CO" });
    const { data } = await stranger.db
      .from("seller_revenue_buckets")
      .select("id")
      .eq("seller_id", sellerId);
    expect(data ?? []).toHaveLength(0);
  });
});
