import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, anonDb, cleanupAll, createTestUser, describeDb, type Db, type TestUser } from "./helpers";

/**
 * `state_food_programs` — the seeded compliance reference data.
 *
 * Two things matter here. The RLS shape: these rows decide whether a seller may list food at all,
 * so a seller must not be able to edit their own state's programs. And the seed itself: the five
 * states that ban online food sales are the highest-consequence rows in the database, and they
 * should fall out of the data rather than being hardcoded anywhere.
 */
describeDb("state food programs", () => {
  let admin: Db;
  let sellerUser: TestUser;
  let adminUser: TestUser;
  let originalOnline: string;

  beforeAll(async () => {
    admin = adminDb();
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    adminUser = await createTestUser({ role: "admin", homeState: "TX" });

    const { data } = await admin
      .from("state_food_programs")
      .select("online_orders")
      .eq("state_code", "TX")
      .eq("ordinal", 1)
      .single();
    originalOnline = data!.online_orders;
  });

  afterAll(async () => {
    // Shared reference data, not a fixture — put it back exactly as it was.
    await admin
      .from("state_food_programs")
      .update({ online_orders: originalOnline, verified_at: null, verified_by: null })
      .eq("state_code", "TX")
      .eq("ordinal", 1);
    await cleanupAll();
  });

  // -- the seed -------------------------------------------------------------
  it("covers every jurisdiction the state rules table knows about", async () => {
    const { data: rules } = await admin.from("state_cottage_food_rules").select("state_code");
    const { data: programs } = await admin.from("state_food_programs").select("state_code");
    const withPrograms = new Set((programs ?? []).map((p) => p.state_code));
    const missing = (rules ?? []).map((r) => r.state_code).filter((s) => !withPrograms.has(s));
    expect(missing).toEqual([]);
  });

  it("lands entirely unverified — it is a summary, not statute", async () => {
    const { count } = await admin
      .from("state_food_programs")
      .select("id", { count: "exact", head: true })
      .not("verified_at", "is", null);
    expect(count).toBe(0);
  });

  it("carries provenance on every row", async () => {
    const { count } = await admin
      .from("state_food_programs")
      .select("id", { count: "exact", head: true })
      .or("source_url.is.null,source_checked_at.is.null");
    expect(count).toBe(0);
  });

  it("records the five states where every program bans online food sales", async () => {
    const { data } = await admin.from("state_food_programs").select("state_code, online_orders");
    const byState = new Map<string, string[]>();
    for (const p of data ?? []) {
      byState.set(p.state_code, [...(byState.get(p.state_code) ?? []), p.online_orders]);
    }
    const blocked = [...byState.entries()]
      .filter(([, v]) => v.every((x) => x === "banned"))
      .map(([k]) => k)
      .sort();
    // Still five states, but not the five that were seeded. Checking each ban against primary text
    // swapped two members: WA joined, because RCW 69.22.020(4) says cottage food "may not be sold
    // by internet, mail order, or for retail sale outside the state" and the seed had it allowed —
    // which would have permitted an unlawful listing. HI left, because Haw. Admin. Rules 11-50-3(c)
    // imposes four conditions on a homemade-food operation and none of them touches selling
    // channel, so its ban had nothing behind it and was blocking Hawaii sellers for no reason.
    expect(blocked).toEqual(["DE", "MI", "MS", "NV", "WA"]);
  });

  it("keeps multi-program states distinct", async () => {
    const { data } = await admin
      .from("state_food_programs")
      .select("name, ordinal")
      .eq("state_code", "CA")
      .order("ordinal");
    expect(data).toHaveLength(3);
    expect(data?.map((p) => p.name)).toEqual([
      "Cottage Food Class A",
      "Cottage Food Class B",
      "Microenterprise Home Kitchen Operations",
    ]);
  });

  /**
   * This used to assert Colorado was `per_product` at $10,000. Verifying Colo. Rev. Stat. 25-4-1614
   * against the statute found a single $150,000 annual cap and no per-product figure at all, and
   * Virginia — the other non-annual row — turned out to be a $9,000 annual figure rather than a
   * $3,000 acidified-only one. **No seeded programme uses a non-annual basis any more.**
   *
   * So the column is asserted, not a state: the schema must still accept the other bases, because
   * `record_order_revenue` implements them and a future verified state may well need one. What the
   * bases actually DO is covered by cap-variants.test.ts, which builds its own programme rows
   * precisely so it stops depending on which state carries which basis.
   */
  it("still admits cap bases other than an annual total", async () => {
    const { data } = await admin.from("state_food_programs").select("cap_basis");
    const bases = new Set((data ?? []).map((p) => p.cap_basis));
    expect([...bases].every((b) => ["annual_total", "per_product", "per_category", "none"].includes(b))).toBe(true);

    // The CHECK accepts a non-annual basis even though nothing verified uses one today.
    const { error } = await admin
      .from("state_food_programs")
      .update({ cap_basis: "per_product" })
      .eq("state_code", "CO")
      .select("state_code");
    expect(error).toBeNull();
    // Put Colorado back to what the statute says.
    await admin
      .from("state_food_programs")
      .update({ cap_basis: "annual_total" })
      .eq("state_code", "CO");
  });

  // -- RLS ------------------------------------------------------------------
  it("is readable by a logged-out visitor", async () => {
    const { data } = await anonDb()
      .from("state_food_programs")
      .select("state_code")
      .eq("state_code", "TX");
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("a seller cannot unban online sales for their own state", async () => {
    await sellerUser.db
      .from("state_food_programs")
      .update({ online_orders: "allowed" })
      .eq("state_code", "TX");

    const { data } = await admin
      .from("state_food_programs")
      .select("online_orders")
      .eq("state_code", "TX")
      .eq("ordinal", 1)
      .single();
    expect(data?.online_orders).toBe(originalOnline);
  });

  it("a seller cannot insert a program", async () => {
    const { error } = await sellerUser.db.from("state_food_programs").insert({
      state_code: "TX",
      ordinal: 99,
      name: "IT Fake Program",
      source_url: "https://example.test",
      source_checked_at: "2026-09-04",
    });
    expect(error).not.toBeNull();
  });

  it("an admin can edit a program and stamp it verified", async () => {
    const { error } = await adminUser.db
      .from("state_food_programs")
      .update({ verified_at: new Date().toISOString(), verified_by: adminUser.id })
      .eq("state_code", "TX")
      .eq("ordinal", 1);
    expect(error).toBeNull();

    const { data } = await admin
      .from("state_food_programs")
      .select("verified_at")
      .eq("state_code", "TX")
      .eq("ordinal", 1)
      .single();
    expect(data?.verified_at).not.toBeNull();
  });

  it("rejects an unknown online_orders value", async () => {
    const { error } = await admin
      .from("state_food_programs")
      .update({ online_orders: "maybe" })
      .eq("state_code", "TX")
      .eq("ordinal", 1);
    expect(error).not.toBeNull();
  });

  // -- label rules ----------------------------------------------------------
  it("has a label rule for every program", async () => {
    // Seeded separately, after a complete verbatim re-read — see label-rules.test.ts.
    const { count: programs } = await admin
      .from("state_food_programs")
      .select("id", { count: "exact", head: true });
    const { count: rules } = await admin
      .from("state_label_rules")
      .select("program_id", { count: "exact", head: true });
    expect(rules).toBe(programs);
  });

  it("a seller cannot write label rules", async () => {
    const { data: program } = await admin
      .from("state_food_programs")
      .select("id")
      .eq("state_code", "TX")
      .eq("ordinal", 1)
      .single();

    const { error } = await sellerUser.db.from("state_label_rules").insert({
      program_id: program!.id,
      disclaimer_text: "Definitely inspected, honest",
      source_url: "https://example.test",
      source_checked_at: "2026-09-04",
    });
    expect(error).not.toBeNull();
  });
});
