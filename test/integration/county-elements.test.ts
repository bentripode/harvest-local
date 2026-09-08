import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, anonDb, cleanupAll, createSeller, createTestUser, describeDb, type Db } from "./helpers";

/**
 * Two states want a county on the label, and they want different counties.
 *
 * CALIFORNIA — Health & Saf. Code 114365.3(e)(4): the registration number "and the name of the
 * county of the local enforcement agency that issued" it. A fact about the REGISTRATION, held on the
 * licence beside the number it is stated with.
 *
 * COLORADO — Rev. Stat. 25-4-1614(3)(a)(II) as amended by HB26-1033 (signed 2026-06-04): "the county
 * in which the food was prepared", which replaced "the address at which the food was prepared". A
 * fact about the SELLER, held on the profile.
 *
 * A producer can be registered in one county and bake in another, so collapsing the two into one
 * element would put the wrong county on somebody's label — which is what happened for as long as
 * both resolved to the seller's pickup-address town.
 */
describeDb("the two counties are different facts", () => {
  let admin: Db;

  beforeAll(() => {
    admin = adminDb();
  });

  afterAll(cleanupAll);

  async function listingIn(
    state: string,
    opts: { preparationCounty?: string | null; idNumber?: string | null } = {},
  ): Promise<{ productId: string; sellerId: string }> {
    const user = await createTestUser({ role: "seller", homeState: state });
    const seller = await createSeller(user.id, { homeState: state });

    const { data: address } = await admin
      .from("addresses")
      .insert({
        user_id: user.id,
        line1: "4 Aspen Way",
        city: "Longmont",
        state,
        postal_code: "80501",
      })
      .select("id")
      .single();

    const { error } = await admin
      .from("seller_profiles")
      .update({
        pickup_address_id: address!.id,
        preparation_county: opts.preparationCounty ?? null,
        producer_id_number: opts.idNumber ?? null,
      })
      .eq("id", seller.id);
    expect(error).toBeNull();

    const { data: category } = await admin
      .from("categories")
      .select("id")
      .eq("slug", "baked-goods")
      .single();
    const { data: product, error: productError } = await admin
      .from("products")
      .insert({
        seller_id: seller.id,
        title: `IT ${state} Tart`,
        price: "8.00",
        category_id: category!.id,
        status: "active",
        quantity_available: 2,
        ingredients: ["Wheat flour", "Sugar"],
        net_weight_value: "14",
        net_weight_unit: "oz",
        allergens: ["wheat"],
      })
      .select("id")
      .single();
    expect(productError).toBeNull();
    return { productId: product!.id, sellerId: seller.id };
  }

  const disclose = async (id: string) =>
    (await anonDb().rpc("product_label_disclosure", { p_product_id: id }))?.data?.[0];

  it("Colorado asks for the county the food was prepared in", async () => {
    const { productId } = await listingIn("CO", {
      preparationCounty: "Boulder",
      idNumber: "CO-REG-771",
    });
    const row = await disclose(productId);

    expect(row?.required_elements).toContain("county_of_preparation");
    expect(row?.county_of_preparation).toBe("Boulder");
    // Not the other county, and not the town the seller lives in.
    expect(row?.county_of_approval).toBeNull();
    expect(row?.municipality).toBeNull();
    expect(JSON.stringify(row)).not.toContain("Longmont");
  });

  /**
   * The registration number is required outright by (3)(a)(II) as amended. It used to be asked for
   * as `permit_number`, which resolves only from an admin-verified licence — a Colorado producer
   * registers with the department and holds no such licence, so that limb could never be satisfied
   * and every Colorado label was unprintable.
   */
  it("Colorado takes the registration number from the profile, not a licence", async () => {
    const { productId } = await listingIn("CO", {
      preparationCounty: "Boulder",
      idNumber: "CO-REG-771",
    });
    const row = await disclose(productId);
    expect(row?.required_elements).toContain("producer_id_number");
    expect(row?.required_elements).not.toContain("permit_number");
    expect(row?.producer_id_number).toBe("CO-REG-771");
  });

  /** A required field with no value is a gap the seller must close, not a blank line. */
  it("reports the Colorado county as missing when the seller has not given one", async () => {
    const { productId } = await listingIn("CO", { preparationCounty: null, idNumber: "CO-REG-771" });
    const row = await disclose(productId);
    expect(row?.required_elements).toContain("county_of_preparation");
    expect(row?.county_of_preparation).toBeNull();
  });

  /**
   * The disclaimer was misquoted: we stored "may also contain common food allergies" where
   * 25-4-1614(3)(a)(V) says "may also process common food allergens". `disclaimer_text` is quoted
   * law printed onto food without review, and those are different claims.
   */
  it("carries Colorado's disclaimer as the statute writes it", async () => {
    const { productId } = await listingIn("CO", { preparationCounty: "Boulder" });
    const row = await disclose(productId);
    expect(row?.disclaimer_text).toContain("may also process common food allergens");
    expect(row?.disclaimer_text).not.toContain("contain common food allergies");
  });

  /** California's county still comes off the licence, and Colorado's must not reach it. */
  it("keeps California on the licence and Colorado on the profile", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("required_elements, state_food_programs!inner(state_code, ordinal)");

    const naming = (element: string) =>
      (data ?? [])
        .filter((r) => (r.required_elements ?? []).includes(element))
        .map((r) => (r.state_food_programs as unknown as { state_code: string }).state_code)
        .sort();

    expect(naming("county_of_approval")).toEqual(["CA", "CA"]);
    expect(naming("county_of_preparation")).toEqual(["CO"]);
  });
});
