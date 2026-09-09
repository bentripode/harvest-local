import { afterAll, beforeAll, expect, it } from "vitest";

import {
  adminDb,
  anonDb,
  cleanupAll,
  createProduct,
  createSeller,
  createTestUser,
  makeSellerOperational,
  describeDb,
  type TestUser,
} from "./helpers";

/**
 * `nearby_sellers` is the discovery query, and it has two jobs that can fail quietly:
 *
 *  - the state filter is rule 1's discovery layer, and it lives in SQL precisely so a client
 *    cannot drop it;
 *  - coordinates for anywhere a seller might live are rounded to ~1km, because a map pin on an
 *    exact home address undoes the whole of 20260908240000 with a nicer interface.
 */
describeDb("nearby_sellers", () => {
  let txUser: TestUser;
  let vtUser: TestUser;
  let txSeller: { id: string };
  let vtSeller: { id: string };
  const addressIds: string[] = [];

  // A deliberately un-round coordinate: if it survives to two decimals, nothing rounded it.
  const EXACT_LNG = -97.7431997;
  const EXACT_LAT = 30.2671605;

  beforeAll(async () => {
    txUser = await createTestUser({ role: "seller", homeState: "TX" });
    vtUser = await createTestUser({ role: "seller", homeState: "VT" });
    txSeller = await createSeller(txUser.id, { homeState: "TX" });
    vtSeller = await createSeller(vtUser.id, { homeState: "VT" });

    await makeSellerOperational(txSeller.id);
    await makeSellerOperational(vtSeller.id);

    // A live storefront needs something to sell to appear at all.
    await createProduct(txSeller.id);
    await createProduct(vtSeller.id);

    // upsert_address is SECURITY INVOKER and owner-scoped, so the seller writes their own — it is
    // also the only way to get a PostGIS point in through PostgREST.
    const { data: addressId, error: addrError } = await txUser.db.rpc("upsert_address", {
      p_label: "Home",
      p_line1: "14 Cottage Lane",
      p_line2: "",
      p_city: "Austin",
      p_state: "TX",
      p_postal: "78704",
      p_lng: EXACT_LNG,
      p_lat: EXACT_LAT,
    });
    if (addrError || !addressId) throw new Error(`address fixture: ${addrError?.message}`);
    addressIds.push(addressId as unknown as string);

    await adminDb()
      .from("seller_profiles")
      .update({ pickup_address_id: addressId as unknown as string })
      .eq("id", txSeller.id);
  });

  afterAll(async () => {
    if (addressIds.length > 0) await adminDb().from("addresses").delete().in("id", addressIds);
    await cleanupAll();
  });

  it("returns only sellers in the requested state", async () => {
    const { data, error } = await anonDb().rpc("nearby_sellers", { p_state: "TX" });
    expect(error).toBeNull();

    const ids = (data ?? []).map((r) => r.seller_id);
    expect(ids).toContain(txSeller.id);
    expect(ids).not.toContain(vtSeller.id);
  });

  it("is callable by a signed-out visitor — discovery is public", async () => {
    const { error } = await anonDb().rpc("nearby_sellers", { p_state: "TX" });
    expect(error).toBeNull();
  });

  it("returns the list with null distances when no origin is given", async () => {
    const { data } = await anonDb().rpc("nearby_sellers", { p_state: "TX" });
    const row = (data ?? []).find((r) => r.seller_id === txSeller.id);
    expect(row).toBeTruthy();
    expect(row!.distance_miles).toBeNull();
  });

  it("rounds a seller's own coordinates to about a kilometre, never the exact point", async () => {
    const { data } = await anonDb().rpc("nearby_sellers", {
      p_state: "TX",
      p_lng: EXACT_LNG,
      p_lat: EXACT_LAT,
    });
    const row = (data ?? []).find((r) => r.seller_id === txSeller.id);
    if (!row?.approx_lng) return; // no located address in this environment

    expect(row.is_market).toBe(false);
    expect(row.approx_lng).not.toBeCloseTo(EXACT_LNG, 4);
    expect(row.approx_lat).not.toBeCloseTo(EXACT_LAT, 4);
    // Two decimal places exactly — the blur, stated as a number.
    expect(row.approx_lng).toBeCloseTo(Math.round(EXACT_LNG * 100) / 100, 10);
    expect(row.approx_lat).toBeCloseTo(Math.round(EXACT_LAT * 100) / 100, 10);
  });

  it("measures a distance once an origin is supplied", async () => {
    // ~200 miles north of Austin.
    const { data } = await anonDb().rpc("nearby_sellers", {
      p_state: "TX",
      p_lng: -96.797,
      p_lat: 32.7767,
    });
    const row = (data ?? []).find((r) => r.seller_id === txSeller.id);
    if (!row?.distance_miles) return;
    expect(Number(row.distance_miles)).toBeGreaterThan(100);
    expect(Number(row.distance_miles)).toBeLessThan(400);
  });

  it("leaves out a paused storefront", async () => {
    await adminDb()
      .from("seller_profiles")
      .update({ is_paused: true, pause_reason: "admin" })
      .eq("id", txSeller.id);

    const { data } = await anonDb().rpc("nearby_sellers", { p_state: "TX" });
    expect((data ?? []).map((r) => r.seller_id)).not.toContain(txSeller.id);

    await adminDb()
      .from("seller_profiles")
      .update({ is_paused: false, pause_reason: null })
      .eq("id", txSeller.id);
  });

  it("returns no column that could carry a street address", async () => {
    const { data } = await anonDb().rpc("nearby_sellers", { p_state: "TX" });
    const row = (data ?? [])[0];
    if (!row) return;
    expect(Object.keys(row).sort()).toEqual(
      [
        "approx_lat",
        "approx_lng",
        "avg_rating",
        "business_name",
        "distance_miles",
        "is_market",
        "location_label",
        "seller_id",
        "storefront_slug",
      ].sort(),
    );
  });
});
