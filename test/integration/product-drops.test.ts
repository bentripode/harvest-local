import { afterAll, beforeAll, expect, it } from "vitest";

import {
  addOrderItem,
  adminDb,
  anonDb,
  cleanupAll,
  createOrder,
  createProduct,
  createSeller,
  createTestUser,
  describeDb,
  type TestUser,
} from "./helpers";

/**
 * Pre-order batches, at the data layer.
 *
 * One property is worth more than all the others here: **it must under-sell, never over-sell**. A
 * seller handed a twenty-first order for a twenty-loaf bake cannot solve it at 6am on Saturday.
 * Every test below is either that property directly, or the thing that would quietly break it —
 * a race that both sides win, a seller who can zero the counter, a release that runs twice.
 */

const HOUR = 3_600_000;
const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();
const today = () => new Date().toISOString().slice(0, 10);

describeDb("claim_drop_units", () => {
  let sellerUser: TestUser;
  let buyer: TestUser;
  let seller: { id: string };
  const dropIds: string[] = [];

  // A fresh listing per batch. `product_drops_no_overlap` allows one live window per product by
  // design, so sharing a listing across these cases would be testing the constraint, not the
  // function — and every one of them needs a batch that is open right now.
  async function makeDrop(over: Record<string, unknown> = {}) {
    const own = await createProduct(seller.id, { quantity: 100 });
    const { data, error } = await adminDb()
      .from("product_drops")
      .insert({
        seller_id: seller.id,
        product_id: own.id,
        name: "IT Batch",
        opens_at: iso(-HOUR),
        closes_at: iso(24 * HOUR),
        fulfillment_date: today(),
        unit_cap: 10,
        ...over,
      })
      .select("id")
      .single();
    if (error) throw new Error(`makeDrop: ${error.message}`);
    dropIds.push(data!.id);
    return data!.id;
  }

  async function claimed(dropId: string) {
    const { data } = await adminDb()
      .from("product_drops")
      .select("units_claimed")
      .eq("id", dropId)
      .single();
    return data!.units_claimed;
  }

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    buyer = await createTestUser({ homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
  });

  afterAll(async () => {
    if (dropIds.length > 0) await adminDb().from("product_drops").delete().in("id", dropIds);
    await cleanupAll();
  });

  it("counts units up and reports the new total", async () => {
    const id = await makeDrop();
    const { data, error } = await adminDb().rpc("claim_drop_units", { p_drop_id: id, p_units: 3 });
    expect(error).toBeNull();
    expect(data).toBe(3);
    expect(await claimed(id)).toBe(3);
  });

  it("refuses to go past the cap, and says how many are left", async () => {
    const id = await makeDrop({ unit_cap: 5 });
    await adminDb().rpc("claim_drop_units", { p_drop_id: id, p_units: 4 });

    const { error } = await adminDb().rpc("claim_drop_units", { p_drop_id: id, p_units: 2 });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/only 1 left/i);

    // And nothing moved: a refusal is not a partial claim.
    expect(await claimed(id)).toBe(4);
  });

  it("lets exactly one of two buyers racing for the last unit win", async () => {
    // THE test. `select ... for update` serialises the two transactions; the loser is refused by
    // the CHECK rather than by a count it read a moment before the other one committed.
    const id = await makeDrop({ unit_cap: 1 });

    const results = await Promise.all([
      adminDb().rpc("claim_drop_units", { p_drop_id: id, p_units: 1 }),
      adminDb().rpc("claim_drop_units", { p_drop_id: id, p_units: 1 }),
    ]);

    const won = results.filter((r) => r.error === null);
    const lost = results.filter((r) => r.error !== null);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(await claimed(id)).toBe(1);
  });

  it("holds the cap under a burst far larger than the batch", async () => {
    const id = await makeDrop({ unit_cap: 4 });

    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        adminDb().rpc("claim_drop_units", { p_drop_id: id, p_units: 1 }),
      ),
    );

    expect(results.filter((r) => r.error === null)).toHaveLength(4);
    expect(await claimed(id)).toBe(4);
  });

  it("refuses before the window opens and after it closes", async () => {
    const early = await makeDrop({ opens_at: iso(HOUR), closes_at: iso(48 * HOUR) });
    const late = await makeDrop({ opens_at: iso(-48 * HOUR), closes_at: iso(-HOUR) });

    const a = await adminDb().rpc("claim_drop_units", { p_drop_id: early, p_units: 1 });
    expect(a.error?.message).toMatch(/have not opened yet/i);

    const b = await adminDb().rpc("claim_drop_units", { p_drop_id: late, p_units: 1 });
    expect(b.error?.message).toMatch(/have closed/i);
  });

  it("refuses a cancelled batch", async () => {
    const id = await makeDrop({ cancelled_at: iso(0) });
    const { error } = await adminDb().rpc("claim_drop_units", { p_drop_id: id, p_units: 1 });
    expect(error!.message).toMatch(/cancelled/i);
  });

  it("refuses a claim of nothing", async () => {
    const id = await makeDrop();
    const { error } = await adminDb().rpc("claim_drop_units", { p_drop_id: id, p_units: 0 });
    expect(error).not.toBeNull();
  });

  it("is not reachable by a buyer or a signed-out visitor", async () => {
    // Granted to service_role alone. A buyer who could call it directly could claim out a rival's
    // batch, or claim units with no order behind them.
    const id = await makeDrop();

    const asBuyer = await buyer.db.rpc("claim_drop_units", { p_drop_id: id, p_units: 1 });
    expect(asBuyer.error?.code).toBe("42501");

    const asAnon = await anonDb().rpc("claim_drop_units", { p_drop_id: id, p_units: 1 });
    expect(asAnon.error?.code).toBe("42501");

    // Nor by the seller who owns it.
    const asSeller = await sellerUser.db.rpc("claim_drop_units", { p_drop_id: id, p_units: 1 });
    expect(asSeller.error?.code).toBe("42501");

    expect(await claimed(id)).toBe(0);
  });
});

describeDb("releasing units", () => {
  let sellerUser: TestUser;
  let buyer: TestUser;
  let seller: { id: string };
  let product: { id: string; title: string };
  const dropIds: string[] = [];

  // One live window per listing (see the note in the suite above), so each batch gets its own —
  // returned alongside the drop, because the order items have to point at the same listing.
  async function makeDrop(cap = 10) {
    const own = await createProduct(seller.id, { quantity: 100 });
    const { data, error } = await adminDb()
      .from("product_drops")
      .insert({
        seller_id: seller.id,
        product_id: own.id,
        name: "IT Release Batch",
        opens_at: iso(-HOUR),
        closes_at: iso(24 * HOUR),
        fulfillment_date: today(),
        unit_cap: cap,
      })
      .select("id")
      .single();
    if (error) throw new Error(`makeDrop: ${error.message}`);
    dropIds.push(data!.id);
    return { dropId: data!.id, product: own };
  }

  async function claimed(dropId: string) {
    const { data } = await adminDb()
      .from("product_drops")
      .select("units_claimed")
      .eq("id", dropId)
      .single();
    return data!.units_claimed;
  }

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    buyer = await createTestUser({ homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
    product = await createProduct(seller.id, { quantity: 100 });
  });

  afterAll(async () => {
    if (dropIds.length > 0) await adminDb().from("product_drops").delete().in("id", dropIds);
    await cleanupAll();
  });

  it("gives an order's units back and is a no-op the second time", async () => {
    // Idempotence is not a nicety: the callers are a Stripe webhook and a status transition, and
    // Stripe redelivers (CLAUDE.md rule 2). A release that ran twice would oversell the batch.
    const { dropId, product: item } = await makeDrop();
    await adminDb().rpc("claim_drop_units", { p_drop_id: dropId, p_units: 3 });

    const order = await createOrder({ buyerId: buyer.id, sellerId: seller.id, buyerState: "TX" });
    await addOrderItem(order.id, item, { quantity: 3, dropId });

    const first = await adminDb().rpc("release_drop_units_for_order", { p_order_id: order.id });
    expect(first.error).toBeNull();
    expect(first.data).toBe(3);
    expect(await claimed(dropId)).toBe(0);

    const second = await adminDb().rpc("release_drop_units_for_order", { p_order_id: order.id });
    expect(second.error).toBeNull();
    expect(second.data).toBe(0);
    expect(await claimed(dropId)).toBe(0);
  });

  it("clears the link off the items, which is what makes the second call a no-op", async () => {
    const { dropId, product: item } = await makeDrop();
    await adminDb().rpc("claim_drop_units", { p_drop_id: dropId, p_units: 2 });

    const order = await createOrder({ buyerId: buyer.id, sellerId: seller.id, buyerState: "TX" });
    await addOrderItem(order.id, item, { quantity: 2, dropId });
    await adminDb().rpc("release_drop_units_for_order", { p_order_id: order.id });

    const { data } = await adminDb()
      .from("order_items")
      .select("drop_id, drop_snapshot")
      .eq("order_id", order.id);
    expect(data!.every((i) => i.drop_id === null)).toBe(true);
  });

  it("releases across several lines of one order", async () => {
    const { dropId, product: item } = await makeDrop();
    await adminDb().rpc("claim_drop_units", { p_drop_id: dropId, p_units: 5 });

    const order = await createOrder({ buyerId: buyer.id, sellerId: seller.id, buyerState: "TX" });
    await addOrderItem(order.id, item, { quantity: 2, dropId });
    await addOrderItem(order.id, item, { quantity: 3, dropId });

    const { data } = await adminDb().rpc("release_drop_units_for_order", { p_order_id: order.id });
    expect(data).toBe(5);
    expect(await claimed(dropId)).toBe(0);
  });

  it("leaves an order with no batch alone", async () => {
    const order = await createOrder({ buyerId: buyer.id, sellerId: seller.id, buyerState: "TX" });
    await addOrderItem(order.id, product, { quantity: 1 });

    const { data, error } = await adminDb().rpc("release_drop_units_for_order", {
      p_order_id: order.id,
    });
    expect(error).toBeNull();
    expect(data).toBe(0);
  });

  it("release_drop_units hands back exactly what a failed checkout took", async () => {
    // The compensating path: units are claimed before the order rows exist, so when the write
    // fails there is no order to key a release on.
    const { dropId } = await makeDrop();
    await adminDb().rpc("claim_drop_units", { p_drop_id: dropId, p_units: 4 });

    const { data, error } = await adminDb().rpc("release_drop_units", {
      p_drop_id: dropId,
      p_units: 4,
    });
    expect(error).toBeNull();
    expect(data).toBe(0);
  });

  it("never drives the count below zero", async () => {
    // Under-counting shows up as a batch with room in it. A negative would read as extra capacity.
    const { dropId } = await makeDrop();
    await adminDb().rpc("claim_drop_units", { p_drop_id: dropId, p_units: 1 });
    await adminDb().rpc("release_drop_units", { p_drop_id: dropId, p_units: 5 });
    expect(await claimed(dropId)).toBe(0);
  });

  it("keeps both release functions away from buyers and sellers", async () => {
    const { dropId } = await makeDrop();
    await adminDb().rpc("claim_drop_units", { p_drop_id: dropId, p_units: 2 });

    const a = await buyer.db.rpc("release_drop_units", { p_drop_id: dropId, p_units: 2 });
    expect(a.error?.code).toBe("42501");

    const b = await sellerUser.db.rpc("release_drop_units", { p_drop_id: dropId, p_units: 2 });
    expect(b.error?.code).toBe("42501");

    const c = await anonDb().rpc("release_drop_units_for_order", {
      p_order_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(c.error?.code).toBe("42501");

    expect(await claimed(dropId)).toBe(2);
  });
});

describeDb("product_drops RLS and guards", () => {
  let sellerUser: TestUser;
  let stranger: TestUser;
  let seller: { id: string };
  let otherSeller: { id: string };
  let product: { id: string; title: string };
  let dropId: string;
  const dropIds: string[] = [];

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    stranger = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
    otherSeller = await createSeller(stranger.id, { homeState: "TX" });
    product = await createProduct(seller.id, { quantity: 100 });

    const { data, error } = await adminDb()
      .from("product_drops")
      .insert({
        seller_id: seller.id,
        product_id: product.id,
        name: "IT Guarded Batch",
        opens_at: iso(-HOUR),
        closes_at: iso(24 * HOUR),
        fulfillment_date: today(),
        unit_cap: 10,
      })
      .select("id")
      .single();
    if (error) throw new Error(`drop fixture: ${error.message}`);
    dropId = data!.id;
    dropIds.push(dropId);
    await adminDb().rpc("claim_drop_units", { p_drop_id: dropId, p_units: 4 });
  });

  afterAll(async () => {
    if (dropIds.length > 0) await adminDb().from("product_drops").delete().in("id", dropIds);
    await cleanupAll();
  });

  async function row() {
    const { data } = await adminDb()
      .from("product_drops")
      .select("unit_cap, units_claimed, product_id, seller_id")
      .eq("id", dropId)
      .single();
    return data!;
  }

  it("is readable by a signed-out visitor, because the listing is", async () => {
    const { data } = await anonDb()
      .from("product_drops")
      .select("id, unit_cap, units_claimed")
      .eq("id", dropId)
      .maybeSingle();
    expect(data?.id).toBe(dropId);
    // The number left is the whole proposition, so it is public on purpose.
    expect(data?.units_claimed).toBe(4);
  });

  it("hides a batch whose listing isn't live", async () => {
    await adminDb().from("products").update({ status: "draft" }).eq("id", product.id);

    const { data } = await anonDb()
      .from("product_drops")
      .select("id")
      .eq("id", dropId)
      .maybeSingle();
    expect(data).toBeNull();

    // Its own seller still sees it — a draft listing is still theirs to plan around.
    const mine = await sellerUser.db
      .from("product_drops")
      .select("id")
      .eq("id", dropId)
      .maybeSingle();
    expect(mine.data?.id).toBe(dropId);

    await adminDb().from("products").update({ status: "active" }).eq("id", product.id);
  });

  it("will not let the owning seller move the claim count", async () => {
    // An UPDATE policy wide enough to edit the name is wide enough to zero the counter, which is
    // exactly how a batch gets oversold. `product_drops_guard_claims` closes that.
    const { error } = await sellerUser.db
      .from("product_drops")
      .update({ units_claimed: 0 })
      .eq("id", dropId);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/maintained by the platform/i);
    expect((await row()).units_claimed).toBe(4);
  });

  it("will not let a seller move a batch to another listing or another storefront", async () => {
    const move = await sellerUser.db
      .from("product_drops")
      .update({ seller_id: otherSeller.id })
      .eq("id", dropId);
    expect(move.error).not.toBeNull();
    expect((await row()).seller_id).toBe(seller.id);
  });

  it("lets a seller raise the cap — they decided to bake more", async () => {
    const { error } = await sellerUser.db
      .from("product_drops")
      .update({ unit_cap: 20 })
      .eq("id", dropId);
    expect(error).toBeNull();
    expect((await row()).unit_cap).toBe(20);
  });

  it("refuses a cap below what buyers have already ordered", async () => {
    // Those four orders exist. Lowering the cap under them would make the row describe a promise
    // the seller has already broken.
    const { error } = await sellerUser.db
      .from("product_drops")
      .update({ unit_cap: 2 })
      .eq("id", dropId);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/product_drops_within_cap/i);
  });

  it("keeps a stranger out of someone else's batch", async () => {
    // RLS filters rather than errors, so what proves the policy held is the row being unchanged.
    await stranger.db.from("product_drops").update({ name: "Hijacked" }).eq("id", dropId);

    const { data } = await adminDb()
      .from("product_drops")
      .select("name")
      .eq("id", dropId)
      .single();
    expect(data!.name).toBe("IT Guarded Batch");
  });

  it("refuses a second batch whose order window overlaps the first", async () => {
    // Two live windows on one listing leave no answer to "which batch is this order for", and the
    // ambiguity would reach a buyer as a wrong collection date.
    const { error } = await adminDb()
      .from("product_drops")
      .insert({
        seller_id: seller.id,
        product_id: product.id,
        name: "IT Overlapping",
        opens_at: iso(HOUR),
        closes_at: iso(48 * HOUR),
        fulfillment_date: today(),
        unit_cap: 5,
      })
      .select("id")
      .single();
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/product_drops_no_overlap/i);
  });

  it("allows a back-to-back batch that starts after the first one closes", async () => {
    const { data, error } = await adminDb()
      .from("product_drops")
      .insert({
        seller_id: seller.id,
        product_id: product.id,
        name: "IT Next Week",
        opens_at: iso(25 * HOUR),
        closes_at: iso(72 * HOUR),
        fulfillment_date: today(),
        unit_cap: 5,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    if (data) dropIds.push(data.id);
  });

  it("stops excluding a cancelled batch, so the seller can reschedule over it", async () => {
    const { data: cancelled } = await adminDb()
      .from("product_drops")
      .insert({
        seller_id: seller.id,
        product_id: product.id,
        name: "IT Called Off",
        opens_at: iso(100 * HOUR),
        closes_at: iso(120 * HOUR),
        fulfillment_date: today(),
        unit_cap: 5,
        cancelled_at: iso(0),
      })
      .select("id")
      .single();
    if (cancelled) dropIds.push(cancelled.id);

    const { data, error } = await adminDb()
      .from("product_drops")
      .insert({
        seller_id: seller.id,
        product_id: product.id,
        name: "IT Replacement",
        opens_at: iso(100 * HOUR),
        closes_at: iso(120 * HOUR),
        fulfillment_date: today(),
        unit_cap: 5,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    if (data) dropIds.push(data.id);
  });

  it("refuses a window that closes before it opens", async () => {
    const { error } = await adminDb()
      .from("product_drops")
      .insert({
        seller_id: seller.id,
        product_id: product.id,
        name: "IT Backwards",
        opens_at: iso(200 * HOUR),
        closes_at: iso(150 * HOUR),
        fulfillment_date: today(),
        unit_cap: 5,
      });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/product_drops_window/i);
  });
});
