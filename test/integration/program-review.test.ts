import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, cleanupAll, createTestUser, describeDb, type Db, type TestUser } from "./helpers";

/**
 * Reviewing and verifying a state food program.
 *
 * `verified_at` is the one thing standing between seeded data and gates that pause real storefronts
 * and print legal labels. It is set by a person saving the review form and by nothing else — no
 * seed, no backfill, no job — so what matters here is who can set it and that the constraints still
 * refuse a nonsensical program.
 */
describeDb("program review", () => {
  let admin: Db;
  let adminUser: TestUser;
  let sellerUser: TestUser;
  let programId: string;
  let original: Record<string, unknown>;

  beforeAll(async () => {
    admin = adminDb();
    adminUser = await createTestUser({ role: "admin", homeState: "TX" });
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });

    const { data } = await admin
      .from("state_food_programs")
      .select("*")
      .eq("state_code", "TX")
      .eq("ordinal", 1)
      .single();
    programId = data!.id;
    original = data!;
  });

  afterAll(async () => {
    // Shared reference data — put it back exactly as seeded.
    await admin
      .from("state_food_programs")
      .update({
        online_orders: original.online_orders,
        cat_meat: original.cat_meat,
        revenue_cap: original.revenue_cap,
        cap_basis: original.cap_basis,
        cap_category: original.cap_category,
        verified_at: null,
        verified_by: null,
      })
      .eq("id", programId);
    await cleanupAll();
  });

  it("an admin can save a correction and stamp it verified", async () => {
    const now = new Date().toISOString();
    const { error } = await adminUser.db
      .from("state_food_programs")
      .update({ cat_meat: "conditional", verified_at: now, verified_by: adminUser.id })
      .eq("id", programId);
    expect(error).toBeNull();

    const { data } = await admin
      .from("state_food_programs")
      .select("cat_meat, verified_at, verified_by")
      .eq("id", programId)
      .single();
    expect(data?.cat_meat).toBe("conditional");
    expect(data?.verified_at).not.toBeNull();
    expect(data?.verified_by).toBe(adminUser.id);
  });

  it("the gates read the correction immediately", async () => {
    // Texas bans meat as seeded; the line above changed it to conditional, which is permitted.
    const { data } = await admin.rpc("state_permits_food_axis", {
      p_state_code: "TX",
      p_axis: "meat",
    });
    expect(data).toBe(true);
  });

  it("a seller cannot verify a program", async () => {
    await admin
      .from("state_food_programs")
      .update({ verified_at: null, verified_by: null })
      .eq("id", programId);

    await sellerUser.db
      .from("state_food_programs")
      .update({ verified_at: new Date().toISOString(), verified_by: sellerUser.id })
      .eq("id", programId);

    const { data } = await admin
      .from("state_food_programs")
      .select("verified_at")
      .eq("id", programId)
      .single();
    expect(data?.verified_at).toBeNull();
  });

  it("refuses a per-category cap that names no category", async () => {
    const { error } = await admin
      .from("state_food_programs")
      .update({ cap_basis: "per_category", cap_category: null, revenue_cap: "3000.00" })
      .eq("id", programId);
    expect(error).not.toBeNull();
  });

  it("refuses a cap category outside the six axes", async () => {
    const { error } = await admin
      .from("state_food_programs")
      .update({ cap_basis: "per_category", cap_category: "pastry" })
      .eq("id", programId);
    expect(error).not.toBeNull();
  });

  it("refuses an unknown value in a gate column", async () => {
    const { error } = await admin
      .from("state_food_programs")
      .update({ license_required: "probably" })
      .eq("id", programId);
    expect(error).not.toBeNull();
  });

  it("nothing but a review sets verified_at — the seed left all 69 null", async () => {
    // Every row this suite didn't deliberately stamp is still unverified.
    const { count } = await admin
      .from("state_food_programs")
      .select("id", { count: "exact", head: true })
      .not("verified_at", "is", null)
      .neq("id", programId);
    expect(count).toBe(0);
  });
});
