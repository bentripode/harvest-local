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
