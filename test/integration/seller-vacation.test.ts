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
 * A seller's own "closed for now" switch, and the precedence around it.
 *
 * The hazard this design exists to avoid: if `vacation` were just another `pause_reason`, a seller
 * paused for a holiday whose licence then lapsed would keep the reason `vacation` — and ending the
 * holiday would set them live with no valid licence. So intent (`on_vacation`) and verdict
 * (`is_paused` / `pause_reason`) are separate columns and only `sync_seller_license_pause` derives
 * the second. These tests are mostly about that not regressing.
 */
describeDb("set_seller_vacation", () => {
  let sellerUser: TestUser;
  let stranger: TestUser;
  let seller: { id: string };

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    stranger = await createTestUser({ homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
  });

  afterAll(cleanupAll);

  async function state() {
    const { data } = await adminDb()
      .from("seller_profiles")
      .select("is_paused, pause_reason, on_vacation")
      .eq("id", seller.id)
      .single();
    return data!;
  }

  async function setPause(reason: string | null, paused: boolean) {
    await adminDb()
      .from("seller_profiles")
      .update({ is_paused: paused, pause_reason: reason })
      .eq("id", seller.id);
  }

  it("refuses to close a storefront that isn't yours", async () => {
    const { error } = await stranger.db.rpc("set_seller_vacation", {
      p_seller_id: seller.id,
      p_on: true,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not your storefront/i);
  });

  it("refuses anonymously", async () => {
    const { error } = await anonDb().rpc("set_seller_vacation", {
      p_seller_id: seller.id,
      p_on: true,
    });
    expect(error).not.toBeNull();
  });

  it("will not let a seller write on_vacation directly, only through the function", async () => {
    const { error } = await sellerUser.db
      .from("seller_profiles")
      .update({ on_vacation: true })
      .eq("id", seller.id);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/protected seller_profiles columns/i);
  });

  it("closes and reopens a storefront with nothing else wrong", async () => {
    await setPause(null, false);

    const close = await sellerUser.db.rpc("set_seller_vacation", {
      p_seller_id: seller.id,
      p_on: true,
    });
    expect(close.error).toBeNull();

    let s = await state();
    expect(s.is_paused).toBe(true);
    expect(s.pause_reason).toBe("vacation");
    expect(s.on_vacation).toBe(true);

    const open = await sellerUser.db.rpc("set_seller_vacation", {
      p_seller_id: seller.id,
      p_on: false,
    });
    expect(open.error).toBeNull();

    s = await state();
    expect(s.is_paused).toBe(false);
    expect(s.pause_reason).toBeNull();
    expect(s.on_vacation).toBe(false);
  });

  // ---- the precedence that matters --------------------------------------

  it("cannot lift a revenue-cap pause by ending a holiday", async () => {
    await setPause("revenue_cap", true);

    await sellerUser.db.rpc("set_seller_vacation", { p_seller_id: seller.id, p_on: true });
    await sellerUser.db.rpc("set_seller_vacation", { p_seller_id: seller.id, p_on: false });

    const s = await state();
    expect(s.is_paused).toBe(true);
    expect(s.pause_reason).toBe("revenue_cap");
  });

  it("cannot lift an admin pause by ending a holiday", async () => {
    await setPause("admin", true);

    await sellerUser.db.rpc("set_seller_vacation", { p_seller_id: seller.id, p_on: false });

    const s = await state();
    expect(s.is_paused).toBe(true);
    expect(s.pause_reason).toBe("admin");
  });

  it("cannot lift an onboarding pause by ending a holiday", async () => {
    await setPause("onboarding_incomplete", true);

    await sellerUser.db.rpc("set_seller_vacation", { p_seller_id: seller.id, p_on: false });

    const s = await state();
    expect(s.is_paused).toBe(true);
    expect(s.pause_reason).toBe("onboarding_incomplete");
  });

  it("a compliance pause takes the row from a holiday, and ending the holiday does not give it back", async () => {
    // On holiday, everything else fine.
    await setPause(null, false);
    await sellerUser.db.rpc("set_seller_vacation", { p_seller_id: seller.id, p_on: true });
    expect((await state()).pause_reason).toBe("vacation");

    // The licence check now fails — sync overwrites the weaker reason.
    const sync = await adminDb().rpc("sync_seller_license_pause", { p_seller_id: seller.id });
    expect(sync.error).toBeNull();

    const paused = await state();
    expect(paused.is_paused).toBe(true);
    // Whatever it is now, it is no longer the seller's to lift.
    expect(paused.pause_reason).not.toBe("vacation");

    // And ending the holiday leaves them closed.
    await sellerUser.db.rpc("set_seller_vacation", { p_seller_id: seller.id, p_on: false });
    const after = await state();
    expect(after.is_paused).toBe(true);
    expect(after.pause_reason).not.toBeNull();
    expect(after.on_vacation).toBe(false);
  });
});

describeDb("a storefront closed by its seller stays readable", () => {
  let sellerUser: TestUser;
  let seller: { id: string };

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
  });

  afterAll(cleanupAll);

  it("is visible to a signed-out visitor when the reason is vacation", async () => {
    await adminDb()
      .from("seller_profiles")
      .update({ is_paused: true, pause_reason: "vacation", on_vacation: true })
      .eq("id", seller.id);

    const { data } = await anonDb()
      .from("seller_profiles")
      .select("id")
      .eq("id", seller.id)
      .maybeSingle();
    expect(data?.id).toBe(seller.id);
  });

  it("is hidden when the reason is one of ours", async () => {
    for (const reason of ["license_unverified", "license_expired", "revenue_cap", "admin"]) {
      await adminDb()
        .from("seller_profiles")
        .update({ is_paused: true, pause_reason: reason })
        .eq("id", seller.id);

      const { data } = await anonDb()
        .from("seller_profiles")
        .select("id")
        .eq("id", seller.id)
        .maybeSingle();
      expect(data, `should be hidden while paused for ${reason}`).toBeNull();
    }
  });

  it("is still visible to its owner whatever the reason", async () => {
    await adminDb()
      .from("seller_profiles")
      .update({ is_paused: true, pause_reason: "license_expired" })
      .eq("id", seller.id);

    const { data } = await sellerUser.db
      .from("seller_profiles")
      .select("id")
      .eq("id", seller.id)
      .maybeSingle();
    expect(data?.id).toBe(seller.id);
  });
});
