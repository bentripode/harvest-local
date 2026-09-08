import { afterAll, beforeAll, expect, it } from "vitest";

import {
  adminDb,
  anonDb,
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

/**
 * The marketplace is public, so a signed-out reader is the storefront's main audience — and
 * `profiles` is owner-read-only, so the reviewer's name has to travel on the review itself
 * (20260908120000_public_review_names.sql).
 */
describeDb("reviews.reviewer_name", () => {
  let buyer: TestUser;
  let sellerUser: TestUser;
  let seller: { id: string };
  const displayName = "Cynthia Marchetti";

  beforeAll(async () => {
    buyer = await createTestUser({ homeState: "TX", displayName });
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
  });

  afterAll(cleanupAll);

  async function reviewFromBuyer(rating: number) {
    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "new",
    });
    await completeOrder(order.id);
    const { data, error } = await buyer.db
      .from("reviews")
      .insert({ order_id: order.id, reviewer_id: buyer.id, seller_id: seller.id, rating })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  it("captures the reviewer's display name on insert, ignoring what the client sent", async () => {
    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "new",
    });
    await completeOrder(order.id);

    const { data, error } = await buyer.db
      .from("reviews")
      .insert({
        order_id: order.id,
        reviewer_id: buyer.id,
        seller_id: seller.id,
        rating: 5,
        reviewer_name: "Someone Else Entirely",
      })
      .select("reviewer_name")
      .single();

    expect(error).toBeNull();
    expect(data!.reviewer_name).toBe(displayName);
  });

  it("is readable by a signed-out visitor — the whole point of the snapshot", async () => {
    const id = await reviewFromBuyer(4);

    const { data, error } = await anonDb()
      .from("reviews")
      .select("reviewer_name, reviewer:profiles!reviews_reviewer_id_fkey(display_name)")
      .eq("id", id)
      .single();

    expect(error).toBeNull();
    expect(data!.reviewer_name).toBe(displayName);
    // The join is exactly what anon cannot see; that is why the column exists.
    expect(data!.reviewer).toBeNull();
  });

  it("cannot be rewritten by the seller through the response policy", async () => {
    const id = await reviewFromBuyer(3);

    const { error } = await sellerUser.db
      .from("reviews")
      .update({ reviewer_name: "A Nicer Name" })
      .eq("id", id);

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/only a review's response may be edited/i);
  });
});
