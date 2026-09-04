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
 * Tax ID protection (`20260904140000_tax_id_protection.sql`).
 *
 * The ciphertext is fenced off with a COLUMN-level revoke, which sits underneath RLS: even the
 * owning seller and an admin — both of whom can read the rest of the row — cannot select it. That
 * is the guarantee the whole design rests on, so it gets asserted from every angle a browser
 * session could come from.
 */
describeDb("tax id protection", () => {
  let admin: Db;
  let sellerUser: TestUser;
  let adminUser: TestUser;
  let sellerId: string;
  let licenseId: string;

  const CIPHERTEXT = "v1.aGVsbG8td29ybGQtbm90LXJlYWxseS1jaXBoZXJ0ZXh0";

  beforeAll(async () => {
    admin = adminDb();
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    adminUser = await createTestUser({ role: "admin", homeState: "TX" });
    const seller = await createSeller(sellerUser.id, { homeState: "TX" });
    sellerId = seller.id;

    const { data, error } = await admin
      .from("seller_licenses")
      .insert({
        seller_id: sellerId,
        license_type: "tax_id",
        issuing_state: null,
        expiration_date: null,
        document_path: `${sellerId}/licenses/it-tax.pdf`,
        tax_id_encrypted: CIPHERTEXT,
        tax_id_last4: "6789",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`tax id fixture: ${error?.message}`);
    licenseId = data.id;
  });

  afterAll(cleanupAll);

  it("the owning seller cannot select the ciphertext", async () => {
    const { data, error } = await sellerUser.db
      .from("seller_licenses")
      .select("tax_id_encrypted")
      .eq("id", licenseId);
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });

  it("an admin cannot select the ciphertext either", async () => {
    const { error } = await adminUser.db
      .from("seller_licenses")
      .select("tax_id_encrypted")
      .eq("id", licenseId);
    expect(error).not.toBeNull();
  });

  it("a star-select is refused rather than quietly leaking it", async () => {
    const { error } = await sellerUser.db.from("seller_licenses").select("*").eq("id", licenseId);
    expect(error).not.toBeNull();
  });

  it("the seller can still read the rest of the row, including the last 4", async () => {
    const { data, error } = await sellerUser.db
      .from("seller_licenses")
      .select("id, license_type, tax_id_last4, verification_status")
      .eq("id", licenseId)
      .single();
    expect(error).toBeNull();
    expect(data?.tax_id_last4).toBe("6789");
  });

  it("a logged-out visitor reads nothing at all", async () => {
    const { data } = await anonDb()
      .from("seller_licenses")
      .select("id, tax_id_last4")
      .eq("id", licenseId);
    expect(data ?? []).toHaveLength(0);
  });

  it("the service role can read it — the app holds the key, not Postgres", async () => {
    const { data, error } = await admin
      .from("seller_licenses")
      .select("tax_id_encrypted")
      .eq("id", licenseId)
      .single();
    expect(error).toBeNull();
    expect(data?.tax_id_encrypted).toBe(CIPHERTEXT);
  });

  // -- the audit trail -------------------------------------------------------
  it("a seller cannot read the audit log", async () => {
    await admin.from("tax_id_audit").insert({
      license_id: licenseId,
      seller_id: sellerId,
      action: "stored",
      actor_id: sellerUser.id,
    });

    const { data } = await sellerUser.db
      .from("tax_id_audit")
      .select("id")
      .eq("license_id", licenseId);
    expect(data ?? []).toHaveLength(0);
  });

  it("an admin can read the audit log", async () => {
    const { data } = await adminUser.db
      .from("tax_id_audit")
      .select("id, action")
      .eq("license_id", licenseId);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("no client can write to the audit log", async () => {
    const { error } = await adminUser.db.from("tax_id_audit").insert({
      license_id: licenseId,
      seller_id: sellerId,
      action: "decrypted",
      actor_id: adminUser.id,
    });
    expect(error).not.toBeNull();
  });

  it("only the known actions are accepted", async () => {
    const { error } = await admin.from("tax_id_audit").insert({
      license_id: licenseId,
      seller_id: sellerId,
      action: "exfiltrated",
    });
    expect(error).not.toBeNull();
  });

  it("accepts a rekeyed action", async () => {
    const { error } = await admin.from("tax_id_audit").insert({
      license_id: licenseId,
      seller_id: sellerId,
      action: "rekeyed",
      note: "Re-encrypted from key 1 to key 2.",
    });
    expect(error).toBeNull();
  });

  // -- the key id ------------------------------------------------------------
  it("a seller cannot select which key encrypted their row", async () => {
    const { error } = await sellerUser.db
      .from("seller_licenses")
      .select("tax_id_key_id")
      .eq("id", licenseId);
    expect(error).not.toBeNull();
  });

  it("the service role can, which is how rotation progress is counted", async () => {
    await admin.from("seller_licenses").update({ tax_id_key_id: 1 }).eq("id", licenseId);
    const { data, error } = await admin
      .from("seller_licenses")
      .select("tax_id_key_id")
      .eq("id", licenseId)
      .single();
    expect(error).toBeNull();
    expect(data?.tax_id_key_id).toBe(1);
  });
});
