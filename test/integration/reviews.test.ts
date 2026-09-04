import { afterAll, beforeAll, expect, it } from "vitest";

import {
  adminDb,
  cleanupAll,
  completeOrder,
  createOrder,
  createSeller,
  createTestUser,
  describeDb,
  type TestUser,
} from "./helpers";

/**
 * CLAUDE.md rule 4: a review is insertable ONLY by the buyer of a `completed` order for that seller,
 * one per order. The `reviews_verify_buyer` BEFORE INSERT trigger fires for every insert — service
 * role included — and `reviews.order_id` is unique.
 */
describeDb("reviews_verify_buyer", () => {
  let buyer: TestUser;
  let stranger: TestUser;
  let seller: { id: string };

  beforeAll(async () => {
    buyer = await createTestUser({ homeState: "TX" });
    stranger = await createTestUser({ homeState: "TX" });
    const sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
  });

  afterAll(cleanupAll);

  it("rejects a review on an order that isn't completed — even from the service role", async () => {
    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "new",
    });

    const { error } = await adminDb().from("reviews").insert({
      order_id: order.id,
      reviewer_id: buyer.id,
      seller_id: seller.id,
      rating: 5,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/completed order by this buyer/i);
  });

  it("accepts one review from the buyer of a completed order, then rejects a second", async () => {
    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "new",
    });
    await completeOrder(order.id);

    const first = await buyer.db.from("reviews").insert({
      order_id: order.id,
      reviewer_id: buyer.id,
      seller_id: seller.id,
      rating: 5,
      body: "Great bread.",
    });
    expect(first.error).toBeNull();

    const second = await buyer.db.from("reviews").insert({
      order_id: order.id,
      reviewer_id: buyer.id,
      seller_id: seller.id,
      rating: 1,
    });
    expect(second.error).not.toBeNull();
    expect(second.error!.message).toMatch(/duplicate key|unique/i);
  });

  it("rejects a review from someone who isn't the order's buyer", async () => {
    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "new",
    });
    await completeOrder(order.id);

    // Service role, so RLS is out of the picture — the trigger is what must refuse.
    const { error } = await adminDb().from("reviews").insert({
      order_id: order.id,
      reviewer_id: stranger.id,
      seller_id: seller.id,
      rating: 5,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/completed order by this buyer/i);
  });

  it("rolls the rating up onto seller_profiles.avg_rating", async () => {
    const orderA = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "new",
    });
    await completeOrder(orderA.id);
    await buyer.db.from("reviews").insert({
      order_id: orderA.id,
      reviewer_id: buyer.id,
      seller_id: seller.id,
      rating: 3,
    });

    const { data } = await adminDb()
      .from("seller_profiles")
      .select("avg_rating")
      .eq("id", seller.id)
      .single();
    expect(data?.avg_rating).not.toBeNull();
  });
});
