import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, cleanupAll, createSeller, createTestUser, describeDb, type Db } from "./helpers";

/**
 * The license gate — `sync_seller_license_pause` / `seller_has_required_documents`
 * (`20260904110000_license_gate.sql`, tightened by `20260904130000_seller_documents.sql`).
 *
 * A storefront may only be live once every required document is verified and unexpired: a
 * Government ID and a Tax ID always, plus a Cottage Food Permit for any seller listing food.
 * Pausing is the single lever — checkout, the storefront page and `/shop` all gate on
 * `seller_profiles.is_paused` — so the precedence rules here are what the guardrail rests on.
 */
describeDb("license gate", () => {
  const day = 86_400_000;
  const future = new Date(Date.now() + 365 * day).toISOString().slice(0, 10);
  const past = new Date(Date.now() - 7 * day).toISOString().slice(0, 10);

  let admin: Db;

  /** A storefront with a trialing subscription — i.e. onboarding otherwise complete. */
  async function liveSeller(): Promise<string> {
    const user = await createTestUser({ role: "seller", homeState: "TX" });
    const seller = await createSeller(user.id, { homeState: "TX" });
    const { error } = await admin.from("subscriptions").insert({
      seller_id: seller.id,
      stripe_customer_id: `cus_it_${seller.id.slice(0, 8)}`,
      status: "trialing",
    });
    if (error) throw new Error(`subscription fixture: ${error.message}`);
    return seller.id;
  }

  async function addDocument(
    sellerId: string,
    type: "id" | "tax_id" | "cottage_food",
    status: "pending" | "verified" | "rejected" | "expired" = "verified",
    expiration: string | null = future,
  ): Promise<string> {
    const { data, error } = await admin
      .from("seller_licenses")
      .insert({
        seller_id: sellerId,
        license_type: type,
        // A tax ID has neither, and the CHECK constraints allow that only for this type.
        issuing_state: type === "tax_id" ? null : "TX",
        expiration_date: type === "tax_id" ? null : expiration,
        document_path: `${sellerId}/licenses/it-${type}.pdf`,
        verification_status: status,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`document fixture (${type}): ${error?.message}`);
    return data.id;
  }

  /** The two documents every seller needs, both verified. */
  async function addBaseDocuments(sellerId: string): Promise<void> {
    await addDocument(sellerId, "id");
    await addDocument(sellerId, "tax_id");
  }

  /** A product in a category flagged `requires_food_permit`, which pulls in the permit. */
  async function addFoodProduct(sellerId: string): Promise<string> {
    const { data: cat, error: catErr } = await admin
      .from("categories")
      .select("id")
      .eq("requires_food_permit", true)
      .is("parent_id", null)
      .limit(1)
      .single();
    if (catErr || !cat) throw new Error(`no food category seeded: ${catErr?.message}`);

    const { data, error } = await admin
      .from("products")
      .insert({
        seller_id: sellerId,
        title: `IT Food ${Math.random().toString(36).slice(2, 8)}`,
        price: "5.00",
        category_id: cat.id,
        status: "active",
        quantity_available: 5,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`food product fixture: ${error?.message}`);
    return data.id;
  }

  async function sync(sellerId: string): Promise<string | null> {
    const { data, error } = await admin.rpc("sync_seller_license_pause", { p_seller_id: sellerId });
    if (error) throw new Error(`sync: ${error.message}`);
    return data;
  }

  async function pauseState(sellerId: string) {
    const { data } = await admin
      .from("seller_profiles")
      .select("is_paused, pause_reason")
      .eq("id", sellerId)
      .single();
    return data!;
  }

  beforeAll(() => {
    admin = adminDb();
  });

  afterAll(cleanupAll);

  // -- the required set ------------------------------------------------------
  it("pauses a storefront with no documents at all", async () => {
    const sellerId = await liveSeller();
    expect(await sync(sellerId)).toBe("license_unverified");
    expect(await pauseState(sellerId)).toMatchObject({
      is_paused: true,
      pause_reason: "license_unverified",
    });
  });

  it("one verified document is not enough", async () => {
    const sellerId = await liveSeller();
    await addDocument(sellerId, "id");
    expect(await sync(sellerId)).toBe("license_unverified");
  });

  it("ID + tax ID is enough for a seller who lists no food", async () => {
    const sellerId = await liveSeller();
    await addBaseDocuments(sellerId);
    expect(await sync(sellerId)).toBeNull();
    expect(await pauseState(sellerId)).toMatchObject({ is_paused: false, pause_reason: null });
  });

  it("a pending document does not count", async () => {
    const sellerId = await liveSeller();
    await addDocument(sellerId, "id", "pending");
    await addDocument(sellerId, "tax_id");
    expect(await sync(sellerId)).toBe("license_unverified");
  });

  it("a verified but lapsed document does not count", async () => {
    const sellerId = await liveSeller();
    await addDocument(sellerId, "id", "verified", past);
    await addDocument(sellerId, "tax_id");
    expect(await sync(sellerId)).toBe("license_unverified");
  });

  it("a tax ID with no expiry date is permanently valid", async () => {
    const sellerId = await liveSeller();
    await addBaseDocuments(sellerId);
    const { data } = await admin
      .from("seller_licenses")
      .select("expiration_date")
      .eq("seller_id", sellerId)
      .eq("license_type", "tax_id")
      .single();
    expect(data?.expiration_date).toBeNull();
    expect(await sync(sellerId)).toBeNull();
  });

  // -- the permit follows the catalogue -------------------------------------
  it("listing a food product makes the permit required, and pauses the storefront", async () => {
    const sellerId = await liveSeller();
    await addBaseDocuments(sellerId);
    expect(await sync(sellerId)).toBeNull();

    // The trigger on `products` re-syncs, so this pauses without anyone calling sync().
    await addFoodProduct(sellerId);
    expect((await pauseState(sellerId)).pause_reason).toBe("license_unverified");
  });

  it("verifying the permit reopens a food seller's storefront", async () => {
    const sellerId = await liveSeller();
    await addBaseDocuments(sellerId);
    await addFoodProduct(sellerId);
    expect((await pauseState(sellerId)).is_paused).toBe(true);

    await addDocument(sellerId, "cottage_food");
    expect(await sync(sellerId)).toBeNull();
    expect((await pauseState(sellerId)).is_paused).toBe(false);
  });

  it("archiving the last food product drops the permit requirement", async () => {
    const sellerId = await liveSeller();
    await addBaseDocuments(sellerId);
    const productId = await addFoodProduct(sellerId);
    expect((await pauseState(sellerId)).is_paused).toBe(true);

    await admin.from("products").update({ status: "archived" }).eq("id", productId);
    expect((await pauseState(sellerId)).is_paused).toBe(false);
  });

  // -- precedence ------------------------------------------------------------
  it("verifying the set lifts an expiry pause too", async () => {
    const sellerId = await liveSeller();
    await admin
      .from("seller_profiles")
      .update({ is_paused: true, pause_reason: "license_expired" })
      .eq("id", sellerId);

    await addBaseDocuments(sellerId);
    expect(await sync(sellerId)).toBeNull();
  });

  it("never downgrades a revenue-cap pause to a license pause", async () => {
    const sellerId = await liveSeller();
    await admin
      .from("seller_profiles")
      .update({ is_paused: true, pause_reason: "revenue_cap" })
      .eq("id", sellerId);

    expect(await sync(sellerId)).toBe("revenue_cap");
  });

  it("never lifts a revenue-cap pause, even with every document verified", async () => {
    const sellerId = await liveSeller();
    await addBaseDocuments(sellerId);
    await admin
      .from("seller_profiles")
      .update({ is_paused: true, pause_reason: "revenue_cap" })
      .eq("id", sellerId);

    expect(await sync(sellerId)).toBe("revenue_cap");
    expect((await pauseState(sellerId)).is_paused).toBe(true);
  });

  it("never lifts an admin pause", async () => {
    const sellerId = await liveSeller();
    await addBaseDocuments(sellerId);
    await admin
      .from("seller_profiles")
      .update({ is_paused: true, pause_reason: "admin" })
      .eq("id", sellerId);

    expect(await sync(sellerId)).toBe("admin");
  });

  it("does not resurrect a seller who hasn't finished onboarding", async () => {
    const user = await createTestUser({ role: "seller", homeState: "TX" });
    const seller = await createSeller(user.id, { homeState: "TX", isPaused: true });
    await admin
      .from("seller_profiles")
      .update({ pause_reason: "onboarding_incomplete" })
      .eq("id", seller.id);
    await addBaseDocuments(seller.id);

    // No subscription row — onboarding is genuinely incomplete.
    expect(await sync(seller.id)).toBe("onboarding_incomplete");
    expect((await pauseState(seller.id)).is_paused).toBe(true);
  });

  it("a license pause is not lifted while the subscription is lapsed", async () => {
    const sellerId = await liveSeller();
    await admin.from("subscriptions").update({ status: "past_due" }).eq("seller_id", sellerId);
    await sync(sellerId);
    await addBaseDocuments(sellerId);

    expect(await sync(sellerId)).toBe("license_unverified");
  });

  // -- the document constraints ---------------------------------------------
  it("refuses a required document with no file attached", async () => {
    const sellerId = await liveSeller();
    const { error } = await admin.from("seller_licenses").insert({
      seller_id: sellerId,
      license_type: "id",
      issuing_state: "TX",
      expiration_date: future,
      document_path: null,
    });
    expect(error).not.toBeNull();
  });

  it("refuses a dated document with no expiry date", async () => {
    const sellerId = await liveSeller();
    const { error } = await admin.from("seller_licenses").insert({
      seller_id: sellerId,
      license_type: "cottage_food",
      issuing_state: "TX",
      expiration_date: null,
      document_path: `${sellerId}/licenses/it-nodate.pdf`,
    });
    expect(error).not.toBeNull();
  });
});
