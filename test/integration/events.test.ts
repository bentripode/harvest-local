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
 * Events, at the data layer.
 *
 * Two things are worth protecting here. The first is CLAUDE.md rule 1's discovery layer: a calendar
 * that advertises an out-of-state seller at a local market invites an order the data layer will
 * then refuse, so `events_set_state` makes the listing impossible rather than the disappointment.
 * The second is that `state` is DERIVED — a seller who edits the form cannot put themselves in
 * another state's calendar.
 */

const today = () => new Date().toISOString().slice(0, 10);

describeDb("events_set_state", () => {
  let sellerUser: TestUser;
  let seller: { id: string };
  let txMarket: string;
  let vtMarket: string;
  const eventIds: string[] = [];
  const marketIds: string[] = [];
  const stamp = Date.now();

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });

    const { data, error } = await adminDb()
      .from("markets")
      .insert([
        { slug: `it-ev-tx-${stamp}`, name: "IT TX Market", state: "TX", status: "published" },
        { slug: `it-ev-vt-${stamp}`, name: "IT VT Market", state: "VT", status: "published" },
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
    if (eventIds.length > 0) await adminDb().from("events").delete().in("id", eventIds);
    if (marketIds.length > 0) await adminDb().from("markets").delete().in("id", marketIds);
    await cleanupAll();
  });

  async function insert(over: Record<string, unknown> = {}, db = sellerUser.db) {
    const result = await db
      .from("events")
      .insert({
        seller_id: seller.id,
        state: "TX",
        title: "IT Event",
        event_date: today(),
        location_text: "Somewhere",
        ...over,
      })
      .select("id, state")
      .single();
    if (result.data) eventIds.push(result.data.id);
    return result;
  }

  it("derives state from the storefront rather than trusting the form", async () => {
    // A seller who edits the hidden field cannot list themselves on another state's calendar.
    const { data, error } = await insert({ state: "VT" });
    expect(error).toBeNull();
    expect(data!.state).toBe("TX");
  });

  it("refuses a market in another state", async () => {
    const { error } = await insert({ market_id: vtMarket, location_text: null });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/own state/i);
  });

  it("accepts a market in the seller's own state", async () => {
    const { data, error } = await insert({ market_id: txMarket, location_text: null });
    expect(error).toBeNull();
    expect(data!.state).toBe("TX");
  });

  it("re-derives on update, so moving a market cannot smuggle an event across a border", async () => {
    const { data } = await insert({ market_id: txMarket, location_text: null });
    const { error } = await sellerUser.db
      .from("events")
      .update({ market_id: vtMarket })
      .eq("id", data!.id);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/own state/i);
  });

  it("needs somewhere to be — a market or an address", async () => {
    const { error } = await insert({ location_text: null });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/events_venue/i);
  });

  it("refuses an end before a start, and an end with no start", async () => {
    const backwards = await insert({ starts_at: "13:00", ends_at: "09:00" });
    expect(backwards.error!.message).toMatch(/events_span/i);

    const dangling = await insert({ ends_at: "13:00" });
    expect(dangling.error!.message).toMatch(/events_end_needs_start/i);
  });

  it("keeps a wall-clock time exactly as entered", async () => {
    // The whole point of `time` over `timestamptz`: 9am at the stall is 9am, and nothing in the
    // round trip is allowed to shift it by a time zone.
    const { data } = await insert({ starts_at: "09:00", ends_at: "13:00" });
    const { data: row } = await adminDb()
      .from("events")
      .select("starts_at, ends_at, event_date")
      .eq("id", data!.id)
      .single();

    expect(row!.starts_at).toMatch(/^09:00/);
    expect(row!.ends_at).toMatch(/^13:00/);
    expect(row!.event_date).toBe(today());
  });
});

describeDb("events RLS", () => {
  let sellerUser: TestUser;
  let stranger: TestUser;
  let seller: { id: string };
  let otherSeller: { id: string };
  let publishedId: string;
  let hiddenId: string;
  const eventIds: string[] = [];

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    stranger = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
    otherSeller = await createSeller(stranger.id, { homeState: "TX" });

    const { data, error } = await adminDb()
      .from("events")
      .insert([
        {
          seller_id: seller.id,
          state: "TX",
          title: "IT Published Event",
          event_date: today(),
          location_text: "The farm",
          status: "published",
        },
        {
          seller_id: seller.id,
          state: "TX",
          title: "IT Draft Event",
          event_date: today(),
          location_text: "The farm",
          status: "hidden",
        },
      ])
      .select("id, status");
    if (error) throw new Error(`event fixture: ${error.message}`);

    for (const row of data ?? []) {
      eventIds.push(row.id);
      if (row.status === "published") publishedId = row.id;
      else hiddenId = row.id;
    }
  });

  afterAll(async () => {
    if (eventIds.length > 0) await adminDb().from("events").delete().in("id", eventIds);
    await cleanupAll();
  });

  it("lets a signed-out visitor read a published event", async () => {
    const { data } = await anonDb()
      .from("events")
      .select("id, title")
      .eq("id", publishedId)
      .maybeSingle();
    expect(data?.title).toBe("IT Published Event");
  });

  it("hides a draft from everyone but its owner", async () => {
    const asAnon = await anonDb().from("events").select("id").eq("id", hiddenId).maybeSingle();
    expect(asAnon.data).toBeNull();

    const asStranger = await stranger.db
      .from("events")
      .select("id")
      .eq("id", hiddenId)
      .maybeSingle();
    expect(asStranger.data).toBeNull();

    const asOwner = await sellerUser.db
      .from("events")
      .select("id")
      .eq("id", hiddenId)
      .maybeSingle();
    expect(asOwner.data?.id).toBe(hiddenId);
  });

  it("keeps a storefront closed for a holiday on the calendar", async () => {
    // Same exception the storefront page makes: `vacation` is the seller's own pause and their page
    // stays readable, so their market dates should not vanish from a buyer's plans either.
    await adminDb()
      .from("seller_profiles")
      .update({ is_paused: true, pause_reason: "vacation" })
      .eq("id", seller.id);

    const { data } = await anonDb().from("events").select("id").eq("id", publishedId).maybeSingle();
    expect(data?.id).toBe(publishedId);
  });

  it("takes a storefront closed BY US off the calendar", async () => {
    for (const reason of ["license_unverified", "revenue_cap", "admin"]) {
      await adminDb()
        .from("seller_profiles")
        .update({ is_paused: true, pause_reason: reason })
        .eq("id", seller.id);

      const { data } = await anonDb()
        .from("events")
        .select("id")
        .eq("id", publishedId)
        .maybeSingle();
      expect(data, `should be hidden while paused for ${reason}`).toBeNull();
    }

    await adminDb()
      .from("seller_profiles")
      .update({ is_paused: false, pause_reason: null })
      .eq("id", seller.id);
  });

  it("will not let a stranger write an event onto someone else's storefront", async () => {
    const { error } = await stranger.db.from("events").insert({
      seller_id: seller.id,
      state: "TX",
      title: "IT Hijack",
      event_date: today(),
      location_text: "Nowhere",
    });
    expect(error).not.toBeNull();
  });

  it("keeps a stranger from editing an event that isn't theirs", async () => {
    // RLS filters rather than errors, so the unchanged row is what proves the policy held.
    await stranger.db.from("events").update({ title: "Hijacked" }).eq("id", publishedId);

    const { data } = await adminDb()
      .from("events")
      .select("title")
      .eq("id", publishedId)
      .single();
    expect(data!.title).toBe("IT Published Event");
  });

  it("lets a seller create and remove their own", async () => {
    const created = await sellerUser.db
      .from("events")
      .insert({
        seller_id: otherSeller.id,
        state: "TX",
        title: "IT Not Mine",
        event_date: today(),
        location_text: "Nowhere",
      })
      .select("id")
      .single();
    // otherSeller belongs to `stranger`, so this is refused.
    expect(created.error).not.toBeNull();

    const mine = await sellerUser.db
      .from("events")
      .insert({
        seller_id: seller.id,
        state: "TX",
        title: "IT Mine",
        event_date: today(),
        location_text: "The farm",
      })
      .select("id")
      .single();
    expect(mine.error).toBeNull();
    if (mine.data) eventIds.push(mine.data.id);

    const removed = await sellerUser.db.from("events").delete().eq("id", mine.data!.id);
    expect(removed.error).toBeNull();
  });
});
