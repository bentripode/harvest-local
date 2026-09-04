import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, anonDb, cleanupAll, createTestUser, describeDb, type TestUser } from "./helpers";

/**
 * `state_cottage_food_rules` — publicly readable, admin-writable.
 *
 * These rows decide when `record_order_revenue` auto-pauses a storefront for the rest of the year,
 * so who may edit them is a real guardrail: a seller who could raise their own cap could sell past
 * their state's legal limit.
 */
describeDb("state cottage-food rules", () => {
  let sellerUser: TestUser;
  let adminUser: TestUser;
  const state = "TX";
  let original: { revenue_cap: string | null; verified_at: string | null };

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: state });
    adminUser = await createTestUser({ role: "admin", homeState: state });

    const { data } = await adminDb()
      .from("state_cottage_food_rules")
      .select("revenue_cap, verified_at")
      .eq("state_code", state)
      .single();
    original = data!;
  });

  afterAll(async () => {
    // Put the row back exactly as it was — this table is shared reference data, not a fixture.
    await adminDb()
      .from("state_cottage_food_rules")
      .update({ revenue_cap: original.revenue_cap, verified_at: original.verified_at })
      .eq("state_code", state);
    await cleanupAll();
  });

  it("a logged-out visitor can read the rules", async () => {
    const { data } = await anonDb()
      .from("state_cottage_food_rules")
      .select("state_code")
      .eq("state_code", state);
    expect(data).toHaveLength(1);
  });

  it("a seller cannot raise their own state's cap", async () => {
    const { error } = await sellerUser.db
      .from("state_cottage_food_rules")
      .update({ revenue_cap: "999999.00" })
      .eq("state_code", state);

    // RLS filters the row out rather than erroring, so assert on the outcome, not the error.
    const { data } = await adminDb()
      .from("state_cottage_food_rules")
      .select("revenue_cap")
      .eq("state_code", state)
      .single();
    expect(data?.revenue_cap).toBe(original.revenue_cap);
    expect(error).toBeNull();
  });

  it("a seller cannot insert a rule for a state that has none", async () => {
    const { error } = await sellerUser.db
      .from("state_cottage_food_rules")
      .insert({ state_code: "ZZ", revenue_cap: "1.00" });
    expect(error).not.toBeNull();
  });

  it("an admin can set the cap and stamp it verified", async () => {
    const verifiedAt = new Date().toISOString();
    const { error } = await adminUser.db
      .from("state_cottage_food_rules")
      .update({ revenue_cap: "12345.00", verified_at: verifiedAt, verified_by: adminUser.id })
      .eq("state_code", state);
    expect(error).toBeNull();

    const { data } = await adminDb()
      .from("state_cottage_food_rules")
      .select("revenue_cap, verified_at")
      .eq("state_code", state)
      .single();
    expect(Number(data?.revenue_cap)).toBe(12345);
    expect(data?.verified_at).not.toBeNull();
  });
});
