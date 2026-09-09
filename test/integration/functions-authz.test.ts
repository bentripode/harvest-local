import { afterAll, beforeAll, expect, it } from "vitest";

import {
  adminDb,
  anonDb,
  cleanupAll,
  createOrder,
  createSeller,
  createTestUser,
  describeDb,
  type TestUser,
} from "./helpers";

/**
 * Authorization inside the user-callable SECURITY DEFINER functions.
 *
 * RLS is BYPASSED in a SECURITY DEFINER body, so each one has to carry its own check — and
 * `current_user` is useless there (it's the function owner, `postgres`), which is exactly how
 * `advance_order_status` ended up with no effective guard. `auth.uid()` reads the request's JWT
 * claim and DOES work correctly. These lock in the audit of every function granted to
 * `authenticated` / `anon`.
 */
describeDb("SECURITY DEFINER authorization", () => {
  let buyer: TestUser;
  let stranger: TestUser;
  let sellerUser: TestUser;
  let seller: { id: string };
  let order: { id: string };

  beforeAll(async () => {
    buyer = await createTestUser({ homeState: "TX" });
    stranger = await createTestUser({ homeState: "TX" });
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
    order = await createOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerState: "TX",
      status: "new",
    });
  });

  afterAll(cleanupAll);

  // -- get_or_create_conversation -------------------------------------------
  it("lets the order's buyer open its thread", async () => {
    const { data, error } = await buyer.db.rpc("get_or_create_conversation", {
      p_seller_id: seller.id,
      p_order_id: order.id,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  it("is idempotent — the same buyer + order returns the same thread", async () => {
    const a = await buyer.db.rpc("get_or_create_conversation", {
      p_seller_id: seller.id,
      p_order_id: order.id,
    });
    const b = await buyer.db.rpc("get_or_create_conversation", {
      p_seller_id: seller.id,
      p_order_id: order.id,
    });
    expect(a.data).toBe(b.data);
  });

  it("refuses a stranger opening someone else's order thread", async () => {
    const { error } = await stranger.db.rpc("get_or_create_conversation", {
      p_seller_id: seller.id,
      p_order_id: order.id,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not a participant/i);
  });

  it("refuses a seller opening a general thread with themselves", async () => {
    const { error } = await sellerUser.db.rpc("get_or_create_conversation", {
      p_seller_id: seller.id,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/sellers cannot start a general conversation/i);
  });

  it("refuses an unauthenticated caller", async () => {
    const { anonDb } = await import("./helpers");
    const { error } = await anonDb().rpc("get_or_create_conversation", {
      p_seller_id: seller.id,
    });
    expect(error).not.toBeNull();
  });

  // -- mark_conversation_read ----------------------------------------------
  it("refuses mark_conversation_read from a non-participant", async () => {
    const { data: convoId } = await buyer.db.rpc("get_or_create_conversation", {
      p_seller_id: seller.id,
      p_order_id: order.id,
    });

    const { error } = await stranger.db.rpc("mark_conversation_read", {
      p_conversation_id: convoId as string,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not a participant/i);
  });

  it("clears only the OTHER party's unread messages", async () => {
    const { data: convoId } = await buyer.db.rpc("get_or_create_conversation", {
      p_seller_id: seller.id,
      p_order_id: order.id,
    });
    const cid = convoId as string;

    const admin = adminDb();
    await admin.from("messages").insert([
      { conversation_id: cid, sender_id: buyer.id, body: "from the buyer" },
      { conversation_id: cid, sender_id: sellerUser.id, body: "from the seller" },
    ]);

    const { error } = await buyer.db.rpc("mark_conversation_read", { p_conversation_id: cid });
    expect(error).toBeNull();

    const { data: rows } = await admin
      .from("messages")
      .select("sender_id, read_at")
      .eq("conversation_id", cid);

    const mine = (rows ?? []).filter((m) => m.sender_id === buyer.id);
    const theirs = (rows ?? []).filter((m) => m.sender_id === sellerUser.id);
    expect(mine.every((m) => m.read_at === null)).toBe(true); // own messages untouched
    expect(theirs.every((m) => m.read_at !== null)).toBe(true);
  });

  // -- mark_notifications_read --------------------------------------------
  it("marks only the caller's own in-app notifications read", async () => {
    const admin = adminDb();
    await admin.from("notifications").insert([
      { user_id: buyer.id, channel: "in_app", template: "it_probe", payload: {} },
      { user_id: stranger.id, channel: "in_app", template: "it_probe", payload: {} },
    ]);

    const { error } = await buyer.db.rpc("mark_notifications_read");
    expect(error).toBeNull();

    const mine = await admin
      .from("notifications")
      .select("read_at")
      .eq("user_id", buyer.id)
      .eq("template", "it_probe");
    const theirs = await admin
      .from("notifications")
      .select("read_at")
      .eq("user_id", stranger.id)
      .eq("template", "it_probe");

    expect((mine.data ?? []).every((n) => n.read_at !== null)).toBe(true);
    expect((theirs.data ?? []).every((n) => n.read_at === null)).toBe(true);
  });

  // -- upsert_address (SECURITY INVOKER — RLS applies) ---------------------
  it("refuses upsert_address against another user's address row", async () => {
    const mine = await buyer.db.rpc("upsert_address", {
      p_label: "Home",
      p_line1: "1 Main St",
      p_line2: "",
      p_city: "Austin",
      p_state: "TX",
      p_postal: "78701",
      p_lng: -97.74,
      p_lat: 30.27,
    });
    expect(mine.error).toBeNull();
    const addressId = mine.data as unknown as string;

    const hijack = await stranger.db.rpc("upsert_address", {
      p_id: addressId,
      p_label: "Hijacked",
      p_line1: "666 Evil St",
      p_line2: "",
      p_city: "Austin",
      p_state: "TX",
      p_postal: "78701",
      p_lng: -97.74,
      p_lat: 30.27,
    });
    expect(hijack.error).not.toBeNull();

    const { data: row } = await adminDb()
      .from("addresses")
      .select("line1, user_id")
      .eq("id", addressId)
      .single();
    expect(row?.line1).toBe("1 Main St");
    expect(row?.user_id).toBe(buyer.id);
  });

  // -- the license gate (service-role only) --------------------------------
  it("sync_seller_license_pause is not reachable by an authenticated client", async () => {
    const { error } = await buyer.db.rpc("sync_seller_license_pause", {
      p_seller_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
  });

  it("seller_has_required_documents is not reachable by an authenticated client", async () => {
    const { error } = await buyer.db.rpc("seller_has_required_documents", {
      p_seller_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
  });

  it("seller_sells_cottage_food is not reachable by an authenticated client", async () => {
    const { error } = await buyer.db.rpc("seller_sells_cottage_food", {
      p_seller_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
  });

  // -- order_pickup_address (a party to the order, and only after payment) ---
  //
  // It hands out an address that `addresses` RLS keeps owner-only, and for a cottage seller that
  // address is their house. Two ways to get it wrong: give it to a stranger, or give it away before
  // the sale.
  it("refuses order_pickup_address to someone who isn't a party to the order", async () => {
    const { error } = await stranger.db.rpc("order_pickup_address", { p_order_id: order.id });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not a party/i);
  });

  it("refuses order_pickup_address anonymously", async () => {
    const { error } = await anonDb().rpc("order_pickup_address", { p_order_id: order.id });
    expect(error).not.toBeNull();
  });

  // -- set_seller_vacation (the owner, and only the owner) ------------------
  //
  // It moves is_paused, which is the single lever every compliance gate hangs off, so a hole here
  // would let one seller close another's shop.
  it("set_seller_vacation refuses a storefront the caller does not own", async () => {
    const { error } = await buyer.db.rpc("set_seller_vacation", {
      p_seller_id: seller.id,
      p_on: true,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not your storefront/i);
  });

  it("set_seller_vacation is not reachable anonymously", async () => {
    const { error } = await anonDb().rpc("set_seller_vacation", {
      p_seller_id: seller.id,
      p_on: true,
    });
    expect(error).not.toBeNull();
  });

  // -- the market importer (service-role only) ------------------------------
  //
  // upsert_market is SECURITY DEFINER and writes the public market directory, so a hole here would
  // let any signed-in user publish a page under our domain.
  it("upsert_market is not reachable by an authenticated client", async () => {
    const { error } = await buyer.db.rpc("upsert_market", {
      p_source: "usda",
      p_source_id: `authz-probe-${Date.now()}`,
      p_slug: "authz-probe",
      p_name: "Authz Probe Market",
      p_state: "TX",
    });
    expect(error).not.toBeNull();
  });

  it("upsert_market is not reachable anonymously", async () => {
    const { error } = await anonDb().rpc("upsert_market", {
      p_source: "usda",
      p_source_id: `authz-probe-anon-${Date.now()}`,
      p_slug: "authz-probe-anon",
      p_name: "Authz Probe Market",
      p_state: "TX",
    });
    expect(error).not.toBeNull();
  });
});
