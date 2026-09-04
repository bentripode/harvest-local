import { afterAll, beforeAll, expect, it } from "vitest";

import {
  adminDb,
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
});
