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
 * `per_product` and `per_category` bases, and licensing thresholds that require a LICENCE rather
 * than stopping sales, all break the single-annual-number assumption `record_order_revenue` was
 * built on.
 *
 * These tests used to lean on the seeded rows for Colorado, Virginia and Minnesota. They no longer
 * can: verifying those states against their own statutes (2026-09-05) found Colorado on a single
 * $150,000 annual cap with no per-product figure in the current law, Virginia on a $9,000 annual
 * figure rather than a $3,000 acidified-only one, and Minnesota's seeded $7,665 threshold absent
 * from Minn. Stat. 28A.152 altogether. **No real state now uses `per_product` or `per_category`.**
 *
 * That is exactly why these tests build their own programme rows instead. The machinery is correct
 * and still reachable the moment a verified state turns out to need it, so it stays pinned — but
 * pinned to the behaviour, not to a claim about any particular state's law. A test that asserts
 * what Colorado's cap is belongs in a compliance-data review, not in a test of SQL.
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

  /** Programme rows this file created, torn down in afterAll. */
  let fixturePrograms: string[];
  /** `unique (state_code, ordinal)` — start well clear of the seeded ordinals. */
  let nextOrdinal: number;

  /**
   * A seller on a programme this test owns.
   *
   * Deliberately not a seeded row: the cap basis under test is a property of the SQL, and tying it
   * to whichever state currently happens to carry that basis is what broke this file when the
   * compliance data was corrected against the statutes.
   */
  async function sellerOnFixture(
    state: string,
    program: {
      cap_basis: string;
      // numeric columns: PostgREST takes and returns these as strings.
      revenue_cap?: string | null;
      cap_category?: string | null;
      license_threshold?: string | null;
    },
  ) {
    const user = await createTestUser({ role: "seller", homeState: state });
    const seller = await createSeller(user.id, { homeState: state });

    const ordinal = nextOrdinal++;
    const { data, error } = await admin
      .from("state_food_programs")
      .insert({
        state_code: state,
        ordinal,
        name: `IT fixture ${ordinal}`,
        revenue_cap: program.revenue_cap ?? null,
        cap_basis: program.cap_basis,
        cap_category: program.cap_category ?? null,
        license_threshold: program.license_threshold ?? null,
        // Invented, and labelled as such — this row is a test fixture, not a claim about the law.
        source_url: "https://example.invalid/integration-test-fixture",
        source_checked_at: "2026-01-01",
      })
      .select("id")
      .single();
    if (error) throw new Error(`fixture programme: ${error.message}`);
    fixturePrograms.push(data!.id);

    await admin
      .from("seller_profiles")
      .update({ food_program_id: data!.id })
      .eq("id", seller.id);
    return { sellerId: seller.id, programId: data!.id };
  }

  beforeAll(() => {
    admin = adminDb();
    buyerByState = new Map();
    fixturePrograms = [];
    nextOrdinal = 90;
  });

  afterAll(async () => {
    // Sellers reference the programme, so they have to go first.
    await cleanupAll();
    if (fixturePrograms.length > 0) {
      await admin.from("state_food_programs").delete().in("id", fixturePrograms);
    }
  });

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
  it("tallies a per-product cap product by product, not overall", async () => {
    const { sellerId } = await sellerOnFixture("CO", {
      cap_basis: "per_product",
      revenue_cap: "10000",
    });
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

  it("pauses when a single product crosses its own per-product cap", async () => {
    const { sellerId } = await sellerOnFixture("CO", {
      cap_basis: "per_product",
      revenue_cap: "10000",
    });
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
  it("caps only the category a per-category programme names", async () => {
    // The listings are created before the programme is assigned, exactly as they would be for a
    // seller who switched programmes after listing.
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

    const ordinal = nextOrdinal++;
    const { data: program, error: programError } = await admin
      .from("state_food_programs")
      .insert({
        state_code: "VA",
        ordinal,
        name: `IT fixture ${ordinal}`,
        cap_basis: "per_category",
        cap_category: "acidified",
        revenue_cap: "3000",
        source_url: "https://example.invalid/integration-test-fixture",
        source_checked_at: "2026-01-01",
      })
      .select("id")
      .single();
    if (programError) throw new Error(`fixture programme: ${programError.message}`);
    fixturePrograms.push(program!.id);

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
    // A threshold means "get a licence", not "stop selling" — so it is set here rather than taken
    // from Minnesota's seeded $7,665, a figure that does not appear in Minn. Stat. 28A.152.
    const { sellerId } = await sellerOnFixture("MN", {
      cap_basis: "annual_total",
      revenue_cap: "78000",
      license_threshold: "7665",
    });
    const product = await createProduct(sellerId, { price: "8000.00" });

    await sell(sellerId, "MN", product, "8000.00");

    const { data } = await admin
      .from("seller_revenue_tracking")
      .select("license_threshold_crossed_at, is_over_cap")
      .eq("seller_id", sellerId)
      .single();
    expect(data?.license_threshold_crossed_at).not.toBeNull();
    // $8,000 is past the threshold but nowhere near the $78,000 cap — crossing one is not the other.
    expect(data?.is_over_cap).toBe(false);
    expect((await isPaused(sellerId)).pause_reason).not.toBe("revenue_cap");
  });

  it("records the crossing once, not on every later sale", async () => {
    const { sellerId } = await sellerOnFixture("MN", {
      cap_basis: "annual_total",
      revenue_cap: "78000",
      license_threshold: "7665",
    });
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
    // Needs a basis that actually writes buckets, or the assertion passes vacuously.
    const { sellerId } = await sellerOnFixture("CO", {
      cap_basis: "per_product",
      revenue_cap: "10000",
    });
    const product = await createProduct(sellerId, { price: "100.00" });
    await sell(sellerId, "CO", product, "100.00");
    expect(await buckets(sellerId)).not.toHaveLength(0);

    const stranger = await createTestUser({ role: "seller", homeState: "CO" });
    const { data } = await stranger.db
      .from("seller_revenue_buckets")
      .select("id")
      .eq("seller_id", sellerId);
    expect(data ?? []).toHaveLength(0);
  });
});
