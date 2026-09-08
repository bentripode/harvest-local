import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, anonDb, cleanupAll, createSeller, createTestUser, describeDb, type Db } from "./helpers";

/**
 * The pre-sale disclosure is not the label, and treating it as one published home addresses.
 *
 * `predisclosure_required` was a boolean, so the renderer had exactly one behaviour: show the whole
 * label on the listing. That is right in four states and wrong in five — what a state requires
 * BEFORE the sale and what it requires ON THE JAR are different documents with different contents.
 *
 * Each rule asserted here was read from the jurisdiction's own text on 2026-09-07.
 */
describeDb("what a state requires before the sale", () => {
  let admin: Db;

  beforeAll(() => {
    admin = adminDb();
  });

  afterAll(cleanupAll);

  /** An active food listing in `state`, whose seller really does have a pickup address. */
  async function listingIn(state: string, ordinal?: number): Promise<string> {
    const user = await createTestUser({ role: "seller", homeState: state });
    const seller = await createSeller(user.id, { homeState: state });

    const { data: address } = await admin
      .from("addresses")
      .insert({
        user_id: user.id,
        line1: "9 Kitchen Lane",
        city: "Testville",
        state,
        postal_code: "12345",
      })
      .select("id")
      .single();

    // Without a chosen programme the predicates fall back to the state's FIRST, which is the wrong
    // rule in every multi-programme state — Utah runs three and only the second is under test.
    let programId: string | null = null;
    if (ordinal != null) {
      const { data: program } = await admin
        .from("state_food_programs")
        .select("id")
        .eq("state_code", state)
        .eq("ordinal", ordinal)
        .single();
      programId = program!.id;
    }
    await admin
      .from("seller_profiles")
      .update({
        pickup_address_id: address!.id,
        homemade_food_statement: "Not inspected by any regulator.",
        ...(programId ? { food_program_id: programId } : {}),
      })
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
        title: `IT ${state} Listing`,
        price: "8.00",
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

  async function disclose(productId: string) {
    const { data } = await anonDb().rpc("product_label_disclosure", { p_product_id: productId });
    return data?.[0];
  }

  /**
   * Cal. Health & Saf. Code 114365.3(f): an operation advertising "through an internet website,
   * social media platform, newspaper, newsletter, or other public announcement, shall indicate the
   * following on the advertisement: (1) The county of approval. (2) The permit or registration
   * number. (3) A statement that the food prepared is Made in a Home Kitchen ...".
   *
   * Three items. The producer's address is not among them, and is not in the (e) label list either
   * — it reaches the jar only through federal 21 U.S.C. 343. We were publishing eight elements.
   */
  it("California shows the three items (f) names, and not the address", async () => {
    const row = await disclose(await listingIn("CA"));
    expect(row?.producer_address).toBeNull();
    expect(row?.required_elements).toEqual(["municipality", "permit_number"]);
    expect(row?.disclaimer_text).toBe("Made in a Home Kitchen.");
  });

  /**
   * Minn. Stat. 28A.152 subd. 2(d): the statement "These products are homemade and not subject to
   * state inspection." "must be displayed on the website that offers the exempt foods for
   * purchase." The statement, and nothing else — the label elements are subd. 1(a)(1)(i) and go on
   * the food. A Minnesotan with no registration number had their address published through the
   * identity alternatives group to satisfy that one sentence.
   */
  it("Minnesota shows the statement and no fields at all", async () => {
    const row = await disclose(await listingIn("MN"));
    expect(row?.required_elements).toEqual([]);
    expect(row?.producer_address).toBeNull();
    expect(row?.disclaimer_text).toBe(
      "These products are homemade and not subject to state inspection.",
    );
  });

  /**
   * Neb. Rev. Stat. 81-2,280(5)(c) puts "such notification" — the (5)(a) facts — on the producer's
   * website. The name and address duty is (6), and is expressly "on the package or container label".
   */
  it("Nebraska shows the notification, not the package label's name and address", async () => {
    const row = await disclose(await listingIn("NE"));
    expect(row?.required_elements).toEqual(["seller_statement"]);
    expect(row?.producer_address).toBeNull();
    expect(row?.seller_statement).toBe("Not inspected by any regulator.");
  });

  /**
   * Utah Code 4-5a-104(6) is one fact: the producer "shall inform the final consumer that the food
   * or food product is not certified, licensed, regulated, or inspected by the state or any county
   * or city." The name and address sit in (3), which is what the food "shall be labeled with".
   */
  it("Utah shows the one fact (6) requires, not the (3) label", async () => {
    const row = await disclose(await listingIn("UT", 2));
    expect(row?.required_elements).toEqual(["seller_statement"]);
    expect(row?.producer_address).toBeNull();
  });

  /**
   * 410 ILCS 625/4 prescribes TWO sentences: (b)(7)(E) on the package, ending "If you have safety
   * concerns, contact your local health department."; and (b)(10) online, which stops before it.
   * Showing the package sentence on the sales interface shows text the statute wrote for elsewhere.
   */
  it("Illinois shows the (b)(10) notice, which is shorter than the label phrase", async () => {
    const row = await disclose(await listingIn("IL"));
    expect(row?.required_elements).toEqual([]);
    expect(row?.disclaimer_text).toBe(
      "This product was produced in a home kitchen not inspected by a health department that may also process common food allergens.",
    );
    expect(row?.disclaimer_text).not.toContain("If you have safety concerns");
  });

  /**
   * The other half, and the reason this is a narrowing rather than a blanket removal. Four states
   * genuinely put the whole information set on the page, so the address IS owed there and
   * withholding it would be under-disclosure:
   *
   *   IN  16-42-5.3-5(b)  "shall post the label of each food product on the vendor's website"
   *   NM  25-12-3(B)(4)   the subsection C information "on a webpage on which [it] is offered"
   *   OK  5-4.3(B)(4)     the paragraph 6 information "Displayed on the webpage from which ..."
   *   TN  53-1-118(b)(3)  "provided to the consumer, in the format required by subdivision (b)(4)"
   */
  it.each(["IN", "NM", "OK", "TN"])(
    "%s still publishes the address, because its statute puts the whole label on the page",
    async (state) => {
      const row = await disclose(await listingIn(state));
      expect(row?.required_elements).toContain("producer_address");
      expect(row?.producer_address).toContain("9 Kitchen Lane");
    },
  );

  /**
   * The invariant, which is what actually protects a seller. An address reaches a listing only where
   * the whole label is owed before the sale — so a new state seeded with a broad element list, or a
   * label rule widened by a later correction, cannot quietly start publishing one.
   */
  it("no state publishes an address on a narrowed pre-sale set", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select(
        "predisclosure_elements, required_elements, address_withheld_until_payment, state_food_programs!inner(state_code)",
      )
      .eq("predisclosure_required", true);

    const publishing = (data ?? [])
      .filter((r) => {
        if (r.address_withheld_until_payment) return false;
        const set = r.predisclosure_elements ?? r.required_elements ?? [];
        return set.includes("producer_address");
      })
      .map((r) => (r.state_food_programs as unknown as { state_code: string }).state_code)
      .sort();

    expect(publishing).toEqual(["IN", "NM", "OK", "TN"]);
  });

  /** A narrowed set means nothing without a pre-sale duty, and the CHECK constraint says so. */
  it("refuses a narrowed set on a rule with no pre-sale duty", async () => {
    const { data: rule } = await admin
      .from("state_label_rules")
      .select("program_id")
      .eq("predisclosure_required", false)
      .limit(1)
      .single();

    const { error } = await admin
      .from("state_label_rules")
      .update({ predisclosure_elements: ["seller_statement"] })
      .eq("program_id", rule!.program_id);
    expect(error).not.toBeNull();
  });
});
