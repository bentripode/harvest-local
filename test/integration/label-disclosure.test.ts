import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, anonDb, cleanupAll, createSeller, createTestUser, describeDb, type Db } from "./helpers";

/**
 * `product_label_disclosure` — the label a buyer must see before paying.
 *
 * Texas §437.0194(b)(2) permits an internet sale only if the labelling information reaches the
 * consumer before payment is accepted. The data spans tables a buyer cannot read, so this function
 * is the narrow hole through it: exactly the fields required on the physical label, callable by an
 * anonymous browser, and nothing else.
 */
describeDb("pre-checkout label disclosure", () => {
  let admin: Db;
  let sellerId: string;
  let productId: string;
  let addressId: string;

  beforeAll(async () => {
    admin = adminDb();
    const user = await createTestUser({ role: "seller", homeState: "TX" });
    const seller = await createSeller(user.id, { homeState: "TX" });
    sellerId = seller.id;

    const { data: address } = await admin
      .from("addresses")
      .insert({
        user_id: user.id,
        line1: "1114 Nueces St",
        city: "Austin",
        state: "TX",
        postal_code: "78701",
      })
      .select("id")
      .single();
    addressId = address!.id;
    await admin
      .from("seller_profiles")
      .update({ pickup_address_id: addressId })
      .eq("id", sellerId);

    const { data: category } = await admin
      .from("categories")
      .select("id")
      .eq("slug", "baked-goods")
      .single();
    const { data: product } = await admin
      .from("products")
      .insert({
        seller_id: sellerId,
        title: "IT Sourdough",
        price: "9.00",
        category_id: category!.id,
        status: "active",
        quantity_available: 5,
        ingredients: ["Wheat flour", "Water", "Sea salt"],
        net_weight_value: "24",
        net_weight_unit: "oz",
        allergens: ["wheat"],
      })
      .select("id")
      .single();
    productId = product!.id;
  });

  afterAll(cleanupAll);

  it("an anonymous buyer can read the disclosure", async () => {
    const { data, error } = await anonDb().rpc("product_label_disclosure", {
      p_product_id: productId,
    });
    expect(error).toBeNull();
    expect(data?.[0]?.product_name).toBe("IT Sourdough");
  });

  it("flags that Texas requires it before payment", async () => {
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: productId });
    expect(data?.[0]?.predisclosure_required).toBe(true);
  });

  it("carries the statutory disclaimer, not the summary's version", async () => {
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: productId });
    expect(data?.[0]?.disclaimer_text).toBe(
      "THIS PRODUCT WAS PRODUCED IN A PRIVATE RESIDENCE THAT IS NOT SUBJECT TO GOVERNMENTAL LICENSING OR INSPECTION.",
    );
    expect(data?.[0]?.disclaimer_all_caps).toBe(true);
  });

  it("exposes the producer address, which a buyer cannot read directly", async () => {
    // The address row itself stays owner-only …
    const { data: direct } = await anonDb().from("addresses").select("line1").eq("id", addressId);
    expect(direct ?? []).toHaveLength(0);

    // … but it is required on the label, so the function returns it.
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: productId });
    expect(data?.[0]?.producer_address).toContain("1114 Nueces St");
    expect(data?.[0]?.producer_address).toContain("Austin");
  });

  it("returns the product's own label fields", async () => {
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: productId });
    const row = data?.[0];
    expect(row?.ingredients).toEqual(["Wheat flour", "Water", "Sea salt"]);
    expect(Number(row?.net_weight_value)).toBe(24);
    expect(row?.allergens).toEqual(["wheat"]);
  });

  it("discloses nothing for a draft, which no buyer can see", async () => {
    await admin.from("products").update({ status: "draft" }).eq("id", productId);
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: productId });
    expect(data ?? []).toHaveLength(0);
    await admin.from("products").update({ status: "active" }).eq("id", productId);
  });

  it("is off by default for a state nobody has reviewed", async () => {
    const user = await createTestUser({ role: "seller", homeState: "WY" });
    const seller = await createSeller(user.id, { homeState: "WY" });
    const { data: category } = await admin
      .from("categories")
      .select("id")
      .eq("slug", "baked-goods")
      .single();
    const { data: product } = await admin
      .from("products")
      .insert({
        seller_id: seller.id,
        title: "IT Wyoming Loaf",
        price: "9.00",
        category_id: category!.id,
        status: "active",
        quantity_available: 5,
      })
      .select("id")
      .single();

    const { data } = await anonDb().rpc("product_label_disclosure", {
      p_product_id: product!.id,
    });
    // False means nobody has checked Wyoming, not that Wyoming has no such rule.
    expect(data?.[0]?.predisclosure_required).toBe(false);
  });

  it("does not leak anything beyond the label fields", async () => {
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: productId });
    const keys = Object.keys(data?.[0] ?? {}).sort();
    expect(keys).toEqual(
      [
        "allergens",
        "business_name",
        "disclaimer_all_caps",
        "disclaimer_min_pt",
        "disclaimer_text",
        "ingredients",
        "metric_required",
        "net_weight_unit",
        "net_weight_value",
        "permit_number",
        "predisclosure_required",
        "producer_address",
        "product_name",
        "required_elements",
        "state_code",
      ].sort(),
    );
  });
});
