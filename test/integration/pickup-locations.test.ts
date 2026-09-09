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
 * Collection points. Two things here are guardrails rather than conveniences:
 *
 *  - a booth may only be at a market in the seller's own selling state, because a market page
 *    lists who collects there and an out-of-state booth would advertise a seller to buyers who
 *    cannot lawfully order from them (CLAUDE.md rule 1);
 *  - a paused seller's collection points disappear from public reads along with their storefront.
 */
describeDb("pickup_locations", () => {
  let sellerUser: TestUser;
  let otherUser: TestUser;
  let seller: { id: string };
  let txMarket: string;
  let vtMarket: string;
  const stamp = Date.now();
  const marketIds: string[] = [];

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    otherUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
    // A second seller, used only to prove one cannot write the other's rows.
    await createSeller(otherUser.id, { homeState: "TX" });

    const { data, error } = await adminDb()
      .from("markets")
      .insert([
        { slug: `it-pl-tx-${stamp}`, name: "IT TX Market", state: "TX", city: "Austin" },
        { slug: `it-pl-vt-${stamp}`, name: "IT VT Market", state: "VT", city: "Burlington" },
      ])
      .select("id, state");
    if (error) throw new Error(`market fixture: ${error.message}`);
    for (const row of data ?? []) {
      marketIds.push(row.id);
      if (row.state === "TX") txMarket = row.id;
      else vtMarket = row.id;
    }
  });

  afterAll(async () => {
    if (marketIds.length > 0) await adminDb().from("markets").delete().in("id", marketIds);
    await cleanupAll();
  });

  it("lets a seller add a booth at a market in their own state", async () => {
    const { data, error } = await sellerUser.db
      .from("pickup_locations")
      .insert({
        seller_id: seller.id,
        market_id: txMarket,
        label: "Saturday stall",
        city: "Austin",
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it("refuses a booth at a market in another state — even from the service role", async () => {
    const { error } = await adminDb().from("pickup_locations").insert({
      seller_id: seller.id,
      market_id: vtMarket,
      label: "Out of state",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/seller's own state/i);
  });

  it("refuses a second booth at the same market", async () => {
    const { error } = await sellerUser.db.from("pickup_locations").insert({
      seller_id: seller.id,
      market_id: txMarket,
      label: "Duplicate stall",
    });
    expect(error?.code).toBe("23505");
  });

  it("refuses a location that is neither at a market nor at an address", async () => {
    const { error } = await sellerUser.db.from("pickup_locations").insert({
      seller_id: seller.id,
      label: "Nowhere",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/pickup_locations_where/i);
  });

  it("will not let one seller write a location for another", async () => {
    const { error } = await otherUser.db.from("pickup_locations").insert({
      seller_id: seller.id,
      market_id: txMarket,
      label: "Not mine",
    });
    expect(error).not.toBeNull();
  });

  it("is publicly readable while the storefront is live, and hidden once it is paused", async () => {
    const { data: loc } = await adminDb()
      .from("pickup_locations")
      .select("id")
      .eq("seller_id", seller.id)
      .eq("market_id", txMarket)
      .single();

    const live = await anonDb().from("pickup_locations").select("id").eq("id", loc!.id).maybeSingle();
    expect(live.data?.id).toBe(loc!.id);

    await adminDb()
      .from("seller_profiles")
      .update({ is_paused: true, pause_reason: "admin" })
      .eq("id", seller.id);

    const paused = await anonDb()
      .from("pickup_locations")
      .select("id")
      .eq("id", loc!.id)
      .maybeSingle();
    expect(paused.data).toBeNull();

    // The owner still sees their own while paused — they have to be able to fix things.
    const mine = await sellerUser.db
      .from("pickup_locations")
      .select("id")
      .eq("id", loc!.id)
      .maybeSingle();
    expect(mine.data?.id).toBe(loc!.id);

    await adminDb()
      .from("seller_profiles")
      .update({ is_paused: false, pause_reason: null })
      .eq("id", seller.id);
  });

  it("hides an inactive location from buyers but not from its owner", async () => {
    const { data: loc } = await adminDb()
      .from("pickup_locations")
      .select("id")
      .eq("seller_id", seller.id)
      .eq("market_id", txMarket)
      .single();

    await sellerUser.db.from("pickup_locations").update({ is_active: false }).eq("id", loc!.id);

    const asAnon = await anonDb().from("pickup_locations").select("id").eq("id", loc!.id).maybeSingle();
    expect(asAnon.data).toBeNull();

    const asOwner = await sellerUser.db
      .from("pickup_locations")
      .select("id")
      .eq("id", loc!.id)
      .maybeSingle();
    expect(asOwner.data?.id).toBe(loc!.id);

    await sellerUser.db.from("pickup_locations").update({ is_active: true }).eq("id", loc!.id);
  });
});

describeDb("pickup_slots", () => {
  let sellerUser: TestUser;
  let seller: { id: string };
  let locationId: string;
  let marketId: string;
  const stamp = Date.now();

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });

    const { data: market } = await adminDb()
      .from("markets")
      .insert({ slug: `it-slots-${stamp}`, name: "IT Slots Market", state: "TX" })
      .select("id")
      .single();
    marketId = market!.id;

    const { data: loc } = await sellerUser.db
      .from("pickup_locations")
      .insert({ seller_id: seller.id, market_id: marketId, label: "Stall" })
      .select("id")
      .single();
    locationId = loc!.id;
  });

  afterAll(async () => {
    await adminDb().from("markets").delete().eq("id", marketId);
    await cleanupAll();
  });

  it("accepts a weekly slot", async () => {
    const { error } = await sellerUser.db.from("pickup_slots").insert({
      location_id: locationId,
      day_of_week: 6,
      opens: "09:00",
      closes: "15:00",
    });
    expect(error).toBeNull();
  });

  it("accepts a non-weekly cadence", async () => {
    const { error } = await sellerUser.db.from("pickup_slots").insert({
      location_id: locationId,
      day_of_week: 3,
      opens: "16:00",
      closes: "19:00",
      weeks_of_month: [1, 3],
    });
    expect(error).toBeNull();
  });

  it("accepts a one-off date", async () => {
    const { error } = await sellerUser.db.from("pickup_slots").insert({
      location_id: locationId,
      specific_date: "2026-12-14",
      opens: "10:00",
      closes: "16:00",
    });
    expect(error).toBeNull();
  });

  it("refuses a slot that is both a weekday and a date, or neither", async () => {
    const both = await sellerUser.db.from("pickup_slots").insert({
      location_id: locationId,
      day_of_week: 1,
      specific_date: "2026-12-15",
      opens: "10:00",
      closes: "16:00",
    });
    expect(both.error?.message).toMatch(/pickup_slots_when/i);

    const neither = await sellerUser.db.from("pickup_slots").insert({
      location_id: locationId,
      opens: "10:00",
      closes: "16:00",
    });
    expect(neither.error?.message).toMatch(/pickup_slots_when/i);
  });

  it("refuses a window that ends before it starts", async () => {
    const { error } = await sellerUser.db.from("pickup_slots").insert({
      location_id: locationId,
      day_of_week: 2,
      opens: "15:00",
      closes: "09:00",
    });
    expect(error?.message).toMatch(/pickup_slots_span/i);
  });

  it("refuses a week ordinal outside 1-5, and weeks on a one-off date", async () => {
    const badWeek = await sellerUser.db.from("pickup_slots").insert({
      location_id: locationId,
      day_of_week: 2,
      opens: "09:00",
      closes: "10:00",
      weeks_of_month: [6],
    });
    expect(badWeek.error?.message).toMatch(/pickup_slots_weeks/i);

    const weeksOnDate = await sellerUser.db.from("pickup_slots").insert({
      location_id: locationId,
      specific_date: "2026-12-20",
      opens: "09:00",
      closes: "10:00",
      weeks_of_month: [1],
    });
    expect(weeksOnDate.error?.message).toMatch(/pickup_slots_weeks/i);
  });

  it("is readable by a signed-out visitor, since a buyer picks a time before ordering", async () => {
    const { data } = await anonDb().from("pickup_slots").select("day_of_week").eq("location_id", locationId);
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
