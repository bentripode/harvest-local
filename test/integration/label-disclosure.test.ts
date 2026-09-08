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

  /**
   * This assertion used to run the other way, and the comment it carried is why the defect
   * survived a review: it spotted § 437.0194(c), wrote it down, and asserted the address came out
   * anyway.
   *
   * Tex. Health & Safety Code § 437.0194(c): an operator selling over the internet "(1) is not
   * required to include the address of the operation in the labeling information required under
   * Subsection (b)(2) before the operator accepts payment for the food; and (2) shall provide the
   * address or unique identification number of the operation on the label of the food ... after
   * the operator accepts payment."
   *
   * The address is still required — on the jar, afterwards. What the legislature excused is the
   * PRE-PAYMENT disclosure, which is exactly what this anon-callable function is.
   */
  it("withholds the producer address from a Texan listing, as 437.0194(c)(1) permits", async () => {
    // The address row itself stays owner-only …
    const { data: direct } = await anonDb().from("addresses").select("line1").eq("id", addressId);
    expect(direct ?? []).toHaveLength(0);

    // … and in Texas it does not come out through the disclosure either.
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: productId });
    expect(data?.[0]?.producer_address).toBeNull();
    // The town goes with it. Naming the town of a home kitchen beside the producer's name is most
    // of the way to naming the kitchen, and no Texas provision asks for it before payment.
    expect(data?.[0]?.municipality).toBeNull();
    // Said out loud, so a caller can tell "withheld by law" from "seller never entered one".
    expect(data?.[0]?.address_withheld).toBe(true);
  });

  /**
   * The distinction the flag exists to hold open: withheld from the LISTING, still on the LABEL.
   * `getLabelContext` reads the seller profile directly rather than through this function, so the
   * label printed under § 437.0193(b) is unaffected — this asserts the data is still there for it.
   */
  it("keeps the address on the seller record for the label printed after payment", async () => {
    const { data: addr } = await admin
      .from("addresses")
      .select("line1, city")
      .eq("id", addressId)
      .single();
    expect(addr?.line1).toBe("1114 Nueces St");
    expect(addr?.city).toBe("Austin");

    const { data: seller } = await admin
      .from("seller_profiles")
      .select("pickup_address_id")
      .eq("id", sellerId)
      .single();
    expect(seller?.pickup_address_id).toBe(addressId);
  });

  /**
   * Withholding the address does not excuse the rest of § 437.0194(b)(2). The disclosure is still
   * required and still has to carry everything else the label carries.
   */
  it("still requires the disclosure, and still carries the rest of it", async () => {
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: productId });
    expect(data?.[0]?.predisclosure_required).toBe(true);
    expect(data?.[0]?.business_name).toBeTruthy();
    expect(data?.[0]?.ingredients).toEqual(["Wheat flour", "Water", "Sea salt"]);
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

  /**
   * This test used to use Wyoming as its example of a state nobody had reviewed. Wyoming is now a
   * predisclosure state — Wyo. Stat. 11-49-102(a)(v) defines the "informed end consumer" as one who
   * "has been informed that the product is not licensed, regulated or inspected" — and with the
   * alphabetical pass complete there is no unreviewed state left to stand in for one.
   *
   * So it asserts the thing that still matters: the flag stays off where the state's own law does
   * not ask for a pre-sale disclosure. West Virginia is the example — W. Va. Code 19-35-6 exempts
   * nonpotentially hazardous food from labelling law outright and delegates what remains to the
   * department, requiring nothing before the sale.
   */
  it("stays off where the state's own law asks for nothing before the sale", async () => {
    const user = await createTestUser({ role: "seller", homeState: "WV" });
    const seller = await createSeller(user.id, { homeState: "WV" });
    const { data: category } = await admin
      .from("categories")
      .select("id")
      .eq("slug", "baked-goods")
      .single();
    const { data: product } = await admin
      .from("products")
      .insert({
        seller_id: seller.id,
        title: "IT West Virginia Loaf",
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
        // Not a label field. It tells the caller the address was withheld BY LAW rather than
        // merely absent, so a Texan seller is not asked to fix a gap 437.0194(c)(1) excuses.
        "address_withheld",
        "producer_address",
        "mailing_address",
        // Gated the same way as the email: eleven states require a producer's telephone number on
        // the label and five more accept it in place of an email, and it is null in the rest.
        "producer_phone",
        // Returned ONLY where the state's own label rule asks for an email — New Mexico requires
        // one outright (25-12-3(C)(1)), CO and HI accept it as one of two contact options. Null
        // everywhere else, so one state's requirement does not publish every seller's address.
        "producer_email",
        // Same gate: a state-issued number is only public where the state offers it in place of
        // the address (TX 437.0193(b-1), and the AR and OR equivalents).
        "producer_id_number",
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

  /**
   * The telephone number is gated the same way, and Tennessee is the state that forced it to exist:
   * § 53-1-118(b)(4)(A) requires it on the label and (b)(5)(A)(iv) puts the whole of (b)(4) on the
   * webpage the item is offered for sale from.
   */
  it("returns the phone number Tennessee requires, and withholds it in Texas", async () => {
    const tn = await activeProductIn("TN");
    await admin
      .from("seller_profiles")
      .update({ contact_phone: "(615) 555-0134" })
      .eq("id", (await admin.from("products").select("seller_id").eq("id", tn).single()).data!.seller_id);

    const { data: tnRow } = await anonDb().rpc("product_label_disclosure", { p_product_id: tn });
    expect(tnRow?.[0]?.required_elements).toContain("producer_phone");
    expect(tnRow?.[0]?.producer_phone).toBe("(615) 555-0134");

    const tx = await activeProductIn("TX");
    await admin
      .from("seller_profiles")
      .update({ contact_phone: "(512) 555-0177" })
      .eq("id", (await admin.from("products").select("seller_id").eq("id", tx).single()).data!.seller_id);

    const { data: txRow } = await anonDb().rpc("product_label_disclosure", { p_product_id: tx });
    expect(txRow?.[0]?.required_elements).not.toContain("producer_phone");
    // Set on the profile, and still not published — Texas's label rule does not ask for one.
    expect(txRow?.[0]?.producer_phone).toBeNull();
  });
});

/**
 * The scope of the withholding, which matters more than the Texas case itself.
 *
 * Defaulting `address_withheld_until_payment` on — or setting it from a guess about which states
 * "probably" allow it — would strip the producer address out of the pre-payment disclosure in
 * states that require it there. Same class of error, opposite direction, and invisible: a listing
 * short of a required field still renders perfectly well.
 *
 * So the flag is true only where the text was read and says so.
 */
describeDb("who may withhold an address", () => {
  let admin: Db;

  beforeAll(() => {
    admin = adminDb();
  });

  afterAll(cleanupAll);

  it("is set for Texas alone", async () => {
    const { data, error } = await admin
      .from("state_label_rules")
      .select("address_withheld_until_payment, state_food_programs!inner(state_code, ordinal)");
    expect(error).toBeNull();

    const on = (data ?? [])
      .filter((r) => r.address_withheld_until_payment)
      .map((r) => {
        const p = r.state_food_programs as unknown as { state_code: string; ordinal: number };
        return `${p.state_code}:${p.ordinal}`;
      })
      .sort();

    // Tex. Health & Safety Code 437.0194(c)(1), read 2026-09-07. Adding to this list means reading
    // another state's text first — and then this assertion is the thing you update.
    expect(on).toEqual(["TX:1"]);
  });

  /**
   * A state with no such provision still gets its address, so the SQL `case` is guarding on the
   * flag and not on something incidental to the Texas fixture.
   */
  it("leaves the address in place for a state that has no such provision", async () => {
    const user = await createTestUser({ role: "seller", homeState: "NM" });
    const seller = await createSeller(user.id, { homeState: "NM" });

    const { data: address } = await admin
      .from("addresses")
      .insert({
        user_id: user.id,
        line1: "218 Galisteo St",
        city: "Santa Fe",
        state: "NM",
        postal_code: "87501",
      })
      .select("id")
      .single();
    await admin
      .from("seller_profiles")
      .update({ pickup_address_id: address!.id })
      .eq("id", seller.id);

    const { data: category } = await admin
      .from("categories")
      .select("id")
      .eq("slug", "baked-goods")
      .single();
    const { data: product } = await admin
      .from("products")
      .insert({
        seller_id: seller.id,
        title: "IT Biscochito",
        price: "6.00",
        category_id: category!.id,
        status: "active",
        quantity_available: 3,
        ingredients: ["Wheat flour", "Anise"],
        net_weight_value: "12",
        net_weight_unit: "oz",
        allergens: ["wheat"],
      })
      .select("id")
      .single();

    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: product!.id });
    expect(data?.[0]?.address_withheld).toBe(false);
    // N.M. Stat. 25-12-3(C)(1) puts the processor's address on the label, and (B)(4) on the listing.
    expect(data?.[0]?.producer_address).toContain("218 Galisteo St");
  });
});
