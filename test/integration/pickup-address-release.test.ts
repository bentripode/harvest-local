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
 * The collection address is approximate in public and exact once paid for.
 *
 * `order_pickup_address()` is the only way a buyer can reach it — `addresses` is owner-only and the
 * buyer is not the owner — so this covers the two ways the timing rule could fail: handing the
 * address to someone who has not paid, and failing to hand it over to someone who has.
 */
describeDb("order_pickup_address", () => {
  let buyer: TestUser;
  let stranger: TestUser;
  let sellerUser: TestUser;
  let seller: { id: string };
  let locationId: string;
  let addressId: string;

  beforeAll(async () => {
    buyer = await createTestUser({ homeState: "TX" });
    stranger = await createTestUser({ homeState: "TX" });
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });

    // The seller's own collection point — a house, in the ordinary case.
    const { data: addr, error: addrError } = await adminDb()
      .from("addresses")
      .insert({
        user_id: sellerUser.id,
        label: "Porch",
        line1: "14 Cottage Lane",
        city: "Austin",
        state: "TX",
        postal_code: "78704",
      })
      .select("id")
      .single();
    if (addrError) throw new Error(`address fixture: ${addrError.message}`);
    addressId = addr!.id;

    const { data: loc, error: locError } = await adminDb()
      .from("pickup_locations")
      .insert({
        seller_id: seller.id,
        address_id: addressId,
        label: "Front porch",
        description: "Blue door, basket on the step",
        city: "Austin",
        postal_code: "78704",
      })
      .select("id")
      .single();
    if (locError) throw new Error(`location fixture: ${locError.message}`);
    locationId = loc!.id;
  });

  afterAll(async () => {
    await adminDb().from("addresses").delete().eq("id", addressId);
    await cleanupAll();
  });

  async function orderAt(status: string) {
    const o = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: status as "new",
    });
    await adminDb()
      .from("orders")
      .update({ pickup_location_id: locationId, pickup_location_text: "Front porch · Austin" })
      .eq("id", o.id);
    return o;
  }

  it("gives the buyer nothing while the order is still pending payment", async () => {
    const o = await orderAt("pending_payment");
    const { data, error } = await buyer.db.rpc("order_pickup_address", { p_order_id: o.id });
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("gives the buyer the street address once payment has cleared", async () => {
    const o = await orderAt("new");
    const { data, error } = await buyer.db.rpc("order_pickup_address", { p_order_id: o.id });
    expect(error).toBeNull();

    const row = (data ?? [])[0];
    expect(row).toBeTruthy();
    expect(row.line1).toBe("14 Cottage Lane");
    expect(row.city).toBe("Austin");
    expect(row.source).toBe("address");
    expect(row.description).toBe("Blue door, basket on the step");
  });

  it("gives the seller their own order's address", async () => {
    const o = await orderAt("new");
    const { data, error } = await sellerUser.db.rpc("order_pickup_address", { p_order_id: o.id });
    expect(error).toBeNull();
    expect((data ?? [])[0]?.line1).toBe("14 Cottage Lane");
  });

  it("refuses a stranger even on a paid order", async () => {
    const o = await orderAt("new");
    const { error } = await stranger.db.rpc("order_pickup_address", { p_order_id: o.id });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not a party/i);
  });

  it("returns nothing for a delivery order, which carries its own frozen address", async () => {
    const o = await orderAt("new");
    await adminDb().from("orders").update({ fulfillment_type: "delivery" }).eq("id", o.id);

    const { data } = await buyer.db.rpc("order_pickup_address", { p_order_id: o.id });
    expect(data ?? []).toHaveLength(0);
  });

  it("returns nothing at all for an order id that doesn't exist", async () => {
    const { data, error } = await buyer.db.rpc("order_pickup_address", {
      p_order_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("falls back to the seller's production address when the order has no location", async () => {
    // Orders predating pickup_locations, and sellers who never added one: collection has always
    // meant the address on their profile.
    await adminDb()
      .from("seller_profiles")
      .update({ pickup_address_id: addressId })
      .eq("id", seller.id);

    const o = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "new",
    });

    const { data } = await buyer.db.rpc("order_pickup_address", { p_order_id: o.id });
    expect((data ?? [])[0]?.line1).toBe("14 Cottage Lane");
  });

  it("returns the market's own address for a booth, which was never private", async () => {
    const { data: market } = await adminDb()
      .from("markets")
      .insert({
        slug: `it-booth-${Date.now()}`,
        name: "IT Booth Market",
        state: "TX",
        city: "Austin",
        address_text: "100 Market Square",
      })
      .select("id")
      .single();

    const { data: boothLoc } = await adminDb()
      .from("pickup_locations")
      .insert({ seller_id: seller.id, market_id: market!.id, label: "Stall 12" })
      .select("id")
      .single();

    const o = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "new",
    });
    await adminDb()
      .from("orders")
      .update({ pickup_location_id: boothLoc!.id })
      .eq("id", o.id);

    const { data } = await buyer.db.rpc("order_pickup_address", { p_order_id: o.id });
    const row = (data ?? [])[0];
    expect(row?.source).toBe("market");
    expect(row?.line1).toBe("100 Market Square");

    await adminDb().from("markets").delete().eq("id", market!.id);
  });
});
