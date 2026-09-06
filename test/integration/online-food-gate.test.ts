import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, cleanupAll, createSeller, createTestUser, describeDb, type Db } from "./helpers";

/**
 * The online food sales gate (`20260904180000_online_food_sales_gate.sql`).
 *
 * Delaware, Michigan, Mississippi, Nevada and Washington ban online cottage-food orders under every
 * program they run. A seller there may still sell candles and flowers — so the gate blocks the food
 * LISTING rather than the storefront, and these tests pin both halves of that: food is refused,
 * non-food is untouched.
 *
 * This suite used Hawaii until every ban was checked against primary text
 * (`20260906030000_verify_online_bans.sql`). Hawaii's had nothing behind it — Haw. Admin. Rules
 * 11-50-3(c) attaches four conditions to a homemade-food operation and none concerns selling
 * channel — so it is no longer a banned state and cannot stand in for one. Washington replaced it,
 * on RCW 69.22.020(4): cottage food "may not be sold by internet, mail order, or for retail sale
 * outside the state."
 */
describeDb("online food sales gate", () => {
  let admin: Db;
  let foodCategoryId: string;
  let nonFoodCategoryId: string;

  /** A seller in a state that bans online food sales outright. */
  let bannedStateSeller: string;
  /** A seller in a state that permits it. */
  let texasSeller: string;

  async function makeSeller(state: string): Promise<string> {
    const user = await createTestUser({ role: "seller", homeState: state });
    const seller = await createSeller(user.id, { homeState: state });
    return seller.id;
  }

  async function addProduct(
    sellerId: string,
    categoryId: string,
    status: "draft" | "active" = "active",
  ) {
    return admin
      .from("products")
      .insert({
        seller_id: sellerId,
        title: `IT ${Math.random().toString(36).slice(2, 8)}`,
        price: "5.00",
        category_id: categoryId,
        status,
        quantity_available: 3,
        // A complete label, so `products_guard_label_fields` isn't the guard that speaks — it fires
        // first on a publish, and the rule under test here is the state's online-sales ban.
        ingredients: ["Wheat flour", "Water"],
        net_weight_value: "12",
        net_weight_unit: "oz",
        allergens: ["wheat"],
      })
      .select("id, status")
      .single();
  }

  beforeAll(async () => {
    admin = adminDb();

    const { data: food } = await admin
      .from("categories")
      .select("id")
      .eq("requires_food_permit", true)
      .is("parent_id", null)
      .limit(1)
      .single();
    const { data: nonFood } = await admin
      .from("categories")
      .select("id")
      .eq("requires_food_permit", false)
      .is("parent_id", null)
      .limit(1)
      .single();
    foodCategoryId = food!.id;
    nonFoodCategoryId = nonFood!.id;

    bannedStateSeller = await makeSeller("WA");
    texasSeller = await makeSeller("TX");
  });

  afterAll(cleanupAll);

  // -- the predicate ---------------------------------------------------------
  it("reads the ban out of the seeded programs", async () => {
    const { data: banned } = await admin.rpc("state_allows_online_food_sales", { p_state_code: "WA" });
    const { data: tx } = await admin.rpc("state_allows_online_food_sales", { p_state_code: "TX" });
    expect(banned).toBe(false);
    expect(tx).toBe(true);
  });

  it("allows a state where only one of several programs permits online orders", async () => {
    // New Hampshire is the clean example: RSA 143-A:12 III makes selling "over the Internet, by
    // mail order" the trigger for licensure, so the exempt row bans it and the licensed row allows
    // it. Virginia used to sit here, but checking Va. Code 3.2-5130 found both its subdivisions
    // permit sale "through the internet", so it no longer bans it under any program.
    const { data } = await admin.rpc("state_allows_online_food_sales", { p_state_code: "NH" });
    expect(data).toBe(true);
  });

  // -- the gate --------------------------------------------------------------
  it("refuses to publish a food listing in a banned state", async () => {
    const { error } = await addProduct(bannedStateSeller, foodCategoryId, "active");
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not permitted/i);
  });

  it("leaves non-food listings in that same state alone", async () => {
    const { data, error } = await addProduct(bannedStateSeller, nonFoodCategoryId, "active");
    expect(error).toBeNull();
    expect(data?.status).toBe("active");
  });

  it("allows a draft, so the seller keeps their work", async () => {
    const { data, error } = await addProduct(bannedStateSeller, foodCategoryId, "draft");
    expect(error).toBeNull();
    expect(data?.status).toBe("draft");
  });

  it("refuses to publish that draft later", async () => {
    const { data } = await addProduct(bannedStateSeller, foodCategoryId, "draft");
    const { error } = await admin.from("products").update({ status: "active" }).eq("id", data!.id);
    expect(error).not.toBeNull();
  });

  it("refuses to move a published non-food listing into a food category", async () => {
    const { data } = await addProduct(bannedStateSeller, nonFoodCategoryId, "active");
    const { error } = await admin
      .from("products")
      .update({ category_id: foodCategoryId })
      .eq("id", data!.id);
    expect(error).not.toBeNull();
  });

  it("publishes food normally in a state that permits it", async () => {
    const { data, error } = await addProduct(texasSeller, foodCategoryId, "active");
    expect(error).toBeNull();
    expect(data?.status).toBe("active");
  });

  it("follows the data: unbanning the state unblocks the listing", async () => {
    const { data: programs } = await admin
      .from("state_food_programs")
      .select("id, online_orders")
      .eq("state_code", "WA");
    const original = programs!.map((p) => ({ id: p.id, online_orders: p.online_orders }));

    await admin
      .from("state_food_programs")
      .update({ online_orders: "allowed" })
      .eq("state_code", "WA");

    const { error } = await addProduct(bannedStateSeller, foodCategoryId, "active");
    expect(error).toBeNull();

    // Reference data — restore it.
    for (const p of original) {
      await admin.from("state_food_programs").update({ online_orders: p.online_orders }).eq("id", p.id);
    }
  });

  it("blocks the service role too — this is not a UI check", async () => {
    // Every insert above already used the service-role client, which bypasses RLS. The gate is a
    // trigger, so it holds for webhook and job code as well as for a seller's own session.
    const { error } = await addProduct(bannedStateSeller, foodCategoryId, "sold_out" as "active");
    expect(error).not.toBeNull();
  });
});
