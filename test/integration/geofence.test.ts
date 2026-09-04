import { afterAll, beforeAll, expect, it } from "vitest";

import {
  adminDb,
  cleanupAll,
  createOrder,
  createSeller,
  createTestUser,
  describeDb,
  type TestUser,
} from "./helpers";

/**
 * CLAUDE.md rule 1, layer 1: `orders_same_state_only`. A cross-state order must be impossible at the
 * DATA layer — the service role (which bypasses RLS) must not be able to write one either.
 */
describeDb("orders_same_state_only CHECK", () => {
  let buyer: TestUser;
  let seller: { id: string; homeState: string };

  beforeAll(async () => {
    buyer = await createTestUser({ homeState: "TX" });
    const sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
  });

  afterAll(cleanupAll);

  it("accepts an in-state order", async () => {
    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      sellerState: "TX",
    });
    expect(order.id).toBeTruthy();
  });

  it("rejects a cross-state order even from the service role", async () => {
    const { error } = await adminDb()
      .from("orders")
      .insert({
        buyer_id: buyer.id,
        seller_id: seller.id,
        status: "pending_payment",
        fulfillment_type: "pickup",
        subtotal: "10.00",
        total: "10.00",
        buyer_state: "CA",
        seller_state: "TX",
      })
      .select("id");

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/orders_same_state_only|violates check constraint/i);
  });

  it("rejects an UPDATE that would make an existing order cross-state", async () => {
    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      sellerState: "TX",
    });

    const { error } = await adminDb()
      .from("orders")
      .update({ buyer_state: "CA" })
      .eq("id", order.id);

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/orders_same_state_only|violates check constraint/i);
  });
});
