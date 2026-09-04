import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, cleanupAll, createSeller, createTestUser, describeDb, type Db } from "./helpers";

/**
 * The license gate — `sync_seller_license_pause` (`20260904110000_license_gate.sql`).
 *
 * A storefront may only be live with a verified, unexpired license. Pausing is the single lever:
 * checkout, the storefront page and `/shop` all gate on `seller_profiles.is_paused`, so the
 * precedence rules in this one function are what the whole guardrail rests on.
 */
describeDb("license gate", () => {
  const day = 86_400_000;
  const future = new Date(Date.now() + 365 * day).toISOString().slice(0, 10);
  const past = new Date(Date.now() - 7 * day).toISOString().slice(0, 10);

  let admin: Db;

  /** A live storefront with a trialing subscription — i.e. onboarding otherwise complete. */
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

  async function addLicense(
    sellerId: string,
    status: "pending" | "verified" | "rejected" | "expired",
    expiration = future,
  ): Promise<string> {
    const { data, error } = await admin
      .from("seller_licenses")
      .insert({
        seller_id: sellerId,
        license_type: "cottage_food",
        issuing_state: "TX",
        expiration_date: expiration,
        verification_status: status,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`license fixture: ${error?.message}`);
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

  it("pauses a live storefront with no license on file", async () => {
    const sellerId = await liveSeller();
    expect(await sync(sellerId)).toBe("license_unverified");
    expect(await pauseState(sellerId)).toMatchObject({
      is_paused: true,
      pause_reason: "license_unverified",
    });
  });

  it("a pending license does not count", async () => {
    const sellerId = await liveSeller();
    await addLicense(sellerId, "pending");
    expect(await sync(sellerId)).toBe("license_unverified");
  });

  it("a verified but lapsed license does not count", async () => {
    const sellerId = await liveSeller();
    await addLicense(sellerId, "verified", past);
    expect(await sync(sellerId)).toBe("license_unverified");
  });

  it("a verified, unexpired license keeps the storefront live", async () => {
    const sellerId = await liveSeller();
    await addLicense(sellerId, "verified");
    expect(await sync(sellerId)).toBeNull();
    expect(await pauseState(sellerId)).toMatchObject({ is_paused: false, pause_reason: null });
  });

  it("verifying a license lifts the license pause", async () => {
    const sellerId = await liveSeller();
    await sync(sellerId);
    expect((await pauseState(sellerId)).pause_reason).toBe("license_unverified");

    await addLicense(sellerId, "verified");
    expect(await sync(sellerId)).toBeNull();
    expect(await pauseState(sellerId)).toMatchObject({ is_paused: false, pause_reason: null });
  });

  it("a verified license also lifts an expiry pause", async () => {
    const sellerId = await liveSeller();
    await admin
      .from("seller_profiles")
      .update({ is_paused: true, pause_reason: "license_expired" })
      .eq("id", sellerId);

    await addLicense(sellerId, "verified");
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

  it("never lifts a revenue-cap pause, even with a verified license", async () => {
    const sellerId = await liveSeller();
    await addLicense(sellerId, "verified");
    await admin
      .from("seller_profiles")
      .update({ is_paused: true, pause_reason: "revenue_cap" })
      .eq("id", sellerId);

    expect(await sync(sellerId)).toBe("revenue_cap");
    expect((await pauseState(sellerId)).is_paused).toBe(true);
  });

  it("never lifts an admin pause", async () => {
    const sellerId = await liveSeller();
    await addLicense(sellerId, "verified");
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
    await addLicense(seller.id, "verified");

    // No subscription row — onboarding is genuinely incomplete.
    expect(await sync(seller.id)).toBe("onboarding_incomplete");
    expect((await pauseState(seller.id)).is_paused).toBe(true);
  });

  it("a license pause is not lifted while the subscription is lapsed", async () => {
    const sellerId = await liveSeller();
    await admin.from("subscriptions").update({ status: "past_due" }).eq("seller_id", sellerId);
    await sync(sellerId);
    await addLicense(sellerId, "verified");

    expect(await sync(sellerId)).toBe("license_unverified");
  });
});
