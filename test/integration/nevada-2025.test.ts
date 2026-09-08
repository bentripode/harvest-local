import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, cleanupAll, describeDb, type Db } from "./helpers";

/**
 * Nevada after the 2025 rewrite, which repealed the chapter three of our rows rested on.
 *
 * Two acts, doing opposite things on different dates, and getting them the wrong way round would
 * have unblocked selling that is still unlawful:
 *
 *   SB 466 — ch. 512, Statutes of Nevada 2025, IN FORCE since 2025-07-01. Repealed NRS 446.0145
 *   through 446.945 outright and rebuilt the scheme under the State Department of Agriculture.
 *
 *   AB 352 — ch. 420, Statutes of Nevada 2025, effective 2027-07-01 for every substantive purpose
 *   (§ 29(2)(b)). NOT law yet.
 */
describeDb("Nevada after the 2025 rewrite", () => {
  let admin: Db;

  beforeAll(() => {
    admin = adminDb();
  });

  afterAll(cleanupAll);

  /**
   * The cap was wrong by $65,000 in the column that PAUSES STOREFRONTS. SB 466 § 22 raised the
   * limit from $35,000 to $100,000; both rows still said $35,000, so `record_order_revenue` would
   * have paused a Nevada storefront at less than half the lawful figure.
   */
  it("carries the $100,000 cap SB 466 set, in both places it is stored", async () => {
    const { data: program } = await admin
      .from("state_food_programs")
      .select("revenue_cap")
      .eq("state_code", "NV")
      .single();
    const { data: rule } = await admin
      .from("state_cottage_food_rules")
      .select("revenue_cap")
      .eq("state_code", "NV")
      .single();

    expect(Number(program?.revenue_cap)).toBe(100000);
    expect(Number(rule?.revenue_cap)).toBe(100000);
  });

  /**
   * The state rule was ADMIN-VERIFIED against $35,000 on 2026-09-05 — a signature on a figure that
   * had been superseded fourteen months earlier, because the reading was done in a compilation
   * rather than the session laws. Changing the number while keeping the attestation would present
   * our reading as a person's, so it is cleared and there is something for an admin to re-save.
   */
  it("clears the signature that was given to the superseded figure", async () => {
    const { data } = await admin
      .from("state_cottage_food_rules")
      .select("verified_at, verified_by")
      .eq("state_code", "NV")
      .single();
    expect(data?.verified_at).toBeNull();
    expect(data?.verified_by).toBeNull();
  });

  /**
   * The ban is RIGHT and its citation was dead. SB 466 § 22(1)(a) carries the restriction forward
   * word for word, so nothing about what a Nevada seller may do has changed — but the row cited a
   * section that has not existed since 2025-07-01, and a right answer resting on a repealed
   * provision is one amendment away from being a wrong answer nobody notices.
   */
  it("keeps the online ban, now resting on law that exists", async () => {
    const { data } = await admin
      .from("state_food_programs")
      .select("online_orders, venue_note, source_url")
      .eq("state_code", "NV")
      .single();

    expect(data?.online_orders).toBe("banned");
    expect(data?.source_url).toContain("SB466_EN");
    expect(data?.source_url).not.toContain("NRS-446");
    // The note has to carry the reversal date, because the schema cannot.
    expect(data?.venue_note).toContain("2027-07-01");
    expect(data?.venue_note).toContain("SB 466");
  });

  /**
   * The disclaimer survived the rewrite unchanged — SB 466 § 22(1)(d) prescribes the same sentence,
   * and AB 352 carries it forward again. Only the citation moved. The sweep reported NOT FOUND
   * because the old chapter page is now nothing but repeal notices, which is the checker working.
   */
  it("keeps the disclaimer and moves it onto the live authority", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("disclaimer_text, source_url, state_food_programs!inner(state_code)")
      .eq("state_food_programs.state_code", "NV")
      .single();

    expect(data?.disclaimer_text).toBe(
      "MADE IN A COTTAGE FOOD OPERATION THAT IS NOT SUBJECT TO GOVERNMENT FOOD SAFETY INSPECTION",
    );
    // No trailing period: § 22(1)(d) closes the quotation before "printed prominently".
    expect(data?.disclaimer_text?.endsWith(".")).toBe(false);
    expect(data?.source_url).toContain("SB466_EN");
  });
});
