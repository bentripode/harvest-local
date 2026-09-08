import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, cleanupAll, describeDb, type Db } from "./helpers";

/**
 * What the sweep found, pinned so it cannot drift back.
 *
 * `scripts/verify-disclaimers.mjs` checks all 55 quoted-law strings against the documents they cite,
 * over the network. That cannot run here — CI has no business fetching thirty statute sites — so
 * this holds the specific corrections it produced, which is the part a future edit could undo.
 */
describeDb("disclaimers corrected by the sweep", () => {
  let admin: Db;

  beforeAll(() => {
    admin = adminDb();
  });

  afterAll(cleanupAll);

  async function disclaimerFor(state: string, ordinal: number): Promise<string | null> {
    const { data } = await admin
      .from("state_label_rules")
      .select("disclaimer_text, state_food_programs!inner(state_code, ordinal)")
      .eq("state_food_programs.state_code", state)
      .eq("state_food_programs.ordinal", ordinal)
      .single();
    return data?.disclaimer_text ?? null;
  }

  /**
   * Cal. Health & Saf. Code 114365.3(e)(1) requires "The words 'Made in a Home Kitchen' or
   * 'Repackaged in a Home Kitchen,' as applicable". No full stop inside the quotation marks — we had
   * added one, and it was printing at 12 point on the primary display panel.
   */
  it("California quotes the words without the full stop we had added", async () => {
    for (const ordinal of [1, 2]) {
      const text = await disclaimerFor("CA", ordinal);
      expect(text).toBe("Made in a Home Kitchen");
      expect(text?.endsWith(".")).toBe(false);
    }
  });

  /**
   * Colorado said "may also contain common food allergies" where 25-4-1614(3)(a)(V) says "may also
   * process common food allergens" — a different claim, not a tidier wording.
   */
  it("Colorado processes allergens rather than containing allergies", async () => {
    const text = await disclaimerFor("CO", 1);
    expect(text).toContain("may also process common food allergens");
    expect(text).not.toContain("allergies");
  });

  /**
   * Two rows cited documents that could not contain their own disclaimer: Colorado's pointed at the
   * amending bill, which reproduces only the subsections it amends, and Indiana's at a chapter index
   * of section headings. Both are the same failure — a citation that is right and a URL that is not
   * the thing cited — and the sweep is what makes it visible.
   */
  it("sends Colorado and Indiana at documents that contain the sentence", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("source_url, state_food_programs!inner(state_code, ordinal)")
      .in("state_food_programs.state_code", ["CO", "IN"]);

    const by = new Map(
      (data ?? []).map((r) => {
        const p = r.state_food_programs as unknown as { state_code: string; ordinal: number };
        return [`${p.state_code}:${p.ordinal}`, r.source_url as string];
      }),
    );

    // The code volume, not bill_files — an amending bill carries only what it amends.
    expect(by.get("CO:1")).toContain("crs2024-title-25.pdf");
    expect(by.get("CO:1")).not.toContain("bill_files");
    // The section, not the chapter index.
    expect(by.get("IN:1")).toContain("section-16-42-5-3-5");
  });

  /**
   * A disclaimer is quoted law, so it should never carry our own formatting. This is a cheap
   * standing check on all 45 of them rather than a claim about any one state.
   */
  it("stores no disclaimer with stray whitespace", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("disclaimer_text, placard_text, state_food_programs!inner(state_code, ordinal)");

    const offenders: string[] = [];
    for (const r of data ?? []) {
      const p = r.state_food_programs as unknown as { state_code: string; ordinal: number };
      for (const [field, value] of [
        ["disclaimer", r.disclaimer_text],
        ["placard", r.placard_text],
      ] as const) {
        if (!value) continue;
        if (value !== value.trim() || /\s{2,}/.test(value) || /[\r\n\t]/.test(value)) {
          offenders.push(`${p.state_code}:${p.ordinal}/${field}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * The second pass, which chased every open row to primary text.
 *
 * Four kinds of fault turned up, and each is pinned below because each could quietly return: an
 * added full stop, an expanded abbreviation, an invented placard sentence, and a statement borrowed
 * from a sibling programme.
 */
describeDb("disclaimers corrected by the sweep follow-up", () => {
  let admin: Db;

  beforeAll(() => {
    admin = adminDb();
  });

  afterAll(cleanupAll);

  async function rule(state: string, ordinal: number) {
    const { data } = await admin
      .from("state_label_rules")
      .select(
        "disclaimer_text, placard_text, placard_required, source_url, state_food_programs!inner(state_code, ordinal)",
      )
      .eq("state_food_programs.state_code", state)
      .eq("state_food_programs.ordinal", ordinal)
      .single();
    return data;
  }

  /**
   * He-P 2300 (7) quotes the sentence without a full stop, and (h) prescribes the ABBREVIATION
   * "NH DHHS" — we had expanded it to the department's full name and added a period. The expansion
   * matters beyond fidelity: the rule fixes a minimum font size, and a label has finite room.
   */
  it("New Hampshire carries the STATUTE's wording, not the rule's paraphrase", async () => {
    // RSA 143-A:12 V(c)(1) — the full stop is inside the quotation marks. He-P 2300 (7) renders it
    // without one, and following the rule removed a period that belonged there.
    expect((await rule("NH", 1))?.disclaimer_text).toBe(
      "This product is exempt from New Hampshire licensing and inspection.",
    );
    // V(c)(2) — "residential food production area", and the agency named in full. The rule says
    // "residential kitchen licensed by NH DHHS"; a rule cannot rewrite a sentence the legislature
    // prescribed verbatim, and the statute is the later text.
    const homestead = (await rule("NH", 2))?.disclaimer_text;
    expect(homestead).toBe(
      "This product is made in a residential food production area licensed by the New Hampshire Department of Health and Human Services.",
    );
    expect(homestead).not.toContain("NH DHHS");
  });

  /**
   * AS 17.20.332 requires "a sign indicating that" three facts — substance, no wording. The stored
   * all-caps sentence appeared nowhere in the section, exactly like the Missouri placard removed
   * earlier. A required sign with no prescribed text is null text and a true flag.
   */
  it("Alaska requires a sign without prescribing its words", async () => {
    const ak = await rule("AK", 1);
    expect(ak?.placard_text).toBeNull();
    expect(ak?.placard_required).toBe(true);
    // The disclaimer on the same row verified exact and must not have been collateral damage.
    expect(ak?.disclaimer_text).toContain("made in a home kitchen");
  });

  /**
   * KRS 217.137 prescribes no label at all, and 902 KAR 45:090(4) sends a microprocessor to general
   * law. The sentence stored here belonged to KRS 217.136(3)(e), which governs a home-based
   * PROCESSOR — a different operator. The processor's own row keeps it.
   */
  it("Kentucky stops lending the processor's sentence to the microprocessor", async () => {
    expect((await rule("KY", 1))?.disclaimer_text).toBe(
      "This product is home-produced and processed",
    );
    expect((await rule("KY", 2))?.disclaimer_text).toBeNull();
  });

  /**
   * Three rows cited documents that could not contain their own sentence — an amending chapter, a
   * chapter index, and a regulation that delegates. The same fault as Colorado's and Indiana's.
   */
  it("cites documents that carry the sentence, not ones that merely govern the topic", async () => {
    // 2022 Pub. Ch. 862 has the statement; 2025 Pub. Ch. 431 only renumbers.
    expect((await rule("TN", 1))?.source_url).toContain("acts/112/pub/pc0862");
    // The state's own chapter text, not a chapter index of headings.
    expect((await rule("IA", 2))?.source_url).toContain("legis.iowa.gov");
    // KRS 217.136 itself, not the regulation that points at it.
    expect((await rule("KY", 1))?.source_url).toContain("statute.aspx");
  });
});
