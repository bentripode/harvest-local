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
 * Follows carry a privacy split that is easy to get backwards: how many people follow something is
 * public, and who they are is not. The counts appear on storefront and market pages; the rows have
 * no policy at all that lets one person read another's.
 *
 * The other thing worth pinning is the cleanup triggers. `target_id` has no foreign key — it points
 * at three tables — so a deleted seller would otherwise leave a row that keeps being counted.
 */
describeDb("follows", () => {
  let alice: TestUser;
  let bob: TestUser;
  let sellerUser: TestUser;
  let seller: { id: string };
  let marketId: string;
  const stamp = Date.now();

  beforeAll(async () => {
    alice = await createTestUser({ homeState: "TX" });
    bob = await createTestUser({ homeState: "TX" });
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });

    const { data: market, error } = await adminDb()
      .from("markets")
      .insert({ slug: `it-follow-${stamp}`, name: "IT Follow Market", state: "TX" })
      .select("id")
      .single();
    if (error) throw new Error(`market fixture: ${error.message}`);
    marketId = market!.id;
  });

  afterAll(async () => {
    await adminDb().from("markets").delete().eq("id", marketId);
    await cleanupAll();
  });

  it("lets a signed-in user follow a seller", async () => {
    const { error } = await alice.db
      .from("follows")
      .insert({ profile_id: alice.id, target_type: "seller", target_id: seller.id });
    expect(error).toBeNull();
  });

  it("refuses a second follow of the same thing", async () => {
    const { error } = await alice.db
      .from("follows")
      .insert({ profile_id: alice.id, target_type: "seller", target_id: seller.id });
    expect(error?.code).toBe("23505");
  });

  it("refuses a follow filed under someone else's name", async () => {
    const { error } = await bob.db
      .from("follows")
      .insert({ profile_id: alice.id, target_type: "seller", target_id: seller.id });
    expect(error).not.toBeNull();
  });

  it("refuses an unrecognised target type", async () => {
    const { error } = await alice.db
      .from("follows")
      .insert({ profile_id: alice.id, target_type: "planet", target_id: seller.id });
    expect(error).not.toBeNull();
  });

  it("refuses a follow from a signed-out visitor", async () => {
    const { error } = await anonDb()
      .from("follows")
      .insert({ profile_id: alice.id, target_type: "seller", target_id: seller.id });
    expect(error).not.toBeNull();
  });

  it("never lets one person read another's follows", async () => {
    const asBob = await bob.db.from("follows").select("id").eq("target_id", seller.id);
    expect(asBob.data ?? []).toHaveLength(0);

    const asAnon = await anonDb().from("follows").select("id").eq("target_id", seller.id);
    expect(asAnon.data ?? []).toHaveLength(0);

    // Alice still sees her own.
    const mine = await alice.db.from("follows").select("id").eq("target_id", seller.id);
    expect(mine.data ?? []).toHaveLength(1);
  });

  it("publishes the count to anyone, without the names", async () => {
    await bob.db
      .from("follows")
      .insert({ profile_id: bob.id, target_type: "seller", target_id: seller.id });

    const { data, error } = await anonDb().rpc("follower_counts", {
      p_target_type: "seller",
      p_target_ids: [seller.id],
    });
    expect(error).toBeNull();

    const row = (data ?? [])[0];
    expect(Number(row.follower_count)).toBe(2);
    expect(Object.keys(row).sort()).toEqual(["follower_count", "target_id"]);
  });

  it("counts a batch of targets in one call", async () => {
    await alice.db
      .from("follows")
      .insert({ profile_id: alice.id, target_type: "market", target_id: marketId });

    const { data } = await anonDb().rpc("follower_counts", {
      p_target_type: "market",
      p_target_ids: [marketId, seller.id],
    });
    // Only the market has market-follows; the seller id is a different target type.
    expect((data ?? []).length).toBe(1);
    expect((data ?? [])[0].target_id).toBe(marketId);
  });

  it("will not hand a list of followers to a signed-in user", async () => {
    const { error } = await alice.db.rpc("followers_to_notify", {
      p_target_type: "seller",
      p_target_id: seller.id,
    });
    expect(error).not.toBeNull();
  });

  it("will not hand a list of followers to a signed-out visitor", async () => {
    const { error } = await anonDb().rpc("followers_to_notify", {
      p_target_type: "seller",
      p_target_id: seller.id,
    });
    expect(error).not.toBeNull();
  });

  it("clears follows when the followed thing is deleted, so counts stay honest", async () => {
    const { data: market } = await adminDb()
      .from("markets")
      .insert({ slug: `it-doomed-${stamp}`, name: "IT Doomed Market", state: "TX" })
      .select("id")
      .single();

    await alice.db
      .from("follows")
      .insert({ profile_id: alice.id, target_type: "market", target_id: market!.id });

    const before = await anonDb().rpc("follower_counts", {
      p_target_type: "market",
      p_target_ids: [market!.id],
    });
    expect(Number((before.data ?? [])[0].follower_count)).toBe(1);

    await adminDb().from("markets").delete().eq("id", market!.id);

    const after = await anonDb().rpc("follower_counts", {
      p_target_type: "market",
      p_target_ids: [market!.id],
    });
    expect(after.data ?? []).toHaveLength(0);
  });
});
