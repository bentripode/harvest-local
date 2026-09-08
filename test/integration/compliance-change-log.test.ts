import { afterAll, beforeAll, expect, it } from "vitest";

import {
  adminDb,
  cleanupAll,
  createProduct,
  createSeller,
  createTestUser,
  describeDb,
  type Db,
  type TestUser,
} from "./helpers";

/**
 * `compliance_change_log` — knowing who a rule change lands on.
 *
 * `products_guard_food_categories` fires when a PRODUCT is written. Nothing re-checks the catalogue
 * when the RULE changes underneath it, so an admin flipping an axis to `banned` was silently
 * leaving unlawful listings published. The original migrations each carried a one-off backfill;
 * nothing did it for an admin edit.
 */
describeDb("compliance change log", () => {
  let admin: Db;
  let adminUser: TestUser;
  let sellerUser: TestUser;
  let sellerId: string;
  let programId: string;
  let productId: string;
  let original: { cat_shelf_stable: string; online_orders: string; venue_note: string | null };

  // A state with a single programme, so the fixture is not entangled with a real multi-route one.
  const STATE = "WV";

  beforeAll(async () => {
    admin = adminDb();
    adminUser = await createTestUser({ role: "admin", homeState: STATE });
    sellerUser = await createTestUser({ role: "seller", homeState: STATE });
    const seller = await createSeller(sellerUser.id, { homeState: STATE });
    sellerId = seller.id;

    const { data: program } = await admin
      .from("state_food_programs")
      .select("id, cat_shelf_stable, online_orders, venue_note")
      .eq("state_code", STATE)
      .eq("ordinal", 1)
      .single();
    programId = program!.id;
    original = {
      cat_shelf_stable: program!.cat_shelf_stable,
      online_orders: program!.online_orders,
      venue_note: program!.venue_note,
    };

    await admin.from("seller_profiles").update({ food_program_id: programId }).eq("id", sellerId);

    const product = await createProduct(sellerId, { price: "8.00" });
    productId = product.id;
    await admin.from("products").update({ status: "active" }).eq("id", productId);
  });

  afterAll(async () => {
    // Shared reference data, not a fixture — put it back exactly as it was.
    await admin.from("state_food_programs").update(original).eq("id", programId);
    await admin.from("compliance_change_log").delete().eq("program_id", programId);
    await cleanupAll();
  });

  it("records a material change and derives `blocking` from it", async () => {
    await admin
      .from("state_food_programs")
      .update({ cat_shelf_stable: "banned" })
      .eq("id", programId);

    const { data } = await admin
      .from("compliance_change_log")
      .select("severity, changes, table_name, state_code")
      .eq("program_id", programId)
      .order("changed_at", { ascending: false })
      .limit(1);

    expect(data?.[0]?.severity).toBe("blocking");
    expect(data?.[0]?.table_name).toBe("state_food_programs");
    expect(data?.[0]?.state_code).toBe(STATE);
    const changes = data![0].changes as { column: string; old: string; new: string }[];
    expect(changes[0].column).toBe("cat_shelf_stable");
    expect(changes[0].new).toBe("banned");
  });

  it("names the live listing the change would unpublish", async () => {
    const { data } = await admin.rpc("compliance_change_impact", { p_program_id: programId });
    expect((data ?? []).map((r) => r.product_id)).toContain(productId);
  });

  it("derives `unblocking` when a ban is lifted", async () => {
    await admin
      .from("state_food_programs")
      .update({ cat_shelf_stable: original.cat_shelf_stable })
      .eq("id", programId);

    const { data } = await admin
      .from("compliance_change_log")
      .select("severity")
      .eq("program_id", programId)
      .order("changed_at", { ascending: false })
      .limit(1);
    expect(data?.[0]?.severity).toBe("unblocking");
  });

  /**
   * An admin re-reading a statute and stamping the row is the most common write this table will
   * ever see. Logging it would bury the changes that actually move a listing.
   */
  it("ignores notes, sources and the verification stamp", async () => {
    const { count: before } = await admin
      .from("compliance_change_log")
      .select("id", { count: "exact", head: true })
      .eq("program_id", programId);

    await admin
      .from("state_food_programs")
      .update({
        venue_note: "IT touched the note",
        source_checked_at: "2026-09-07",
        verified_at: new Date().toISOString(),
      })
      .eq("id", programId);

    const { count: after } = await admin
      .from("compliance_change_log")
      .select("id", { count: "exact", head: true })
      .eq("program_id", programId);
    expect(after).toBe(before);

    await admin
      .from("state_food_programs")
      .update({ verified_at: null, verified_by: null })
      .eq("id", programId);
  });

  it("classifies a label rule change as `label`", async () => {
    const { data: rule } = await admin
      .from("state_label_rules")
      .select("program_id, metric_required")
      .eq("program_id", programId)
      .single();

    await admin
      .from("state_label_rules")
      .update({ metric_required: !rule!.metric_required })
      .eq("program_id", programId);

    const { data } = await admin
      .from("compliance_change_log")
      .select("severity, table_name")
      .eq("program_id", programId)
      .order("changed_at", { ascending: false })
      .limit(1);
    expect(data?.[0]?.severity).toBe("label");
    expect(data?.[0]?.table_name).toBe("state_label_rules");

    await admin
      .from("state_label_rules")
      .update({ metric_required: rule!.metric_required })
      .eq("program_id", programId);
  });

  it("shows an admin the blast radius per axis before they touch anything", async () => {
    const { data } = await admin.rpc("program_listing_exposure", { p_program_id: programId });
    const byAxis = new Map((data ?? []).map((r) => [r.axis, r]));
    // Every axis is reported, including the ones nothing rides on, so the answer is never a
    // silent omission.
    expect(byAxis.size).toBe(7);
    expect(byAxis.get("online_orders")!.listings).toBeGreaterThan(0);
  });

  // -- RLS -------------------------------------------------------------------
  it("a seller cannot read the change log", async () => {
    const { data } = await sellerUser.db.from("compliance_change_log").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("an admin can", async () => {
    const { data } = await adminUser.db
      .from("compliance_change_log")
      .select("id")
      .eq("program_id", programId);
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
