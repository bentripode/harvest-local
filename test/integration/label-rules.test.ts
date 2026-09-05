import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, anonDb, cleanupAll, createTestUser, describeDb, type Db, type TestUser } from "./helpers";

/**
 * `state_label_rules` — the seeded labelling data behind the generator.
 *
 * Disclaimer text is quoted statute that gets printed onto food, so what matters here is that it is
 * complete, exact, and not editable by a seller.
 */
describeDb("state label rules", () => {
  let admin: Db;
  let sellerUser: TestUser;
  let adminUser: TestUser;

  beforeAll(async () => {
    admin = adminDb();
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    adminUser = await createTestUser({ role: "admin", homeState: "TX" });
  });

  afterAll(cleanupAll);

  it("covers every program", async () => {
    const { count: programs } = await admin
      .from("state_food_programs")
      .select("id", { count: "exact", head: true });
    const { count: rules } = await admin
      .from("state_label_rules")
      .select("program_id", { count: "exact", head: true });
    expect(rules).toBe(programs);
  });

  it("carries provenance on every row", async () => {
    const { count } = await admin
      .from("state_label_rules")
      .select("program_id", { count: "exact", head: true })
      .or("source_url.is.null,source_checked_at.is.null");
    expect(count).toBe(0);
  });

  it("lands unverified — it is a summary of the law, not the law", async () => {
    const { count } = await admin
      .from("state_label_rules")
      .select("program_id", { count: "exact", head: true })
      .not("verified_at", "is", null);
    expect(count).toBe(0);
  });

  it("stores Texas's disclaimer exactly as the statute reads", async () => {
    // Corrected against Texas Health & Safety Code §437.0193(b)(2) — the seeded summary carried
    // materially different wording, which would have been printed onto food.
    const { data } = await admin
      .from("state_label_rules")
      .select("disclaimer_text, disclaimer_all_caps, state_food_programs!inner(state_code)")
      .eq("state_food_programs.state_code", "TX")
      .single();
    expect(data?.disclaimer_text).toBe(
      "THIS PRODUCT WAS PRODUCED IN A PRIVATE RESIDENCE THAT IS NOT SUBJECT TO GOVERNMENTAL LICENSING OR INSPECTION.",
    );
    expect(data?.disclaimer_all_caps).toBe(true);
  });

  it("records that Texas answers the delivery question the seed left open", async () => {
    // §437.0194(b)(1): an internet sale is permitted only if the operator, an employee or a
    // household member personally delivers it — so delivery is required, and couriers are not.
    const { data } = await admin
      .from("state_food_programs")
      .select("direct_delivery, mail_delivery, verified_at")
      .eq("state_code", "TX")
      .single();
    expect(data?.direct_delivery).toBe("allowed");
    expect(data?.mail_delivery).toBe("banned");
    // Corrections are ours; the sign-off is still an admin's.
    expect(data?.verified_at).toBeNull();
  });

  it("keeps New Hampshire's two programs on different disclaimers", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("disclaimer_text, state_food_programs!inner(state_code, name)")
      .eq("state_food_programs.state_code", "NH");

    const byName = new Map(
      (data ?? []).map((r) => [
        (r.state_food_programs as unknown as { name: string }).name,
        r.disclaimer_text,
      ]),
    );
    expect(byName.get("New Hampshire Exempt Home Food Operations")).toMatch(/exempt from New Hampshire/);
    expect(byName.get("New Hampshire Homestead")).toMatch(/licensed by NH DHHS/);
  });

  it("records the states that need a point-of-sale placard", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("state_food_programs!inner(state_code)")
      .eq("placard_required", true);
    const states = [
      ...new Set(
        (data ?? []).map((r) => (r.state_food_programs as unknown as { state_code: string }).state_code),
      ),
    ].sort();
    expect(states).toEqual(["AK", "ID", "MN", "MO", "NE"]);
  });

  it("records the states that want metric alongside imperial", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("state_food_programs!inner(state_code)")
      .eq("metric_required", true);
    const states = [
      ...new Set(
        (data ?? []).map((r) => (r.state_food_programs as unknown as { state_code: string }).state_code),
      ),
    ].sort();
    expect(states).toEqual(["CT", "NC", "TN"]);
  });

  it("leaves a note wherever no requirements are recorded", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("required_elements, disclaimer_text, notes");
    const blank = (data ?? []).filter(
      (r) => (r.required_elements as string[]).length === 0 && !r.disclaimer_text,
    );
    expect(blank.length).toBeGreaterThan(0);
    expect(blank.every((r) => !!r.notes)).toBe(true);
  });

  it("refuses an element name outside the known vocabulary", async () => {
    const { data: program } = await admin.from("state_food_programs").select("id").limit(1).single();
    const { error } = await admin
      .from("state_label_rules")
      .update({ required_elements: ["product_name", "lucky_charm"] })
      .eq("program_id", program!.id);
    expect(error).not.toBeNull();
  });

  // -- RLS -------------------------------------------------------------------
  it("is readable by anyone — a buyer can check what a label should carry", async () => {
    const { data } = await anonDb().from("state_label_rules").select("program_id").limit(1);
    expect((data ?? []).length).toBe(1);
  });

  it("a seller cannot rewrite a disclaimer", async () => {
    const { data: program } = await admin.from("state_food_programs").select("id").limit(1).single();
    const { data: before } = await admin
      .from("state_label_rules")
      .select("disclaimer_text")
      .eq("program_id", program!.id)
      .single();

    await sellerUser.db
      .from("state_label_rules")
      .update({ disclaimer_text: "Totally inspected, trust me" })
      .eq("program_id", program!.id);

    const { data: after } = await admin
      .from("state_label_rules")
      .select("disclaimer_text")
      .eq("program_id", program!.id)
      .single();
    expect(after?.disclaimer_text).toBe(before?.disclaimer_text);
  });

  it("an admin can correct one", async () => {
    const { data: program } = await admin.from("state_food_programs").select("id").limit(1).single();
    const { data: before } = await admin
      .from("state_label_rules")
      .select("notes")
      .eq("program_id", program!.id)
      .single();

    const { error } = await adminUser.db
      .from("state_label_rules")
      .update({ notes: "IT touched this" })
      .eq("program_id", program!.id);
    expect(error).toBeNull();

    await admin
      .from("state_label_rules")
      .update({ notes: before?.notes ?? null })
      .eq("program_id", program!.id);
  });
});
