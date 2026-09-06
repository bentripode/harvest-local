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

    // … but it goes on the label, so the function returns it. For Texas specifically the address is
    // one half of an either/or since the 2025 amendment — § 437.0193(b-1) lets an operation print a
    // department-issued identification number instead — and § 437.0194(c) even lets it be withheld
    // until after payment. The function still returns it unconditionally; see that row's venue_note.
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
        // Publishing a food listing needs a complete label; this test is about predisclosure.
        ingredients: ["Wheat flour", "Water"],
        net_weight_value: "12",
        net_weight_unit: "oz",
        allergens: ["wheat"],
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
        "element_alternatives",
        "ingredients",
        "metric_required",
        // The town, not the street address — Cal. Health & Saf. Code 114365.3(f)(1) puts the county
        // of approval in the advertisement, and the street address is already returned anyway.
        "municipality",
        "net_weight_unit",
        "net_weight_value",
        "optional_elements",
        "permit_number",
        "predisclosure_required",
        "producer_address",
        "mailing_address",
        // Returned ONLY where the state's own label rule asks for an email — New Mexico requires
        // one outright (25-12-3(C)(1)), CO and HI accept it as one of two contact options. Null
        // everywhere else, so one state's requirement does not publish every seller's address.
        "producer_email",
        "handling_instructions",
        "product_name",
        "regulator_website_url",
        "required_elements",
        // The seller's own wording, where the state prescribes the substance and not the text.
        // Neb. Rev. Stat. 81-2,280(5)(c) wants it on the producer's website, so a buyer-facing
        // function has to be able to read it.
        "seller_statement",
        "state_code",
      ].sort(),
    );
  });
});

/**
 * The gap this pass found: a required element with no value is dropped from the rendered lines, so
 * an incomplete disclosure used to look complete. California is the sharp case — 114365.3(f)
 * requires the county of approval AND the permit number in an internet advertisement, and a seller
 * can easily have neither recorded.
 */
describeDb("disclosure gaps are visible, not silent", () => {
  let admin: Db;
  let productId: string;

  beforeAll(async () => {
    admin = adminDb();
    const user = await createTestUser({ role: "seller", homeState: "CA" });
    const seller = await createSeller(user.id, { homeState: "CA" });

    // Deliberately no pickup address and no verified licence: this is a seller mid-onboarding, and
    // the point is what the buyer is shown while they are in that state.
    const { data: category } = await admin
      .from("categories")
      .select("id")
      .eq("slug", "baked-goods")
      .single();
    const { data: product } = await admin
      .from("products")
      .insert({
        seller_id: seller.id,
        title: "IT Levain",
        price: "8.00",
        category_id: category!.id,
        status: "active",
        quantity_available: 3,
        ingredients: ["Wheat flour", "Water", "Sea salt"],
        net_weight_value: "20",
        net_weight_unit: "oz",
        allergens: ["wheat"],
      })
      .select("id")
      .single();
    productId = product!.id;
  });

  afterAll(cleanupAll);

  it("says California requires the disclosure at all", async () => {
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: productId });
    expect(data?.[0]?.predisclosure_required).toBe(true);
  });

  it("returns nulls for the county and permit number rather than inventing them", async () => {
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: productId });
    // 114365.3(e)(4) and (f) both want these; the seller has not supplied either yet.
    expect(data?.[0]?.municipality).toBeNull();
    expect(data?.[0]?.permit_number).toBeNull();
    // And the elements are still listed as required, which is what makes the gap detectable.
    expect(data?.[0]?.required_elements).toContain("municipality");
    expect(data?.[0]?.required_elements).toContain("permit_number");
  });
});

/**
 * The email is gated on the state's own rule, because this function is callable by `anon`.
 *
 * New Mexico requires the processor's email address on the label AND on the listing (N.M. Stat.
 * 25-12-3(C)(1) and (B)(4)), so a buyer there is entitled to it before they buy. Texas asks for no
 * email at all, and returning one anyway would publish every Texan seller's address to satisfy a
 * rule that does not apply to them.
 */
describeDb("the producer email follows the state's rule", () => {
  let admin: Db;

  async function activeProductIn(state: string): Promise<string> {
    const user = await createTestUser({ role: "seller", homeState: state });
    const seller = await createSeller(user.id, { homeState: state });
    const { data: category } = await admin
      .from("categories")
      .select("id")
      .eq("slug", "baked-goods")
      .single();
    const { data: product } = await admin
      .from("products")
      .insert({
        seller_id: seller.id,
        title: `IT ${state} Loaf`,
        price: "7.00",
        category_id: category!.id,
        status: "active",
        quantity_available: 2,
        ingredients: ["Wheat flour", "Water"],
        net_weight_value: "16",
        net_weight_unit: "oz",
        allergens: ["wheat"],
      })
      .select("id")
      .single();
    return product!.id;
  }

  beforeAll(async () => {
    admin = adminDb();
  });

  afterAll(cleanupAll);

  it("returns it in a state whose rule requires one", async () => {
    const id = await activeProductIn("NM");
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: id });
    expect(data?.[0]?.required_elements).toContain("producer_email");
    expect(data?.[0]?.producer_email).toBeTruthy();
  });

  it("withholds it in a state whose rule does not", async () => {
    const id = await activeProductIn("TX");
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: id });
    expect(data?.[0]?.required_elements).not.toContain("producer_email");
    expect(data?.[0]?.producer_email).toBeNull();
  });
});
