import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, anonDb, cleanupAll, createTestUser, describeDb, type TestUser } from "./helpers";

/**
 * The market directory is the first thing in Harvest Local built to be read by people with no
 * account, so its RLS is inverted from everything else: reads are open, writes are shut, and the
 * one path a signed-out visitor may write down — a waitlist email — must not be readable back.
 */
describeDb("markets RLS", () => {
  let buyer: TestUser;
  let admin: TestUser;
  const ids: string[] = [];
  let publishedId: string;
  let hiddenId: string;
  const stamp = Date.now();

  beforeAll(async () => {
    buyer = await createTestUser({ homeState: "TX" });
    admin = await createTestUser({ role: "admin", homeState: "TX" });

    const db = adminDb();
    const { data, error } = await db
      .from("markets")
      .insert([
        {
          slug: `it-published-${stamp}`,
          name: "IT Published Market",
          state: "TX",
          city: "Austin",
          status: "published",
        },
        {
          slug: `it-hidden-${stamp}`,
          name: "IT Hidden Market",
          state: "TX",
          city: "Austin",
          status: "hidden",
        },
      ])
      .select("id, status");
    if (error) throw new Error(`market fixture: ${error.message}`);

    for (const row of data ?? []) {
      ids.push(row.id);
      if (row.status === "published") publishedId = row.id;
      else hiddenId = row.id;
    }
  });

  afterAll(async () => {
    if (ids.length > 0) await adminDb().from("markets").delete().in("id", ids);
    await cleanupAll();
  });

  it("lets a signed-out visitor read a published market", async () => {
    const { data, error } = await anonDb()
      .from("markets")
      .select("id, name")
      .eq("id", publishedId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.name).toBe("IT Published Market");
  });

  it("hides a hidden market from anon and from an ordinary signed-in user", async () => {
    const asAnon = await anonDb().from("markets").select("id").eq("id", hiddenId).maybeSingle();
    expect(asAnon.data).toBeNull();

    const asBuyer = await buyer.db.from("markets").select("id").eq("id", hiddenId).maybeSingle();
    expect(asBuyer.data).toBeNull();
  });

  it("shows a hidden market to an admin", async () => {
    const { data } = await admin.db.from("markets").select("id").eq("id", hiddenId).maybeSingle();
    expect(data?.id).toBe(hiddenId);
  });

  it("refuses a write from anon and from a signed-in non-admin", async () => {
    const asAnon = await anonDb()
      .from("markets")
      .insert({ slug: `it-anon-${stamp}`, name: "Nope", state: "TX" });
    expect(asAnon.error).not.toBeNull();

    const asBuyer = await buyer.db
      .from("markets")
      .insert({ slug: `it-buyer-${stamp}`, name: "Nope", state: "TX" });
    expect(asBuyer.error).not.toBeNull();

    const rename = await buyer.db
      .from("markets")
      .update({ name: "Hijacked" })
      .eq("id", publishedId);
    expect(rename.error).not.toBeNull();

    const { data: row } = await adminDb()
      .from("markets")
      .select("name")
      .eq("id", publishedId)
      .single();
    expect(row?.name).toBe("IT Published Market");
  });

  it("keeps the slug unique per state but allows the same slug in another state", async () => {
    const dupe = await adminDb()
      .from("markets")
      .insert({ slug: `it-published-${stamp}`, name: "Clash", state: "TX" });
    expect(dupe.error).not.toBeNull();

    const otherState = await adminDb()
      .from("markets")
      .insert({ slug: `it-published-${stamp}`, name: "Same name, other state", state: "VT" })
      .select("id")
      .single();
    expect(otherState.error).toBeNull();
    if (otherState.data) ids.push(otherState.data.id);
  });

  it("rejects a slug that wouldn't survive a URL", async () => {
    const { error } = await adminDb()
      .from("markets")
      .insert({ slug: "Not A Slug!", name: "Bad", state: "TX" });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/markets_slug_format/i);
  });
});

describeDb("market_watchers RLS", () => {
  let buyer: TestUser;
  let stranger: TestUser;
  let marketId: string;
  const stamp = Date.now();

  beforeAll(async () => {
    buyer = await createTestUser({ homeState: "TX" });
    stranger = await createTestUser({ homeState: "TX" });

    const { data, error } = await adminDb()
      .from("markets")
      .insert({
        slug: `it-watch-${stamp}`,
        name: "IT Watchable Market",
        state: "TX",
        status: "published",
      })
      .select("id")
      .single();
    if (error) throw new Error(`market fixture: ${error.message}`);
    marketId = data!.id;
  });

  afterAll(async () => {
    await adminDb().from("markets").delete().eq("id", marketId);
    await cleanupAll();
  });

  it("lets a signed-out visitor join the waitlist — the whole point of the page", async () => {
    const { error } = await anonDb()
      .from("market_watchers")
      .insert({ market_id: marketId, email: `anon-${stamp}@example.test` });
    expect(error).toBeNull();
  });

  it("will not let anyone read the list back", async () => {
    const asAnon = await anonDb().from("market_watchers").select("email").eq("market_id", marketId);
    expect(asAnon.data ?? []).toHaveLength(0);

    // A signed-in user sees only rows they own, never the anonymous ones.
    const asStranger = await stranger.db
      .from("market_watchers")
      .select("email")
      .eq("market_id", marketId);
    expect(asStranger.data ?? []).toHaveLength(0);
  });

  it("refuses to let a signer claim someone else's account", async () => {
    const { error } = await buyer.db.from("market_watchers").insert({
      market_id: marketId,
      email: `claim-${stamp}@example.test`,
      profile_id: stranger.id,
    });
    expect(error).not.toBeNull();
  });

  it("lets a signed-in user see and remove their own row", async () => {
    const email = `mine-${stamp}@example.test`;
    const insert = await buyer.db
      .from("market_watchers")
      .insert({ market_id: marketId, email, profile_id: buyer.id });
    expect(insert.error).toBeNull();

    const read = await buyer.db.from("market_watchers").select("email").eq("market_id", marketId);
    expect((read.data ?? []).map((r) => r.email)).toEqual([email]);

    const remove = await buyer.db.from("market_watchers").delete().eq("market_id", marketId);
    expect(remove.error).toBeNull();
  });

  it("takes one signup per email per market", async () => {
    const email = `dupe-${stamp}@example.test`;
    const first = await anonDb().from("market_watchers").insert({ market_id: marketId, email });
    expect(first.error).toBeNull();

    // Same address, different case — the unique index is on lower(email).
    const second = await anonDb()
      .from("market_watchers")
      .insert({ market_id: marketId, email: email.toUpperCase() });
    expect(second.error?.code).toBe("23505");
  });

  it("rejects a malformed email at the data layer", async () => {
    const { error } = await anonDb()
      .from("market_watchers")
      .insert({ market_id: marketId, email: "not-an-email" });
    expect(error).not.toBeNull();
  });

  it("refuses a waitlist signup for a hidden market", async () => {
    const { data: hidden } = await adminDb()
      .from("markets")
      .insert({
        slug: `it-watch-hidden-${stamp}`,
        name: "IT Hidden",
        state: "TX",
        status: "hidden",
      })
      .select("id")
      .single();

    const { error } = await anonDb()
      .from("market_watchers")
      .insert({ market_id: hidden!.id, email: `hidden-${stamp}@example.test` });
    expect(error).not.toBeNull();

    await adminDb().from("markets").delete().eq("id", hidden!.id);
  });
});
