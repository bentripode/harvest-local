import { afterAll, beforeAll, expect, it } from "vitest";

import {
  adminDb,
  anonDb,
  cleanupAll,
  createSeller,
  createTestUser,
  describeDb,
  type Db,
  type TestUser,
} from "./helpers";

/**
 * `seller_licenses` — the guard that makes admin review meaningful.
 *
 * A seller may edit their own license row ("licenses: seller updates own"), so the whole
 * verification trail (`verification_status` + `reviewed_at` / `reviewed_by` / `review_note`) is
 * fenced off by the `seller_licenses_guard_status` BEFORE UPDATE trigger. Without it a seller could
 * mark their own permit verified — which is also what arms `license-expiry-scan`, since that job
 * only scans `verification_status = 'verified'`.
 */
describeDb("seller licenses", () => {
  let sellerUser: TestUser;
  let otherSellerUser: TestUser;
  let seller: { id: string };
  let licenseId: string;

  /** A year out, so the "don't verify a lapsed document" case is never accidental. */
  const futureExpiry = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    otherSellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });

    const { data, error } = await adminDb()
      .from("seller_licenses")
      .insert({
        seller_id: seller.id,
        license_type: "cottage_food",
        issuing_state: "TX",
        expiration_date: futureExpiry,
        document_path: `${seller.id}/licenses/it-fixture.pdf`,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`license fixture: ${error?.message}`);
    licenseId = data.id;
  });

  afterAll(cleanupAll);

  it("a new license starts pending", async () => {
    const { data } = await adminDb()
      .from("seller_licenses")
      .select("verification_status")
      .eq("id", licenseId)
      .single();
    expect(data?.verification_status).toBe("pending");
  });

  it("a seller cannot verify their own license", async () => {
    const { error } = await sellerUser.db
      .from("seller_licenses")
      .update({ verification_status: "verified" })
      .eq("id", licenseId);
    expect(error).not.toBeNull();

    const { data } = await adminDb()
      .from("seller_licenses")
      .select("verification_status")
      .eq("id", licenseId)
      .single();
    expect(data?.verification_status).toBe("pending");
  });

  it("a seller cannot forge the review trail", async () => {
    for (const patch of [
      { reviewed_at: new Date().toISOString() },
      { reviewed_by: sellerUser.id },
      { review_note: "looks great to me" },
    ]) {
      const { error } = await sellerUser.db
        .from("seller_licenses")
        .update(patch)
        .eq("id", licenseId);
      expect(error, `expected ${Object.keys(patch)[0]} to be platform-only`).not.toBeNull();
    }
  });

  it("a seller can still correct the rest of their own row", async () => {
    const { error } = await sellerUser.db
      .from("seller_licenses")
      .update({ license_number: "TX-CF-12345" })
      .eq("id", licenseId);
    expect(error).toBeNull();
  });

  it("the platform can verify, with the review trail attached", async () => {
    const reviewedAt = new Date().toISOString();
    const { error } = await adminDb()
      .from("seller_licenses")
      .update({
        verification_status: "verified",
        reviewed_at: reviewedAt,
        reviewed_by: sellerUser.id, // stands in for the admin's profile id
        review_note: "permit matches the state registry",
      })
      .eq("id", licenseId);
    expect(error).toBeNull();

    const { data } = await adminDb()
      .from("seller_licenses")
      .select("verification_status, review_note, reviewed_at")
      .eq("id", licenseId)
      .single();
    expect(data?.verification_status).toBe("verified");
    expect(data?.review_note).toBe("permit matches the state registry");
    expect(data?.reviewed_at).not.toBeNull();
  });

  it("a seller cannot undo a verification either", async () => {
    const { error } = await sellerUser.db
      .from("seller_licenses")
      .update({ verification_status: "pending", review_note: null })
      .eq("id", licenseId);
    expect(error).not.toBeNull();
  });

  it("another seller cannot read the license", async () => {
    const { data } = await otherSellerUser.db
      .from("seller_licenses")
      .select("id")
      .eq("id", licenseId);
    expect(data ?? []).toHaveLength(0);
  });

  it("a logged-out visitor reads no licenses", async () => {
    const { data } = await anonDb().from("seller_licenses").select("id").eq("id", licenseId);
    expect(data ?? []).toHaveLength(0);
  });

  it("the seller reads their own license", async () => {
    const { data } = await sellerUser.db.from("seller_licenses").select("id").eq("id", licenseId);
    expect(data).toHaveLength(1);
  });
});

/**
 * A verified licence must have a document behind it
 * (`20260905000000_verified_licence_needs_document.sql`).
 *
 * `seller_licenses_document_required` was added NOT VALID so rows uploaded through the old generic
 * form survived — which left the review queue offering a Verify button on a licence with nothing
 * attached. Verifying it would record that an admin examined a document that does not exist, and
 * both the storefront gate and the label generator trust that record.
 */
describeDb("verified licences need a document", () => {
  let admin: Db;
  let sellerId: string;
  const future = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    admin = adminDb();
    const user = await createTestUser({ role: "seller", homeState: "TX" });
    const seller = await createSeller(user.id, { homeState: "TX" });
    sellerId = seller.id;
  });

  afterAll(cleanupAll);

  /**
   * `seller_licenses_document_required` already refuses a documentless licence of the three
   * REQUIRED types (id, tax_id, cottage_food) — NOT VALID exempts rows that predate it, not new
   * writes. So the surface the trigger actually covers is the other types, plus legacy rows like
   * the pending cottage-food permit sitting on the dev project with nothing attached.
   */
  async function insertLicence(
    documentPath: string | null,
    status = "pending",
    licenseType = "food_handler",
  ) {
    return admin
      .from("seller_licenses")
      .insert({
        seller_id: sellerId,
        license_type: licenseType,
        issuing_state: "TX",
        expiration_date: future,
        document_path: documentPath,
        verification_status: status,
      })
      .select("id")
      .single();
  }

  it("the CHECK already refuses a documentless licence of a required type", async () => {
    const { error } = await insertLicence(null, "pending", "cottage_food");
    expect(error).not.toBeNull();
  });

  it("allows a pending licence with no document for the other types", async () => {
    const { error } = await insertLicence(null);
    expect(error).toBeNull();
  });

  it("refuses to verify one with nothing attached", async () => {
    const { data } = await insertLicence(null);
    const { error } = await admin
      .from("seller_licenses")
      .update({ verification_status: "verified" })
      .eq("id", data!.id);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/without a document/i);
  });

  it("refuses to insert one already verified with no document", async () => {
    const { error } = await insertLicence(null, "verified");
    expect(error).not.toBeNull();
  });

  it("refuses to strip the document off an already-verified licence", async () => {
    const { data } = await insertLicence(`${sellerId}/licenses/it-real.pdf`, "verified");
    const { error } = await admin
      .from("seller_licenses")
      .update({ document_path: null })
      .eq("id", data!.id);
    expect(error).not.toBeNull();
  });

  it("verifies normally once a document is attached", async () => {
    const { data } = await insertLicence(`${sellerId}/licenses/it-ok.pdf`);
    const { error } = await admin
      .from("seller_licenses")
      .update({ verification_status: "verified" })
      .eq("id", data!.id);
    expect(error).toBeNull();
  });

  it("still allows rejecting one with no document, so the seller learns why", async () => {
    const { data } = await insertLicence(null);
    const { error } = await admin
      .from("seller_licenses")
      .update({ verification_status: "rejected", review_note: "Nothing was attached." })
      .eq("id", data!.id);
    expect(error).toBeNull();
  });
});
