import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, cleanupAll, createSeller, createTestUser, describeDb, type Db } from "./helpers";

/**
 * The food-category gate (`20260904200000_category_food_axes.sql`).
 *
 * `categories.food_axes` links our shopping taxonomy to the six axes `state_food_programs` grades,
 * and `products_guard_food_categories` refuses to publish a listing whose axis every program in the
 * seller's state bans. Texas bans meat; Hawaii bans refrigerated baked goods; Florida bans
 * acidified — all three are real rows in the seeded data, so these tests exercise the gate against
 * the law as recorded rather than against a fixture.
 */
describeDb("food category gate", () => {
  let admin: Db;
  let categoryBySlug: Map<string, string>;

  async function seller(state: string): Promise<string> {
    const user = await createTestUser({ role: "seller", homeState: state });
    const profile = await createSeller(user.id, { homeState: state });
    return profile.id;
  }

  async function listIn(sellerId: string, slug: string, status: "draft" | "active" = "active") {
    return admin
      .from("products")
      .insert({
        seller_id: sellerId,
        title: `IT ${Math.random().toString(36).slice(2, 8)}`,
        price: "5.00",
        category_id: categoryBySlug.get(slug)!,
        status,
        quantity_available: 2,
      })
      .select("id, status")
      .single();
  }

  beforeAll(async () => {
    admin = adminDb();
    const { data } = await admin.from("categories").select("id, slug");
    categoryBySlug = new Map((data ?? []).map((c) => [c.slug, c.id]));
  });

  afterAll(cleanupAll);

  // -- the predicate ---------------------------------------------------------
  it("reads each axis out of the seeded programs", async () => {
    const check = async (state: string, axis: string) =>
      (await admin.rpc("state_permits_food_axis", { p_state_code: state, p_axis: axis })).data;

    expect(await check("TX", "meat")).toBe(false); // Texas bans meat
    expect(await check("TX", "fermented")).toBe(true); // and allows fermented
    expect(await check("HI", "refrigerated")).toBe(false);
    expect(await check("WY", "meat")).toBe(true); // Wyoming allows everything
  });

  it("treats a conditional allowance as permitted, not banned", async () => {
    // Colorado allows meat under 1,000 personally-raised poultry — a qualification, not a ban.
    expect(
      (await admin.rpc("state_permits_food_axis", { p_state_code: "CO", p_axis: "meat" })).data,
    ).toBe(true);
  });

  it("refuses an axis it doesn't recognise rather than failing open", async () => {
    expect(
      (await admin.rpc("state_permits_food_axis", { p_state_code: "TX", p_axis: "sorcery" })).data,
    ).toBe(false);
  });

  // -- the gate --------------------------------------------------------------
  it("blocks meat in a state that bans it", async () => {
    const texan = await seller("TX");
    const { error } = await listIn(texan, "meat-seafood");
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/does not permit/i);
  });

  it("allows the same seller to list baked goods", async () => {
    const texan = await seller("TX");
    const { data, error } = await listIn(texan, "baked-goods");
    expect(error).toBeNull();
    expect(data?.status).toBe("active");
  });

  it("allows meat in a state that permits it", async () => {
    const wyomingite = await seller("WY");
    const { error } = await listIn(wyomingite, "meat-seafood");
    expect(error).toBeNull();
  });

  it("blocks a sub-category the same way as its parent", async () => {
    const texan = await seller("TX");
    const { error } = await listIn(texan, "meat-seafood-poultry");
    expect(error).not.toBeNull();
  });

  it("blocks a category that implicates two axes when either is banned", async () => {
    // Pickles & ferments implicates acidified AND fermented. Florida bans both.
    const floridian = await seller("FL");
    const { error } = await listIn(floridian, "pantry-pickles-ferments");
    expect(error).not.toBeNull();
  });

  it("lets a draft through so the seller keeps their work", async () => {
    const texan = await seller("TX");
    const { data, error } = await listIn(texan, "meat-seafood", "draft");
    expect(error).toBeNull();
    expect(data?.status).toBe("draft");
  });

  it("refuses to publish that draft later", async () => {
    const texan = await seller("TX");
    const { data } = await listIn(texan, "meat-seafood", "draft");
    const { error } = await admin.from("products").update({ status: "active" }).eq("id", data!.id);
    expect(error).not.toBeNull();
  });

  it("does not fire for a category with no axis mapped", async () => {
    // Fresh produce is not one of the six axes; the mapping is deliberately empty.
    const texan = await seller("TX");
    const { error } = await listIn(texan, "produce");
    expect(error).toBeNull();
  });

  it("does not fire for non-food categories", async () => {
    const texan = await seller("TX");
    const { error } = await listIn(texan, "crafts-artisan-goods");
    expect(error).toBeNull();
  });

  it("follows the data: unbanning the axis unblocks the listing", async () => {
    const texan = await seller("TX");
    const { data: before } = await admin
      .from("state_food_programs")
      .select("id, cat_meat")
      .eq("state_code", "TX");

    await admin.from("state_food_programs").update({ cat_meat: "allowed" }).eq("state_code", "TX");
    const { error } = await listIn(texan, "meat-seafood");
    expect(error).toBeNull();

    for (const p of before ?? []) {
      await admin.from("state_food_programs").update({ cat_meat: p.cat_meat }).eq("id", p.id);
    }
  });

  // -- the mapping -----------------------------------------------------------
  it("only maps axes from the known set", async () => {
    const { error } = await admin
      .from("categories")
      .update({ food_axes: ["shelf_stable", "witchcraft"] })
      .eq("id", categoryBySlug.get("baked-goods")!);
    expect(error).not.toBeNull();
  });

  it("leaves the genuinely ambiguous categories unmapped rather than guessing", async () => {
    const { data } = await admin
      .from("categories")
      .select("slug, food_axes")
      .eq("requires_food_permit", true);
    const unmapped = (data ?? [])
      .filter((c) => (c.food_axes as string[]).length === 0)
      .map((c) => c.slug)
      .sort();
    expect(unmapped).toEqual([
      "beverages-juice-cider",
      "produce",
      "produce-fruit",
      "produce-herbs",
      "produce-vegetables",
    ]);
  });
});
