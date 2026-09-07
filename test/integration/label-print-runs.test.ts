import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, cleanupAll, createSeller, createTestUser, describeDb, type Db, type TestUser } from "./helpers";

/**
 * `label_print_runs` — the log that lets a seller answer "which jars".
 *
 * New Hampshire requires a product code including the manufacture date and lot number "to support a
 * recall". A lot code exists so that when something goes wrong you can name the affected batch; if
 * the only copy is on the jar, the seller cannot answer the question the code was invented for.
 */
describeDb("label print runs", () => {
  let admin: Db;
  let owner: TestUser;
  let stranger: TestUser;
  let sellerId: string;
  let strangerSellerId: string;
  let productId: string;

  beforeAll(async () => {
    admin = adminDb();
    owner = await createTestUser({ role: "seller", homeState: "NH" });
    stranger = await createTestUser({ role: "seller", homeState: "NH" });
    sellerId = (await createSeller(owner.id, { homeState: "NH" })).id;
    strangerSellerId = (await createSeller(stranger.id, { homeState: "NH" })).id;

    const { data: category } = await admin
      .from("categories")
      .select("id")
      .eq("slug", "baked-goods")
      .single();
    const { data: product } = await admin
      .from("products")
      .insert({
        seller_id: sellerId,
        title: "IT Recall Loaf",
        price: "6.00",
        category_id: category!.id,
        status: "draft",
        quantity_available: 4,
      })
      .select("id")
      .single();
    productId = product!.id;
  });

  afterAll(cleanupAll);

  it("a seller records their own run and reads it back", async () => {
    const { error } = await owner.db.from("label_print_runs").insert({
      seller_id: sellerId,
      product_id: productId,
      production_date: "2026-09-07",
      lot_code: "B-2026-09-07-A",
      copies: 24,
      lines: [{ element: "product_name", caption: null, value: "IT Recall Loaf" }],
      disclaimer: "This product is exempt from New Hampshire licensing and inspection.",
      program_name: "New Hampshire Exempt Home Food Operations",
    });
    expect(error).toBeNull();

    const { data } = await owner.db
      .from("label_print_runs")
      .select("lot_code, copies")
      .eq("product_id", productId);
    expect(data?.[0]?.lot_code).toBe("B-2026-09-07-A");
    expect(data?.[0]?.copies).toBe(24);
  });

  it("finds the runs that carried a lot code — the recall question", async () => {
    const { data } = await owner.db
      .from("label_print_runs")
      .select("product_id, production_date, copies")
      .eq("seller_id", sellerId)
      .eq("lot_code", "B-2026-09-07-A");
    expect(data).toHaveLength(1);
    expect(data?.[0]?.production_date).toBe("2026-09-07");
  });

  it("another seller cannot see it", async () => {
    const { data } = await stranger.db.from("label_print_runs").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("refuses a run logged against someone else's product", async () => {
    const { error } = await stranger.db.from("label_print_runs").insert({
      seller_id: strangerSellerId,
      product_id: productId,
      copies: 1,
    });
    expect(error).not.toBeNull();
  });

  /**
   * A log that can be edited after the fact is not a log. There is deliberately no UPDATE policy:
   * the whole value of this table in a recall is that it says what was true at the time.
   */
  it("cannot be rewritten after the fact", async () => {
    await owner.db
      .from("label_print_runs")
      .update({ lot_code: "SOMETHING-ELSE" })
      .eq("seller_id", sellerId);

    const { data } = await admin
      .from("label_print_runs")
      .select("lot_code")
      .eq("seller_id", sellerId);
    expect(data?.[0]?.lot_code).toBe("B-2026-09-07-A");
  });
});
