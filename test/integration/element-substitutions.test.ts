import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, anonDb, cleanupAll, createSeller, createTestUser, describeDb, type Db } from "./helpers";

/**
 * A state-issued number that stands in FOR other label elements, rather than beside them.
 *
 * Okla. Stat. tit. 2 § 5-4.3(C): a producer paying $15 a year gets a registration number that "may
 * be used on product labels instead of the producer's name, phone number, and the physical address
 * of the location where the homemade food product was produced." And § 5-4.3(B)(4) puts the (A)(6)
 * information "on the webpage from which the homemade food product is offered for sale" — so the
 * substitution has to reach the buyer-facing function, not just the printed label. That is the
 * whole point: an Oklahoman paid a state fee to keep their home address off this listing.
 *
 * Gating the returned COLUMNS is what matters, because the function is granted to `anon` and a
 * caller can read them directly without looking at `required_elements`.
 */
describeDb("a registration number that replaces other elements", () => {
  let admin: Db;

  beforeAll(() => {
    admin = adminDb();
  });

  afterAll(cleanupAll);

  /** An active food listing whose seller has a real name, phone and pickup address. */
  async function listingIn(state: string, idNumber: string | null): Promise<string> {
    const user = await createTestUser({ role: "seller", homeState: state });
    const seller = await createSeller(user.id, { homeState: state });

    const { data: address } = await admin
      .from("addresses")
      .insert({
        user_id: user.id,
        line1: "88 Prairie Rd",
        city: "Enid",
        state,
        postal_code: "73701",
      })
      .select("id")
      .single();

    const { error: updateError } = await admin
      .from("seller_profiles")
      .update({
        pickup_address_id: address!.id,
        contact_phone: "405-555-0117",
        producer_id_number: idNumber,
      })
      .eq("id", seller.id);
    expect(updateError).toBeNull();

    const { data: category } = await admin
      .from("categories")
      .select("id")
      .eq("slug", "baked-goods")
      .single();
    const { data: product, error: productError } = await admin
      .from("products")
      .insert({
        seller_id: seller.id,
        title: `IT ${state} Pie`,
        price: "9.00",
        category_id: category!.id,
        status: "active",
        quantity_available: 2,
        ingredients: ["Wheat flour", "Butter"],
        net_weight_value: "20",
        net_weight_unit: "oz",
        allergens: ["wheat", "milk"],
      })
      .select("id")
      .single();
    expect(productError).toBeNull();
    return product!.id;
  }

  async function disclose(productId: string) {
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: productId });
    return data?.[0];
  }

  it("withholds the name, phone and address an Oklahoma number replaces", async () => {
    const row = await disclose(await listingIn("OK", "OK-HF-4417"));

    expect(row?.producer_address).toBeNull();
    expect(row?.producer_phone).toBeNull();
    expect(row?.producer_id_number).toBe("OK-HF-4417");

    // And the resolved element list says so, so the rendered listing agrees with the columns.
    expect(row?.required_elements).toContain("producer_id_number");
    expect(row?.required_elements).not.toContain("producer_address");
    expect(row?.required_elements).not.toContain("producer_phone");
    expect(row?.required_elements).not.toContain("producer_name");
  });

  /** Nothing the number replaces may survive anywhere in the payload. */
  it("leaks none of the replaced values through any column", async () => {
    const row = await disclose(await listingIn("OK", "OK-HF-4417"));
    const payload = JSON.stringify(row);
    expect(payload).not.toContain("Prairie Rd");
    expect(payload).not.toContain("405-555-0117");
    expect(payload).not.toContain("Enid");
  });

  /**
   * The other half: a producer who has NOT bought a number owes all three, and § 5-4.3(B)(4) still
   * puts them on the webpage. Withholding them here would be under-disclosure.
   */
  it("still publishes them for an Oklahoma seller with no number", async () => {
    const row = await disclose(await listingIn("OK", null));
    expect(row?.producer_address).toContain("88 Prairie Rd");
    expect(row?.producer_phone).toBe("405-555-0117");
    expect(row?.producer_id_number).toBeNull();
    expect(row?.required_elements).toContain("producer_address");
  });

  /**
   * Oregon's number replaces the ADDRESS ALONE. ORS 616.718(6)(b): "(A) The name and phone number
   * for the food establishment; (B) The address of the food establishment or the unique
   * identification number ...". The name and phone are required by (A) regardless, so a
   * substitution that swallowed them would drop two elements Oregon actually asks for.
   */
  it("replaces only the address in Oregon, where the name and phone are separately required", async () => {
    const row = await disclose(await listingIn("OR", "OR-FE-2291"));
    expect(row?.producer_address).toBeNull();
    expect(row?.producer_id_number).toBe("OR-FE-2291");
    // (6)(b)(A) still stands.
    expect(row?.producer_phone).toBe("405-555-0117");
    expect(row?.required_elements).toContain("producer_name");
    expect(row?.required_elements).toContain("producer_phone");
  });

  /**
   * An empty string is not a registration number. Treating one as live would strip the address off
   * a label for a seller who never registered at all.
   */
  it("treats a blank number as no number", async () => {
    const row = await disclose(await listingIn("OK", ""));
    expect(row?.producer_address).toContain("88 Prairie Rd");
    expect(row?.required_elements).toContain("producer_address");
  });

  /**
   * Texas is where the two mechanisms meet. § 437.0193(b-1) lets the number replace the address on
   * the label; § 437.0194(c)(1) separately withholds the address from the PRE-PAYMENT disclosure
   * whether or not a number exists. A seller with no number must still get no address here.
   */
  it("keeps Texas withholding the address before payment even with no number", async () => {
    const row = await disclose(await listingIn("TX", null));
    expect(row?.address_withheld).toBe(true);
    expect(row?.producer_address).toBeNull();
  });

  /**
   * The scope invariant. A substitution is only ever safe where the statute says one value stands in
   * for another; a stray one would silently strip required elements off a label.
   */
  it("is configured only for the states whose text says so", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("element_substitutions, state_food_programs!inner(state_code, ordinal)");

    const configured = (data ?? [])
      .filter((r) => Array.isArray(r.element_substitutions) && r.element_substitutions.length > 0)
      .map((r) => {
        const p = r.state_food_programs as unknown as { state_code: string; ordinal: number };
        return `${p.state_code}:${p.ordinal}`;
      })
      .sort();

    // OK 5-4.3(C), OR 616.718(6)(b), TX 437.0193(b-1) — each read in full. Arkansas belongs here
    // too (its number is issued "to protect the producer's safety") and is deliberately absent:
    // Act 1040 of 2021 would not extract from either state host, and the row says so.
    expect(configured).toEqual(["OK:1", "OR:1", "TX:1"]);
  });
});
