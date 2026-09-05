import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, cleanupAll, createSeller, createTestUser, describeDb, type Db } from "./helpers";

/**
 * The label fields on `products` (`20260904190000_product_label_fields.sql`).
 *
 * The allergen vocabulary is fixed by federal law, so it is constrained at the data layer rather
 * than only in the form: an allergen that reaches a printed label misspelled is worse than one
 * refused at write time.
 */
describeDb("product label fields", () => {
  let admin: Db;
  let sellerId: string;
  let categoryId: string;

  async function insert(fields: Record<string, unknown>) {
    return admin
      .from("products")
      .insert({
        seller_id: sellerId,
        title: `IT ${Math.random().toString(36).slice(2, 8)}`,
        price: "5.00",
        category_id: categoryId,
        status: "draft",
        ...fields,
      })
      .select("id, ingredients, allergens, net_weight_value, net_weight_unit")
      .single();
  }

  beforeAll(async () => {
    admin = adminDb();
    const user = await createTestUser({ role: "seller", homeState: "TX" });
    const seller = await createSeller(user.id, { homeState: "TX" });
    sellerId = seller.id;

    const { data: cat } = await admin
      .from("categories")
      .select("id")
      .is("parent_id", null)
      .limit(1)
      .single();
    categoryId = cat!.id;
  });

  afterAll(cleanupAll);

  it("defaults to empty rather than null, so a label never reads undefined", async () => {
    const { data, error } = await insert({});
    expect(error).toBeNull();
    expect(data?.ingredients).toEqual([]);
    expect(data?.allergens).toEqual([]);
  });

  it("stores ingredients in the order given", async () => {
    const { data, error } = await insert({ ingredients: ["Wheat flour", "Water", "Sea salt"] });
    expect(error).toBeNull();
    expect(data?.ingredients).toEqual(["Wheat flour", "Water", "Sea salt"]);
  });

  it("refuses ingredients that aren't an array", async () => {
    const { error } = await insert({ ingredients: { flour: true } });
    expect(error).not.toBeNull();
  });

  it("accepts the nine federal allergens", async () => {
    const all = [
      "milk",
      "eggs",
      "fish",
      "shellfish",
      "tree_nuts",
      "peanuts",
      "wheat",
      "soybeans",
      "sesame",
    ];
    const { data, error } = await insert({ allergens: all });
    expect(error).toBeNull();
    expect(data?.allergens).toHaveLength(9);
  });

  it("refuses an allergen outside that set", async () => {
    const { error } = await insert({ allergens: ["milk", "gluten"] });
    expect(error).not.toBeNull();
  });

  it("refuses a misspelling — this is the point of the constraint", async () => {
    const { error } = await insert({ allergens: ["peanut"] });
    expect(error).not.toBeNull();
  });

  it("stores a net weight and its unit", async () => {
    const { data, error } = await insert({ net_weight_value: "24", net_weight_unit: "oz" });
    expect(error).toBeNull();
    expect(Number(data?.net_weight_value)).toBe(24);
    expect(data?.net_weight_unit).toBe("oz");
  });

  it("refuses a value without a unit", async () => {
    const { error } = await insert({ net_weight_value: "24" });
    expect(error).not.toBeNull();
  });

  it("refuses a unit without a value", async () => {
    const { error } = await insert({ net_weight_unit: "oz" });
    expect(error).not.toBeNull();
  });

  it("refuses an unknown unit", async () => {
    const { error } = await insert({ net_weight_value: "3", net_weight_unit: "stones" });
    expect(error).not.toBeNull();
  });

  it("refuses a zero or negative quantity", async () => {
    expect((await insert({ net_weight_value: "0", net_weight_unit: "oz" })).error).not.toBeNull();
    expect((await insert({ net_weight_value: "-2", net_weight_unit: "oz" })).error).not.toBeNull();
  });

  it("keeps three decimal places, so 1.125 lb doesn't become 1.13", async () => {
    const { data } = await insert({ net_weight_value: "1.125", net_weight_unit: "lb" });
    expect(Number(data?.net_weight_value)).toBe(1.125);
  });
});

/**
 * A food listing may not go live without its ingredients and net weight
 * (`20260905110000_product_label_fields_required.sql`).
 *
 * The columns shipped optional. Once the pre-checkout disclosure went in, an incomplete row stopped
 * being a private gap in the seller's dashboard and became the label a buyer is shown above the pay
 * button — so `products_guard_label_fields` refuses to publish one. Draft and archived are exempt,
 * as with the online-sales and category gates, and non-food listings are untouched.
 */
describeDb("food listings need their label fields to publish", () => {
  let admin: Db;
  let sellerId: string;
  let foodCategoryId: string;
  let craftCategoryId: string;

  const complete = {
    ingredients: ["Wheat flour", "Water", "Sea salt"],
    net_weight_value: "24",
    net_weight_unit: "oz",
  };

  async function insert(fields: Record<string, unknown>) {
    return admin
      .from("products")
      .insert({
        seller_id: sellerId,
        title: `IT ${Math.random().toString(36).slice(2, 8)}`,
        price: "5.00",
        category_id: foodCategoryId,
        quantity_available: 3,
        ...fields,
      })
      .select("id")
      .single();
  }

  beforeAll(async () => {
    admin = adminDb();
    const user = await createTestUser({ role: "seller", homeState: "TX" });
    const seller = await createSeller(user.id, { homeState: "TX" });
    sellerId = seller.id;

    const { data: food } = await admin
      .from("categories")
      .select("id")
      .eq("slug", "baked-goods")
      .single();
    foodCategoryId = food!.id;

    const { data: craft } = await admin
      .from("categories")
      .select("id")
      .eq("slug", "crafts-candles")
      .single();
    craftCategoryId = craft!.id;
  });

  afterAll(cleanupAll);

  it("publishes a food listing that carries both fields", async () => {
    const { error } = await insert({ status: "active", ...complete });
    expect(error).toBeNull();
  });

  it("refuses to publish one with no ingredients", async () => {
    const { error } = await insert({ status: "active", ...complete, ingredients: [] });
    expect(error?.message).toMatch(/ingredients/i);
  });

  it("refuses to publish one with no net weight", async () => {
    const { error } = await insert({
      status: "active",
      ...complete,
      net_weight_value: null,
      net_weight_unit: null,
    });
    expect(error?.message).toMatch(/net weight/i);
  });

  it("guards sold_out as well — it is still on the storefront", async () => {
    const { error } = await insert({ status: "sold_out", ...complete, ingredients: [] });
    expect(error).not.toBeNull();
  });

  it("lets an incomplete draft be saved, so the seller keeps their work", async () => {
    const { error } = await insert({ status: "draft" });
    expect(error).toBeNull();
  });

  it("blocks the draft from being published until it is complete", async () => {
    const { data } = await insert({ status: "draft" });
    const first = await admin
      .from("products")
      .update({ status: "active" })
      .eq("id", data!.id);
    expect(first.error).not.toBeNull();

    const second = await admin
      .from("products")
      .update({ status: "active", ...complete })
      .eq("id", data!.id);
    expect(second.error).toBeNull();
  });

  it("lets a published listing be archived even though it is incomplete", async () => {
    // The two dev listings this rule was written for are exactly this shape: already live, already
    // incomplete. Archiving has to stay open or they could not be taken down.
    const { data } = await insert({ status: "draft" });
    const { error } = await admin
      .from("products")
      .update({ status: "archived" })
      .eq("id", data!.id);
    expect(error).toBeNull();
  });

  it("asks nothing of a non-food listing", async () => {
    const { error } = await insert({ status: "active", category_id: craftCategoryId });
    expect(error).toBeNull();
  });
});
