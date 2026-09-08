import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, anonDb, cleanupAll, createTestUser, describeDb, type Db, type TestUser } from "./helpers";

/**
 * `state_label_rules` — the seeded labelling data behind the generator.
 *
 * Disclaimer text is quoted statute that gets printed onto food, so what matters here is that it is
 * complete, exact, and not editable by a seller.
 */
describeDb("state label rules", () => {
  let admin: Db;
  let sellerUser: TestUser;
  let adminUser: TestUser;

  beforeAll(async () => {
    admin = adminDb();
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    adminUser = await createTestUser({ role: "admin", homeState: "TX" });
  });

  afterAll(cleanupAll);

  it("covers every program", async () => {
    const { count: programs } = await admin
      .from("state_food_programs")
      .select("id", { count: "exact", head: true });
    const { count: rules } = await admin
      .from("state_label_rules")
      .select("program_id", { count: "exact", head: true });
    expect(rules).toBe(programs);
  });

  it("carries provenance on every row", async () => {
    const { count } = await admin
      .from("state_label_rules")
      .select("program_id", { count: "exact", head: true })
      .or("source_url.is.null,source_checked_at.is.null");
    expect(count).toBe(0);
  });

  it("lands unverified — it is a summary of the law, not the law", async () => {
    const { count } = await admin
      .from("state_label_rules")
      .select("program_id", { count: "exact", head: true })
      .not("verified_at", "is", null);
    expect(count).toBe(0);
  });

  it("stores Texas's disclaimer exactly as the statute reads", async () => {
    // Corrected against Texas Health & Safety Code §437.0193(b)(2) — the seeded summary carried
    // materially different wording, which would have been printed onto food.
    const { data } = await admin
      .from("state_label_rules")
      .select("disclaimer_text, disclaimer_all_caps, state_food_programs!inner(state_code)")
      .eq("state_food_programs.state_code", "TX")
      .single();
    expect(data?.disclaimer_text).toBe(
      "THIS PRODUCT WAS PRODUCED IN A PRIVATE RESIDENCE THAT IS NOT SUBJECT TO GOVERNMENTAL LICENSING OR INSPECTION.",
    );
    expect(data?.disclaimer_all_caps).toBe(true);
  });

  it("records that Texas answers the delivery question the seed left open", async () => {
    // §437.0194(b)(1): an internet sale is permitted only if the operator, an employee or a
    // household member personally delivers it — so delivery is required, and couriers are not.
    const { data } = await admin
      .from("state_food_programs")
      .select("direct_delivery, mail_delivery, verified_at")
      .eq("state_code", "TX")
      .single();
    expect(data?.direct_delivery).toBe("allowed");
    expect(data?.mail_delivery).toBe("banned");
    // Corrections are ours; the sign-off is still an admin's.
    expect(data?.verified_at).toBeNull();
  });

  it("keeps New Hampshire's two programs on different disclaimers", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("disclaimer_text, state_food_programs!inner(state_code, name)")
      .eq("state_food_programs.state_code", "NH");

    const byName = new Map(
      (data ?? []).map((r) => [
        (r.state_food_programs as unknown as { name: string }).name,
        r.disclaimer_text,
      ]),
    );
    expect(byName.get("New Hampshire Exempt Home Food Operations")).toMatch(/exempt from New Hampshire/);
    // "NH DHHS" was our abbreviation. RSA 143-A:12 IV names the agency in full, and on a label an
    // agency's initials are not a shorthand for its name — they are a different sentence.
    expect(byName.get("New Hampshire Homestead")).toMatch(
      /licensed by the New Hampshire Department of Health and Human Services/,
    );
  });

  it("records the states that need a point-of-sale placard", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("state_food_programs!inner(state_code)")
      .eq("placard_required", true);
    const states = [
      ...new Set(
        (data ?? []).map((r) => (r.state_food_programs as unknown as { state_code: string }).state_code),
      ),
    ].sort();
    // Both changes here came from reading the statutes, and the old list was the summary's.
    // CO gained one: Colo. Rev. Stat. 25-4-1614(3)(c) requires a placard "at the point of sale",
    // carrying SHORTER text than the label disclaimer at (3)(a)(V).
    // AK lost one: AS 17.20.332 puts the information on the package and, for unpackaged food,
    // obliges the producer to tell the buyer — a disclosure, but not a written placard.
    // IL gained one too: 410 ILCS 625/4(b)(10) requires a point-of-sale notice, "At a physical
    // display ... a placard", carrying SHORTER text than the label phrase at (b)(7)(E) — the same
    // label/placard split Colorado has. Online, the same paragraph makes it a message on the sales
    // interface, which is why Illinois is also predisclosure_required.
    // MO left: Mo. Rev. Stat. 196.298.4 puts the statement on the LABEL and prescribes no sign at
    // the point of sale. The placard text we held was an invented paraphrase.
    // NJ and NM joined on reading their rules: N.J.A.C. 8:24-11.4(b) requires a placard wherever the
    // point of sale is not a residence, and N.M. Stat. 25-12-3(B)(3) makes one of five ways the
    // required information may reach the consumer.
    // ND joined: N.D. Cent. Code 23-09.5-02(8) offers "a consumer advisory sign at the point of
    // sale" as the alternative to a label — the same either/or shape as Idaho's.
    // OK joined: Okla. Stat. tit. 2 5-4.2(B)(3) requires a placard at the point of sale for
    // unpackaged food, alongside a carriable card.
    // TN joined: Tenn. Code 53-1-118(b)(5)(A)(iii) requires the (b)(4) information "On a placard
    // displayed at the point of sale, if the homemade food item is neither packaged nor offered for
    // sale from a bulk container". Unlike CO and IL it prescribes no separate, shorter sign text —
    // the placard carries the same information as the label — so its placard_text stays null.
    // WI joined: Wis. Stat. 97.29(2)(b)2.d requires the home canner to display "a sign at the place
    // of sale stating: 'These canned goods are homemade and not subject to state inspection.'" —
    // a DIFFERENT sentence from the label statement at 2.e, the third state found with that split
    // after CO and IL.
    expect(states).toEqual(["CO", "ID", "IL", "MN", "ND", "NE", "NJ", "NM", "OK", "TN", "WI"]);
  });

  it("records the states that reach the buyer before payment", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("state_food_programs!inner(state_code)")
      .eq("predisclosure_required", true);
    const states = [
      ...new Set(
        (data ?? []).map((r) => (r.state_food_programs as unknown as { state_code: string }).state_code),
      ),
    ].sort();
    // Four states, four different routes to the same place, each verified against its own text.
    // CA — Health & Saf. Code 114365.3(f), disclosures required in internet advertising.
    // IL — 410 ILCS 625/4(b)(10), "Online, notice shall be a message on the cottage food
    //      operation's online sales interface at the point of sale." The only one that legislates
    //      the checkout page in those words.
    // IN — Ind. Code 16-42-5.3-5(b), "A home based vendor shall post the label of each food
    //      product on the vendor's website." The whole label, per product — the most this pass
    //      has found any state ask for before a sale.
    // NE — the disclaimer in any internet advertising (from the summary, not yet the statute).
    // TX — §437.0194(b)(2), labelling information "before the operator accepts payment".
    // Every other state is false because NOBODY HAS CHECKED, not because the state has no rule.
    // MN — Minn. Stat. 28A.152 subd. 2(d), "The statement ... must be displayed on the website
    //      that offers the exempt foods for purchase." The same sentence expressly permits internet
    //      selling and restricts delivery to the person who made the food.
    // NM — N.M. Stat. 25-12-3(B)(4) requires the whole (C) information set "on a webpage on which
    //      the homemade food item is offered for sale". The most explicit of the seven.
    // OK — 5-4.2(B)(4), "Displayed on the webpage from which the homemade food product is offered
    //      for sale if it is sold on the Internet".
    // TN — 53-1-118(b)(5)(A)(iv), "On the webpage on which the homemade food item is offered for
    //      sale, if the homemade food item is offered only for sale on the internet". It names the
    //      listing page, and the information it names is (b)(4) in full.
    // UT — the Home Consumption and Homemade Food Act reaches it from a direction no other state
    //      does. Utah Code 4-5a-104(1) exempts a producer only where the food is "sold directly to
    //      an informed final consumer", and 4-5a-102(7)(c) defines that person as one who "has
    //      been informed that the product is not certified, licensed, regulated, or inspected by
    //      the state" — so being told is a PRECONDITION OF THE EXEMPTION, not a labelling duty.
    //      Only Utah ordinal 2; the cottage food and microenterprise routes are false.
    // WY — the same shape as Utah, and the last row in the pass. Wyo. Stat. 11-49-102(a)(v)
    //      defines the "informed end consumer" as one "who has been informed that the product is
    //      not licensed, regulated or inspected", and 11-49-103(e) makes telling them the
    //      producer's duty — so the disclosure precedes the transaction the Act permits.
    expect(states).toEqual(["CA", "IL", "IN", "MN", "NE", "NM", "OK", "TN", "TX", "UT", "WY"]);
  });

  it("records the states that want metric alongside imperial", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("state_food_programs!inner(state_code)")
      .eq("metric_required", true);
    const states = [
      ...new Set(
        (data ?? []).map((r) => (r.state_food_programs as unknown as { state_code: string }).state_code),
      ),
    ].sort();
    // TN left: Tenn. Code 53-1-118(a) exempts homemade food from "all licensing, permitting,
    // inspecting, packaging, and labeling laws of this state", and (b)(4) — the whole of what the
    // chapter asks for — has no weight statement in it at all. The metric requirement we held came
    // from Rule 0080-04-11, the domestic-kitchen scheme repealed by 2022 Pub. Ch. 862 § 5.
    expect(states).toEqual(["CT", "NC"]);
  });

  it("leaves a note wherever no requirements are recorded", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("required_elements, disclaimer_text, notes");
    const blank = (data ?? []).filter(
      (r) => (r.required_elements as string[]).length === 0 && !r.disclaimer_text,
    );
    expect(blank.length).toBeGreaterThan(0);
    expect(blank.every((r) => !!r.notes)).toBe(true);
  });

  it("refuses an element name outside the known vocabulary", async () => {
    const { data: program } = await admin.from("state_food_programs").select("id").limit(1).single();
    const { error } = await admin
      .from("state_label_rules")
      .update({ required_elements: ["product_name", "lucky_charm"] })
      .eq("program_id", program!.id);
    expect(error).not.toBeNull();
  });

  /**
   * A required element that can never carry a value makes the label permanently unprintable.
   *
   * `nutrition_if_claimed` is the only element in the vocabulary that `valueFor()` always resolves
   * to null — a nutrition panel needs per-serving figures nothing here collects. It sat in
   * `required_elements` for fourteen rules across ten states, so `canPrint()` was false for every
   * seller in all of them. It belongs in `optional_elements`, which never blocks.
   */
  it("never requires an element that can never be satisfied", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("required_elements, state_food_programs!inner(state_code)");
    const offenders = (data ?? [])
      .filter((r) => (r.required_elements as string[]).includes("nutrition_if_claimed"))
      .map((r) => (r.state_food_programs as unknown as { state_code: string }).state_code);
    expect(offenders).toEqual([]);
  });

  it("stores Utah's two words of prescribed label text, and its two seller-written statements", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select(
        "disclaimer_text, disclaimer_min_pt, required_elements, seller_statement_prompt, state_food_programs!inner(state_code, ordinal)",
      )
      .eq("state_food_programs.state_code", "UT");

    const byOrdinal = new Map(
      (data ?? []).map((r) => [
        (r.state_food_programs as unknown as { ordinal: number }).ordinal,
        r,
      ]),
    );

    // Cottage food: Utah Admin. Code R70-560-6(2)(h) requires "the words 'Home Produced' in bold
    // and conspicuous 12-point type on the principal display panel" — prescribed wording, so it is
    // the disclaimer rather than a statement the seller writes.
    expect(byOrdinal.get(1)?.disclaimer_text).toBe("Home Produced");
    expect(byOrdinal.get(1)?.disclaimer_min_pt).toBe(12);

    // The other two prescribe substance and leave the wording, so they get a prompt and no
    // disclaimer — our sentence must never end up in the column that holds quoted law.
    for (const ordinal of [2, 3]) {
      expect(byOrdinal.get(ordinal)?.disclaimer_text).toBeNull();
      expect(byOrdinal.get(ordinal)?.required_elements).toContain("seller_statement");
      expect(byOrdinal.get(ordinal)?.seller_statement_prompt).toBeTruthy();
    }
  });

  /**
   * Utah's three routes are mutually exclusive by statute — § 26B-7-401(15)(b)(ii) says a
   * microenterprise home kitchen "does not include ... a cottage food operation" — and they answer
   * to different regulators. Getting `local_preemption` wrong on the microenterprise row would tell
   * a seller their county has no say, when their county issues the permit.
   */
  it("keeps Utah's three routes distinct about who regulates them", async () => {
    const { data } = await admin
      .from("state_food_programs")
      .select("ordinal, local_preemption, license_required, online_orders")
      .eq("state_code", "UT")
      .order("ordinal");

    expect(data?.map((p) => p.local_preemption)).toEqual([true, true, false]);
    expect(data?.map((p) => p.license_required)).toEqual(["yes", "no", "yes"]);
    // None of the three bodies of law mentions internet selling in either direction. `unclear` does
    // not block a listing — it records that nobody answered, which the seed asserted otherwise.
    expect(data?.map((p) => p.online_orders)).toEqual(["unclear", "unclear", "unclear"]);
  });

  /**
   * Vermont, where the same statement is required on two rows and would be a lie on the other two.
   *
   * Manufactured Food Rule 6.2.1 is headed "Labeling Requirements for License Exempt Food
   * Manufacturing Establishments", and 6.2.1.1.7 is where "Made in a home kitchen not inspected by
   * the Vermont Department of Health" comes from. The home bakery and home caterer routes are
   * licensed and inspected, so printing it there would put a false statement on food — the same
   * reasoning that emptied Maryland's on-farm row.
   */
  it("puts Vermont's home-kitchen statement only on the license-exempt routes", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("disclaimer_text, state_food_programs!inner(state_code, ordinal)")
      .eq("state_food_programs.state_code", "VT");

    const byOrdinal = new Map(
      (data ?? []).map((r) => [
        (r.state_food_programs as unknown as { ordinal: number }).ordinal,
        r.disclaimer_text,
      ]),
    );

    // 1 = licensed home bakery, 3 = licensed home caterer.
    expect(byOrdinal.get(1)).toBeNull();
    expect(byOrdinal.get(3)).toBeNull();
    // 2 = non-bakery exempt at $10,000, 4 = cottage food exempt at $30,000.
    for (const ordinal of [2, 4]) {
      expect(byOrdinal.get(ordinal)).toMatch(/not inspected by the Vermont Department of Health/);
    }
  });

  /**
   * A licensing threshold is not a revenue cap, and putting one in the cap column closes a
   * storefront. `record_order_revenue()` pauses on `state_cottage_food_rules.revenue_cap`;
   * 18 V.S.A. 4358(b) removes only "the obligation to obtain a license and the associated licensure
   * fees" above Vermont's $30,000. Crossing it means get a licence, not stop selling.
   */
  it("keeps Vermont's $30,000 out of the column that pauses storefronts", async () => {
    const { data: rule } = await admin
      .from("state_cottage_food_rules")
      .select("revenue_cap")
      .eq("state_code", "VT")
      .single();
    expect(rule?.revenue_cap).toBeNull();

    const { data: programs } = await admin
      .from("state_food_programs")
      .select("ordinal, revenue_cap, license_threshold")
      .eq("state_code", "VT")
      .order("ordinal");
    // No Vermont route caps sales at all …
    expect((programs ?? []).every((p) => p.revenue_cap === null)).toBe(true);
    // … and the two figures that exist are licensing thresholds on the two exempt routes.
    const thresholds = new Map((programs ?? []).map((p) => [p.ordinal, p.license_threshold]));
    expect(thresholds.get(2)).toBe(10000);
    expect(thresholds.get(4)).toBe(30000);
  });

  /**
   * The end of the alphabetical pass: every one of the 51 jurisdictions has now been read against
   * primary text, and the thing that recurred most was a disclaimer quietly tidied — a dash added,
   * a full stop added, a sentence sentence-cased, or another state's statute inherited wholesale.
   *
   * These four are the ones the last batch caught. `disclaimer_text` is quoted law printed onto food
   * without review, so an exact-match assertion is the right shape here: a diff that changes one of
   * these strings should be loud.
   */
  it("stores the last four disclaimers exactly as their statutes read", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("disclaimer_text, state_food_programs!inner(state_code, ordinal)")
      .in("state_food_programs.state_code", ["VA", "WI", "WY"]);

    const byKey = new Map<string, string | null>(
      (data ?? []).map((r) => {
        const p = r.state_food_programs as unknown as { state_code: string; ordinal: number };
        return [`${p.state_code}${p.ordinal}`, r.disclaimer_text];
      }),
    );

    // Va. Code 3.2-5130(C)(3)(v). The hyphen we used to store is not in the statute.
    expect(byKey.get("VA1")).toBe("NOT FOR RESALE PROCESSED AND PREPARED WITHOUT STATE INSPECTION.");
    // Wyo. Stat. 11-49-103(k) quotes it in lower case with no closing period.
    expect(byKey.get("WY1")).toBe(
      "this food was made in a home kitchen, is not regulated or inspected and may contain allergens",
    );
    // Wis. Stat. 97.29(2)(b)2.e — and only on the canning route, which is the one with a statute.
    expect(byKey.get("WI2")).toBe(
      "This product was made in a private home not subject to state licensing or inspection.",
    );
    expect(byKey.get("WI1")).toBeNull();
  });

  /**
   * Rows that inherited a disclaimer they have no authority for.
   *
   * Virginia's licensed route is inspected, so the "WITHOUT STATE INSPECTION" statement would be
   * false on it. West Virginia's row carried Tennessee's statutory sentence outright — W. Va. Code
   * 19-35-6(c) delegates labelling to "the department's labeling standards" and prescribes nothing.
   */
  it("leaves no disclaimer on a row whose own law prescribes none", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("disclaimer_text, state_food_programs!inner(state_code, ordinal)")
      .in("state_food_programs.state_code", ["VA", "WV"]);

    for (const row of data ?? []) {
      const p = row.state_food_programs as unknown as { state_code: string; ordinal: number };
      if (p.state_code === "WV" || (p.state_code === "VA" && p.ordinal === 2)) {
        expect(row.disclaimer_text).toBeNull();
      }
    }
  });

  /**
   * Virginia is the `per_category` example again, and at the right number this time.
   *
   * 2026 c. 605 left Va. Code 3.2-5130(C)(3) with no gross sales limit; the $9,000 survives only in
   * (C)(4), on pickles and other acidified vegetables. A state-wide cap would pause a Virginian
   * selling nothing but jam and bread.
   */
  it("applies Virginia's $9,000 to acidified food only", async () => {
    const { data: stateRule } = await admin
      .from("state_cottage_food_rules")
      .select("revenue_cap")
      .eq("state_code", "VA")
      .single();
    expect(stateRule?.revenue_cap).toBeNull();

    const { data: program } = await admin
      .from("state_food_programs")
      .select("revenue_cap, cap_basis, cap_category")
      .eq("state_code", "VA")
      .eq("ordinal", 1)
      .single();
    expect(program?.revenue_cap).toBe(9000);
    expect(program?.cap_basis).toBe("per_category");
    expect(program?.cap_category).toBe("acidified");
  });

  /**
   * The last two inherited disclaimers.
   *
   * California chapter 11.6 (MEHKO) contains the word "label" zero times and Maine's Food
   * Sovereignty Act has no labelling provision either — yet both rows carried another programme's
   * requirements. California's is emptied because the answer is "nothing is required"; Maine's
   * keeps its elements flagged as unsourced because the answer is "a municipal ordinance decides,
   * and we cannot see it from here". Those are different answers and the rows say so.
   */
  it("prescribes no label where the state prescribes none", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("required_elements, disclaimer_text, notes, state_food_programs!inner(state_code, ordinal)")
      .eq("state_food_programs.state_code", "CA")
      .eq("state_food_programs.ordinal", 3)
      .single();

    expect(data?.required_elements).toEqual([]);
    expect(data?.disclaimer_text).toBeNull();
    expect(data?.notes).toMatch(/114367/);
    // The statement it used to carry belongs to Class A and Class B, not to this chapter.
    expect(data?.notes).toMatch(/114365.3/);
  });

  it("names the section for every rule that describes one", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("notes, state_food_programs!inner(state_code, ordinal)")
      .in("state_food_programs.state_code", ["OR", "ME"]);

    const by = new Map(
      (data ?? []).map((r) => {
        const p = r.state_food_programs as unknown as { state_code: string; ordinal: number };
        return [`${p.state_code}${p.ordinal}`, r.notes ?? ""];
      }),
    );
    // Oregon drafted its home-baking exemption as a waiver of inspection, which is why the section
    // was recorded by description for so long.
    expect(by.get("OR1")).toMatch(/616.718/);
    // Farm Direct's labelling is not in the statute at all — it is in the rules under 616.686.
    expect(by.get("OR2")).toMatch(/616.683/);
    expect(by.get("OR2")).toMatch(/616.686/);
    expect(by.get("ME2")).toMatch(/8-F/);
  });

  // -- RLS -------------------------------------------------------------------
  it("is readable by anyone — a buyer can check what a label should carry", async () => {
    const { data } = await anonDb().from("state_label_rules").select("program_id").limit(1);
    expect((data ?? []).length).toBe(1);
  });

  it("a seller cannot rewrite a disclaimer", async () => {
    const { data: program } = await admin.from("state_food_programs").select("id").limit(1).single();
    const { data: before } = await admin
      .from("state_label_rules")
      .select("disclaimer_text")
      .eq("program_id", program!.id)
      .single();

    await sellerUser.db
      .from("state_label_rules")
      .update({ disclaimer_text: "Totally inspected, trust me" })
      .eq("program_id", program!.id);

    const { data: after } = await admin
      .from("state_label_rules")
      .select("disclaimer_text")
      .eq("program_id", program!.id)
      .single();
    expect(after?.disclaimer_text).toBe(before?.disclaimer_text);
  });

  it("an admin can correct one", async () => {
    const { data: program } = await admin.from("state_food_programs").select("id").limit(1).single();
    const { data: before } = await admin
      .from("state_label_rules")
      .select("notes")
      .eq("program_id", program!.id)
      .single();

    const { error } = await adminUser.db
      .from("state_label_rules")
      .update({ notes: "IT touched this" })
      .eq("program_id", program!.id);
    expect(error).toBeNull();

    await admin
      .from("state_label_rules")
      .update({ notes: before?.notes ?? null })
      .eq("program_id", program!.id);
  });
});
