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
 * `advance_order_status` (SECURITY DEFINER) is the only way a seller moves an order along. It must
 * enforce ownership and the legal transition map, and every transition must land in
 * `order_status_history` via the trigger.
 */
describeDb("advance_order_status", () => {
  let buyer: TestUser;
  let sellerUser: TestUser;
  let outsider: TestUser;
  let seller: { id: string };

  beforeAll(async () => {
    buyer = await createTestUser({ homeState: "TX" });
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    outsider = await createTestUser({ role: "seller", homeState: "TX" });
    await createSeller(outsider.id, { homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
  });

  afterAll(cleanupAll);

  async function newOrder(status: "new" | "preparing" | "ready" | "completed" = "new") {
    return createOrder({ buyerId: buyer.id, sellerId: seller.id, buyerState: "TX", status });
  }

  it("lets the owning seller make a legal transition and logs it", async () => {
    const order = await newOrder("new");

    const { error } = await sellerUser.db.rpc("advance_order_status", {
      p_order_id: order.id,
      p_to_status: "preparing",
      p_note: "starting",
    });
    expect(error).toBeNull();

    const { data: row } = await adminDb()
      .from("orders")
      .select("status")
      .eq("id", order.id)
      .single();
    expect(row?.status).toBe("preparing");

    const { data: history } = await adminDb()
      .from("order_status_history")
      .select("from_status, to_status, changed_by, note")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1);
    expect(history?.[0]).toMatchObject({
      from_status: "new",
      to_status: "preparing",
      changed_by: sellerUser.id,
      note: "starting",
    });
  });

  it("rejects an illegal transition", async () => {
    const order = await newOrder("new");
    const { error } = await sellerUser.db.rpc("advance_order_status", {
      p_order_id: order.id,
      p_to_status: "completed", // new -> completed is not allowed
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/illegal order transition/i);
  });

  /** Asserts the caller neither got a success nor actually moved the order. */
  async function expectRefused(db: TestUser["db"], orderId: string) {
    const { error } = await db.rpc("advance_order_status", {
      p_order_id: orderId,
      p_to_status: "preparing",
    });
    const { data: after } = await adminDb()
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();

    // The status must not have moved, whichever layer refuses.
    expect(after?.status).toBe("new");
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not authorized/i);
  }

  it("rejects a seller who doesn't own the order", async () => {
    const order = await newOrder("new");
    await expectRefused(outsider.db, order.id);
  });

  it("rejects the buyer", async () => {
    const order = await newOrder("new");
    await expectRefused(buyer.db, order.id);
  });

  it("allows no transitions out of a terminal state", async () => {
    const order = await newOrder("completed");
    const { error } = await sellerUser.db.rpc("advance_order_status", {
      p_order_id: order.id,
      p_to_status: "preparing",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/illegal order transition/i);
  });

  it("skips out_for_delivery for a pickup order (ready -> completed)", async () => {
    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "ready",
      fulfillmentType: "pickup",
    });
    const bad = await sellerUser.db.rpc("advance_order_status", {
      p_order_id: order.id,
      p_to_status: "out_for_delivery",
    });
    expect(bad.error).not.toBeNull();

    const good = await sellerUser.db.rpc("advance_order_status", {
      p_order_id: order.id,
      p_to_status: "completed",
    });
    expect(good.error).toBeNull();
  });
});
