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
