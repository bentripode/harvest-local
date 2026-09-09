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
 * The payout mirror, at the data layer.
 *
 * The property worth protecting is that a seller can READ this and write none of it. A payout row
 * is a claim about what a bank did; one a seller could edit would be a record that disagrees with
 * the bank while looking authoritative. There is no INSERT or UPDATE policy at all, so the only
 * writer is the service role in the webhook.
 */

describeDb("payouts RLS", () => {
  let sellerUser: TestUser;
  let stranger: TestUser;
  let admin: TestUser;
  let seller: { id: string };
  let otherSeller: { id: string };
  let payoutId: string;
  const payoutIds: string[] = [];
  const stamp = Date.now();

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    stranger = await createTestUser({ role: "seller", homeState: "TX" });
    admin = await createTestUser({ role: "admin", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
    otherSeller = await createSeller(stranger.id, { homeState: "TX" });

    const { data, error } = await adminDb()
      .from("payouts")
      .insert({
        seller_id: seller.id,
        stripe_payout_id: `po_it_${stamp}`,
        amount: "372.18",
        currency: "usd",
        status: "paid",
        arrival_date: "2026-12-14",
      })
      .select("id")
      .single();
    if (error) throw new Error(`payout fixture: ${error.message}`);
    payoutId = data!.id;
    payoutIds.push(payoutId);
  });

  afterAll(async () => {
    if (payoutIds.length > 0) await adminDb().from("payouts").delete().in("id", payoutIds);
    await cleanupAll();
  });

  it("lets a seller read their own payouts", async () => {
    const { data, error } = await sellerUser.db
      .from("payouts")
      .select("stripe_payout_id, amount, status")
      .eq("id", payoutId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.status).toBe("paid");
    expect(Number(data?.amount)).toBe(372.18);
  });

  it("pins how numeric ACTUALLY arrives, which is not what db/types.ts claims", async () => {
    // `MoneyFixed` in src/lib/db/types.ts corrects every money column to `string`, on the stated
    // grounds that "Postgres numeric crosses the wire as text". Against this PostgREST it does not:
    // payouts.amount, orders.total and refunds.amount all arrive as JS numbers.
    //
    // Nothing is broken by it — every money read in the app goes through `toCents`, which accepts
    // `string | number` — but the declared type is wrong, and code trusting it (a string method on
    // a total, say) would compile and then fail at runtime.
    //
    // Asserted rather than commented so that if the wire format ever does change to text, this
    // fails and tells someone, instead of the types quietly becoming right by accident.
    const { data } = await adminDb()
      .from("payouts")
      .select("amount")
      .eq("id", payoutId)
      .single();
    expect(typeof data!.amount).toBe("number");
  });

  it("hides one seller's payouts from another", async () => {
    const { data } = await stranger.db
      .from("payouts")
      .select("id")
      .eq("id", payoutId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("shows nothing at all to a signed-out visitor", async () => {
    // Not merely filtered: `select` is not granted to anon on this table.
    const { data, error } = await anonDb().from("payouts").select("id").eq("id", payoutId);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("lets an admin read across sellers", async () => {
    const { data } = await admin.db.from("payouts").select("id").eq("id", payoutId).maybeSingle();
    expect(data?.id).toBe(payoutId);
  });

  it("refuses a write from the seller who owns the row", async () => {
    // There is no UPDATE policy, so this affects nothing. The unchanged amount is what proves it.
    await sellerUser.db.from("payouts").update({ amount: "999.99" }).eq("id", payoutId);

    const { data } = await adminDb()
      .from("payouts")
      .select("amount")
      .eq("id", payoutId)
      .single();
    expect(Number(data!.amount)).toBe(372.18);
  });

  it("refuses an insert from a seller inventing a payout to themselves", async () => {
    const { error } = await sellerUser.db.from("payouts").insert({
      seller_id: seller.id,
      stripe_payout_id: `po_it_fake_${stamp}`,
      amount: "10000.00",
      currency: "usd",
      status: "paid",
    });
    expect(error).not.toBeNull();
  });

  it("refuses a delete from the seller", async () => {
    await sellerUser.db.from("payouts").delete().eq("id", payoutId);

    const { data } = await adminDb().from("payouts").select("id").eq("id", payoutId).maybeSingle();
    expect(data?.id).toBe(payoutId);
  });

  it("takes one row per Stripe payout, so a redelivery updates rather than duplicates", async () => {
    // What makes the webhook idempotent: a Payout is a full snapshot, and the unique id means the
    // second delivery of any of its five events writes the same row again.
    const duplicate = await adminDb().from("payouts").insert({
      seller_id: seller.id,
      stripe_payout_id: `po_it_${stamp}`,
      amount: "372.18",
      currency: "usd",
      status: "paid",
    });
    expect(duplicate.error?.code).toBe("23505");

    const upserted = await adminDb()
      .from("payouts")
      .upsert(
        {
          seller_id: seller.id,
          stripe_payout_id: `po_it_${stamp}`,
          amount: "372.18",
          currency: "usd",
          status: "in_transit",
        },
        { onConflict: "stripe_payout_id" },
      )
      .select("id, status")
      .single();

    expect(upserted.error).toBeNull();
    expect(upserted.data!.id).toBe(payoutId);
    expect(upserted.data!.status).toBe("in_transit");

    await adminDb().from("payouts").update({ status: "paid" }).eq("id", payoutId);
  });

  it("keeps a payout tied to a real seller", async () => {
    const { error } = await adminDb().from("payouts").insert({
      seller_id: "00000000-0000-0000-0000-000000000000",
      stripe_payout_id: `po_it_orphan_${stamp}`,
      amount: "1.00",
      currency: "usd",
      status: "paid",
    });
    expect(error?.code).toBe("23503");
  });

  it("cascades away with the storefront, leaving no orphan money records", async () => {
    const { data } = await adminDb()
      .from("payouts")
      .insert({
        seller_id: otherSeller.id,
        stripe_payout_id: `po_it_cascade_${stamp}`,
        amount: "5.00",
        currency: "usd",
        status: "paid",
      })
      .select("id")
      .single();

    await adminDb().from("seller_profiles").delete().eq("id", otherSeller.id);

    const { data: after } = await adminDb()
      .from("payouts")
      .select("id")
      .eq("id", data!.id)
      .maybeSingle();
    expect(after).toBeNull();
  });
});
