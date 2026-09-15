import { afterAll, beforeAll, expect, it } from "vitest";

import {
  addOrderItem,
  adminDb,
  anonDb,
  cleanupAll,
  createOrder,
  createProduct,
  createSeller,
  createTestUser,
  describeDb,
  type TestUser,
} from "./helpers";

/**
 * Variants sit on the money path, so the cases that matter are the ones where the wrong unit gets
 * decremented or a listing ends up buyable with nothing to buy.
 */
describeDb("product_variants", () => {
  let sellerUser: TestUser;
  let otherUser: TestUser;
  let seller: { id: string };
  let product: { id: string; title: string };

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    otherUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
    await createSeller(otherUser.id, { homeState: "TX" });
    product = await createProduct(seller.id, { quantity: 10 });
  });

  afterAll(cleanupAll);

  it("lets the owning seller add options", async () => {
    const { error } = await sellerUser.db.from("product_variants").insert([
      { product_id: product.id, name: "Half loaf", price: "5.00", quantity_available: 4 },
      { product_id: product.id, name: "Whole loaf", price: "9.00", quantity_available: 6 },
    ]);
    expect(error).toBeNull();
  });

  it("refuses two options with the same name, however it is cased", async () => {
    const { error } = await sellerUser.db
      .from("product_variants")
      .insert({ product_id: product.id, name: "half LOAF", price: "5.00" });
    expect(error?.code).toBe("23505");
  });

  it("refuses a net weight with no unit", async () => {
    const { error } = await sellerUser.db.from("product_variants").insert({
      product_id: product.id,
      name: "Weightless",
      price: "1.00",
      net_weight_value: "4",
    });
    expect(error?.message).toMatch(/product_variants_net_weight_pair/i);
  });

  it("will not let another seller write options on this product", async () => {
    const { error } = await otherUser.db
      .from("product_variants")
      .insert({ product_id: product.id, name: "Not mine", price: "1.00" });
    expect(error).not.toBeNull();
  });

  it("is readable by a signed-out visitor while the listing is active", async () => {
    const { data } = await anonDb()
      .from("product_variants")
      .select("name")
      .eq("product_id", product.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("refuses to remove the last buyable option from a listed product", async () => {
    const solo = await createProduct(seller.id);
    const { data: v } = await sellerUser.db
      .from("product_variants")
      .insert({ product_id: solo.id, name: "Only one", price: "3.00" })
      .select("id")
      .single();

    const del = await sellerUser.db.from("product_variants").delete().eq("id", v!.id);
    expect(del.error?.message).toMatch(/at least one variant/i);

    const off = await sellerUser.db
      .from("product_variants")
      .update({ is_active: false })
      .eq("id", v!.id);
    expect(off.error?.message).toMatch(/at least one variant/i);
  });

  it("allows removing the last option once the listing is no longer active", async () => {
    const draft = await createProduct(seller.id);
    const { data: v } = await sellerUser.db
      .from("product_variants")
      .insert({ product_id: draft.id, name: "Only one", price: "3.00" })
      .select("id")
      .single();

    await adminDb().from("products").update({ status: "draft" }).eq("id", draft.id);

    const { error } = await sellerUser.db.from("product_variants").delete().eq("id", v!.id);
    expect(error).toBeNull();
  });
});

describeDb("finalize_paid_order — variant stock", () => {
  // orders.stripe_payment_intent_id is UNIQUE, so every finalize in this file needs its own.
  let n = 0;
  let buyer: TestUser;
  let sellerUser: TestUser;
  let seller: { id: string };

  beforeAll(async () => {
    buyer = await createTestUser({ homeState: "TX" });
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
  });

  afterAll(cleanupAll);

  it("decrements the variant that was bought and leaves the product's own stock alone", async () => {
    const product = await createProduct(seller.id, { quantity: 10 });
    const { data: variants } = await sellerUser.db
      .from("product_variants")
      .insert([
        { product_id: product.id, name: "Half", price: "5.00", quantity_available: 4 },
        { product_id: product.id, name: "Whole", price: "9.00", quantity_available: 6 },
      ])
      .select("id, name");

    const half = variants!.find((v) => v.name === "Half")!;
    const whole = variants!.find((v) => v.name === "Whole")!;

    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "pending_payment",
    });
    await addOrderItem(order.id, product, { quantity: 3 });
    await adminDb()
      .from("order_items")
      .update({ variant_id: half.id, variant_snapshot: "Half" })
      .eq("order_id", order.id);

    const { error } = await adminDb().rpc("finalize_paid_order", {
      p_order_id: order.id,
      p_payment_intent_id: `pi_it_variants_${++n}_${Date.now()}`,
      p_discount_total: "0",
      p_tax_total: "0",
      p_total: "15.00",
    });
    expect(error).toBeNull();

    const { data: after } = await adminDb()
      .from("product_variants")
      .select("id, quantity_available")
      .in("id", [half.id, whole.id]);

    expect(after!.find((v) => v.id === half.id)!.quantity_available).toBe(1);
    // The option that wasn't bought is untouched...
    expect(after!.find((v) => v.id === whole.id)!.quantity_available).toBe(6);

    // ...and so is the listing's own stock, which is not what was sold.
    const { data: prod } = await adminDb()
      .from("products")
      .select("quantity_available")
      .eq("id", product.id)
      .single();
    expect(prod!.quantity_available).toBe(10);
  });

  it("still decrements the product for a line with no variant", async () => {
    const product = await createProduct(seller.id, { quantity: 8 });
    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "pending_payment",
    });
    await addOrderItem(order.id, product, { quantity: 2 });

    await adminDb().rpc("finalize_paid_order", {
      p_order_id: order.id,
      p_payment_intent_id: `pi_it_variants_${++n}_${Date.now()}`,
      p_discount_total: "0",
      p_tax_total: "0",
      p_total: "20.00",
    });

    const { data: prod } = await adminDb()
      .from("products")
      .select("quantity_available")
      .eq("id", product.id)
      .single();
    expect(prod!.quantity_available).toBe(6);
  });

  it("is still a clean no-op on a Stripe redelivery", async () => {
    const product = await createProduct(seller.id, { quantity: 5 });
    const { data: v } = await sellerUser.db
      .from("product_variants")
      .insert({ product_id: product.id, name: "One", price: "4.00", quantity_available: 5 })
      .select("id")
      .single();

    const order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "pending_payment",
    });
    await addOrderItem(order.id, product, { quantity: 2 });
    await adminDb().from("order_items").update({ variant_id: v!.id }).eq("order_id", order.id);

    const args = {
      p_order_id: order.id,
      p_payment_intent_id: `pi_it_variants_${++n}_${Date.now()}`,
      p_discount_total: "0",
      p_tax_total: "0",
      p_total: "8.00",
    };
    const first = await adminDb().rpc("finalize_paid_order", args);
    const second = await adminDb().rpc("finalize_paid_order", args);

    expect(first.data).toBe(true);
    expect(second.data).toBe(false); // guarded on pending_payment — the retry changes nothing

    const { data: after } = await adminDb()
      .from("product_variants")
      .select("quantity_available")
      .eq("id", v!.id)
      .single();
    expect(after!.quantity_available).toBe(3);
  });
});
