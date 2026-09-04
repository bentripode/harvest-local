import { afterAll, beforeAll, expect, it } from "vitest";

import {
  adminDb,
  anonDb,
  cleanupAll,
  createSeller,
  createTestUser,
  describeDb,
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
