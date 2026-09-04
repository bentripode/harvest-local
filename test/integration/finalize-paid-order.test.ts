import { afterAll, beforeAll, expect, it } from "vitest";

import {
  addOrderItem,
  adminDb,
  cleanupAll,
  createOrder,
  createProduct,
  createSeller,
  createTestUser,
  describeDb,
  type TestUser,
} from "./helpers";

/**
 * CLAUDE.md rule 2: the Stripe webhook's single mutation point must be idempotent. Stripe redelivers,
 * so `finalize_paid_order` is guarded on `status = 'pending_payment'` — the second call has to be a
 * clean no-op, not a double stock decrement.
 */
describeDb("finalize_paid_order", () => {
  let buyer: TestUser;
  let seller: { id: string };
  let product: { id: string; title: string };

  beforeAll(async () => {
    buyer = await createTestUser({ homeState: "TX" });
    const sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
    product = await createProduct(seller.id, { quantity: 10, price: "10.00" });
  });

  afterAll(cleanupAll);

  it("moves the order to `new`, finalises the money snapshot, and decrements stock", async () => {
    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "pending_payment",
      subtotal: "20.00",
      total: "20.00",
    });
    await addOrderItem(order.id, product, { quantity: 2, unitPrice: "10.00" });

    const before = await adminDb()
      .from("products")
      .select("quantity_available")
      .eq("id", product.id)
      .single();

    const { data: applied, error } = await adminDb().rpc("finalize_paid_order", {
      p_order_id: order.id,
      p_payment_intent_id: `pi_it_${order.id.slice(0, 8)}`,
      p_discount_total: "0.00",
      p_tax_total: "1.65",
      p_total: "21.65",
    });
    expect(error).toBeNull();
    expect(applied).toBe(true);

    const { data: row } = await adminDb()
      .from("orders")
      .select("status, tax_total, total, stripe_payment_intent_id")
      .eq("id", order.id)
      .single();
    expect(row?.status).toBe("new");
    expect(Number(row?.tax_total)).toBe(1.65);
    expect(Number(row?.total)).toBe(21.65);
    expect(row?.stripe_payment_intent_id).toContain("pi_it_");

    const after = await adminDb()
      .from("products")
      .select("quantity_available")
      .eq("id", product.id)
      .single();
    expect(after.data!.quantity_available).toBe(before.data!.quantity_available! - 2);
  });

  it("is a no-op on redelivery — no second stock decrement", async () => {
    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "pending_payment",
    });
    await addOrderItem(order.id, product, { quantity: 1 });

    const args = {
      p_order_id: order.id,
      p_payment_intent_id: `pi_it_dup_${order.id.slice(0, 8)}`,
      p_discount_total: "0.00",
      p_tax_total: "0.80",
      p_total: "10.80",
    };

    const first = await adminDb().rpc("finalize_paid_order", args);
    expect(first.data).toBe(true);

    const mid = await adminDb()
      .from("products")
      .select("quantity_available")
      .eq("id", product.id)
      .single();

    const second = await adminDb().rpc("finalize_paid_order", args);
    expect(second.error).toBeNull();
    expect(second.data).toBe(false); // guarded on pending_payment

    const end = await adminDb()
      .from("products")
      .select("quantity_available")
      .eq("id", product.id)
      .single();
    expect(end.data!.quantity_available).toBe(mid.data!.quantity_available);
  });

  it("returns false for an unknown order", async () => {
    const { data, error } = await adminDb().rpc("finalize_paid_order", {
      p_order_id: "11111111-1111-4111-8111-111111111111",
      p_payment_intent_id: "pi_it_missing",
      p_discount_total: "0.00",
      p_tax_total: "0.00",
      p_total: "0.00",
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("is not callable by an authenticated user (service_role only)", async () => {
    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "pending_payment",
    });
    const { error } = await buyer.db.rpc("finalize_paid_order", {
      p_order_id: order.id,
      p_payment_intent_id: "pi_it_denied",
      p_discount_total: "0.00",
      p_tax_total: "0.00",
      p_total: "1.00",
    });
    expect(error).not.toBeNull();
  });
});
