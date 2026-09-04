import { afterAll, beforeAll, expect, it } from "vitest";

import {
  adminDb,
  anonDb,
  cleanupAll,
  createOrder,
  createSeller,
  createTestUser,
  describeDb,
  type TestUser,
} from "./helpers";

/**
 * RLS + the column guards. "A new table is not done until it has row-level security policies"
 * (CLAUDE.md) — these assert the ones that protect money, roles, and platform-owned columns.
 */
describeDb("row-level security", () => {
  let buyerA: TestUser;
  let buyerB: TestUser;
  let sellerUser: TestUser;
  let pausedSellerUser: TestUser;
  let seller: { id: string };
  let orderA: { id: string };

  beforeAll(async () => {
    buyerA = await createTestUser({ homeState: "TX" });
    buyerB = await createTestUser({ homeState: "TX" });
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    pausedSellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
    orderA = await createOrder({ buyerId: buyerA.id, sellerId: seller.id, buyerState: "TX" });
  });

  afterAll(cleanupAll);

  it("a logged-out visitor reads no orders", async () => {
    const { data } = await anonDb().from("orders").select("id").eq("id", orderA.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("a buyer reads their own order", async () => {
    const { data } = await buyerA.db.from("orders").select("id").eq("id", orderA.id);
    expect(data).toHaveLength(1);
  });

  it("a buyer cannot read another buyer's order", async () => {
    const { data } = await buyerB.db.from("orders").select("id").eq("id", orderA.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("the order's seller can read it", async () => {
    const { data } = await sellerUser.db.from("orders").select("id").eq("id", orderA.id);
    expect(data).toHaveLength(1);
  });

  it("a client cannot write an order directly", async () => {
    const { error } = await buyerA.db.from("orders").insert({
      buyer_id: buyerA.id,
      seller_id: seller.id,
      status: "pending_payment",
      fulfillment_type: "pickup",
      subtotal: "1.00",
      total: "1.00",
      buyer_state: "TX",
      seller_state: "TX",
    });
    expect(error).not.toBeNull();
  });

  it("profiles_guard_role blocks a user promoting themselves", async () => {
    const { error } = await buyerA.db
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", buyerA.id);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/role changes are not permitted/i);
  });

  it("a user can still update their own non-protected profile fields", async () => {
    const { error } = await buyerA.db
      .from("profiles")
      .update({ display_name: "Renamed" })
      .eq("id", buyerA.id);
    expect(error).toBeNull();
  });

  it("seller_profiles_guard_columns blocks a seller un-pausing themselves", async () => {
    // Must actually CHANGE the column — `is distinct from` makes a same-value write a no-op, so the
    // fixture is paused first (createSeller defaults to live so checkout guards pass).
    const paused = await createSeller(pausedSellerUser.id, { homeState: "TX", isPaused: true });

    const { error } = await pausedSellerUser.db
      .from("seller_profiles")
      .update({ is_paused: false })
      .eq("id", paused.id);

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/protected seller_profiles columns/i);

    // And it really is still paused.
    const { data } = await adminDb()
      .from("seller_profiles")
      .select("is_paused")
      .eq("id", paused.id)
      .single();
    expect(data?.is_paused).toBe(true);
  });

  it("a seller can still update their own delivery settings", async () => {
    const { error } = await sellerUser.db
      .from("seller_profiles")
      .update({ delivery_base_fee: 3.5 })
      .eq("id", seller.id);
    expect(error).toBeNull();

    // Read back — an RLS-filtered update returns no error but changes nothing, so assert the value.
    const { data } = await adminDb()
      .from("seller_profiles")
      .select("delivery_base_fee")
      .eq("id", seller.id)
      .single();
    expect(Number(data?.delivery_base_fee)).toBe(3.5);
  });

  it("check_rate_limit is not reachable by an authenticated client", async () => {
    const { error } = await buyerA.db.rpc("check_rate_limit", {
      p_key: "it-probe",
      p_max: 1,
      p_window_secs: 60,
    });
    expect(error).not.toBeNull();
  });
});
