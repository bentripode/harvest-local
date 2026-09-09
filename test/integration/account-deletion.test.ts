import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, cleanupAll, createSeller, createTestUser, describeDb } from "./helpers";

/**
 * Deleting an account has to actually work.
 *
 * It did not, for anyone who had ever set a pickup address. `pickup_locations` declared
 * `address_id ... on delete set null` alongside `check (market_id is not null or address_id is not
 * null)`: each half sensible, the pair impossible. Deleting a profile cascades to their `addresses`,
 * nulls the column, violates the CHECK, and rolls the whole delete back.
 *
 * That is not a niche path. It is every account deletion, every admin removal, and anything a
 * data-deletion request would need — and it is why six test fixtures accumulated in a live project
 * before anyone noticed, because the harness swallowed the error (both fixed: `20260909180000` and
 * `cleanupAll`).
 *
 * These tests deliberately do NOT use `cleanupAll` for their subject: the deletion IS the assertion.
 */
describeDb("deleting a seller who has a pickup location", () => {
  let addressId: string;
  let sellerId: string;
  let profileId: string;

  beforeAll(async () => {
    const user = await createTestUser({ role: "seller", homeState: "TX" });
    profileId = user.id;
    const seller = await createSeller(user.id, { homeState: "TX" });
    sellerId = seller.id;

    // An address owned by this profile, exactly as `saveDeliverySettingsAction` would create it.
    const { data: address, error: addressError } = await adminDb()
      .from("addresses")
      .insert({
        user_id: profileId,
        line1: "14 Cottage Lane",
        city: "Austin",
        state: "TX",
        postal_code: "78704",
      })
      .select("id")
      .single();
    if (addressError) throw new Error(`address fixture: ${addressError.message}`);
    addressId = address!.id;

    const { error: locationError } = await adminDb().from("pickup_locations").insert({
      seller_id: sellerId,
      address_id: addressId,
      label: "Front porch",
      city: "Austin",
      postal_code: "78704",
    });
    if (locationError) throw new Error(`pickup location fixture: ${locationError.message}`);
  });

  afterAll(cleanupAll);

  it("removes the address and takes the pickup location with it", async () => {
    // The narrow version of the bug: SET NULL left a row with neither a market nor an address,
    // which the CHECK refuses. CASCADE is right because a collection point whose address is gone
    // is not a place.
    const { error } = await adminDb().from("addresses").delete().eq("id", addressId);
    expect(error, error?.message).toBeNull();

    const { data: locations } = await adminDb()
      .from("pickup_locations")
      .select("id")
      .eq("seller_id", sellerId);
    expect(locations ?? []).toHaveLength(0);
  });

  it("deletes the whole account, which is what actually failed", async () => {
    const { error } = await adminDb().auth.admin.deleteUser(profileId);
    expect(error, error?.message).toBeNull();

    const { data: seller } = await adminDb()
      .from("seller_profiles")
      .select("id")
      .eq("id", sellerId)
      .maybeSingle();
    expect(seller).toBeNull();

    const { data: profile } = await adminDb()
      .from("profiles")
      .select("id")
      .eq("id", profileId)
      .maybeSingle();
    expect(profile).toBeNull();
  });
});

describeDb("deleting a seller whose pickup location is a market booth", () => {
  let sellerId: string;
  let profileId: string;
  let marketId: string;
  const stamp = Date.now();

  beforeAll(async () => {
    const user = await createTestUser({ role: "seller", homeState: "TX" });
    profileId = user.id;
    sellerId = (await createSeller(user.id, { homeState: "TX" })).id;

    const { data: market, error } = await adminDb()
      .from("markets")
      .insert({
        slug: `it-del-${stamp}`,
        name: "IT Deletion Market",
        state: "TX",
        status: "published",
      })
      .select("id")
      .single();
    if (error) throw new Error(`market fixture: ${error.message}`);
    marketId = market!.id;

    await adminDb().from("pickup_locations").insert({
      seller_id: sellerId,
      market_id: marketId,
      label: "Saturday booth",
    });
  });

  afterAll(async () => {
    await adminDb().from("markets").delete().eq("id", marketId);
    await cleanupAll();
  });

  it("deletes cleanly, and the market itself is untouched", async () => {
    // The market FK stays SET NULL on purpose — a market disappearing is a directory edit, not the
    // venue ceasing to exist. Deleting the SELLER must not take the market with it.
    const { error } = await adminDb().auth.admin.deleteUser(profileId);
    expect(error, error?.message).toBeNull();

    const { data: market } = await adminDb()
      .from("markets")
      .select("id")
      .eq("id", marketId)
      .maybeSingle();
    expect(market?.id).toBe(marketId);
  });
});
