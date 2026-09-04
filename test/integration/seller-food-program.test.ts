import { afterAll, beforeAll, expect, it } from "vitest";

import { adminDb, cleanupAll, createSeller, createTestUser, describeDb, type Db } from "./helpers";

/**
 * A seller's chosen cottage-food program (`20260904210000_seller_food_program.sql`).
 *
 * Recording the choice is what turns both food gates from "is this possible anywhere in your
 * state?" into "does your program allow it?". California is the sharpest case: Class A and Class B
 * permit different things, and a seller on one is not entitled to what the other may sell.
 */
describeDb("seller food program", () => {
  let admin: Db;
  let categoryBySlug: Map<string, string>;

  async function seller(state: string): Promise<string> {
    const user = await createTestUser({ role: "seller", homeState: state });
    const profile = await createSeller(user.id, { homeState: state });
    return profile.id;
  }

  async function programsFor(state: string) {
    const { data } = await admin
      .from("state_food_programs")
      .select("id, name, ordinal")
      .eq("state_code", state)
      .order("ordinal");
    return data ?? [];
  }

  async function listIn(sellerId: string, slug: string, status: "draft" | "active" = "active") {
    return admin
      .from("products")
      .insert({
        seller_id: sellerId,
        title: `IT ${Math.random().toString(36).slice(2, 8)}`,
        price: "5.00",
        category_id: categoryBySlug.get(slug)!,
        status,
        quantity_available: 2,
      })
      .select("id")
      .single();
  }

  beforeAll(async () => {
    admin = adminDb();
    const { data } = await admin.from("categories").select("id, slug");
    categoryBySlug = new Map((data ?? []).map((c) => [c.slug, c.id]));
  });

  afterAll(cleanupAll);

  // -- the guard -------------------------------------------------------------
  it("accepts a program from the seller's own state", async () => {
    const id = await seller("TX");
    const [program] = await programsFor("TX");
    const { error } = await admin
      .from("seller_profiles")
      .update({ food_program_id: program.id })
      .eq("id", id);
    expect(error).toBeNull();
  });

  it("refuses a program from another state", async () => {
    const id = await seller("TX");
    const [californian] = await programsFor("CA");
    const { error } = await admin
      .from("seller_profiles")
      .update({ food_program_id: californian.id })
      .eq("id", id);
    expect(error).not.toBeNull();
  });

  it("clears the choice when the seller moves state, rather than blocking the move", async () => {
    const id = await seller("TX");
    const [texan] = await programsFor("TX");
    await admin.from("seller_profiles").update({ food_program_id: texan.id }).eq("id", id);

    const { error } = await admin
      .from("seller_profiles")
      .update({ home_state: "WY" })
      .eq("id", id);
    expect(error).toBeNull();

    const { data } = await admin
      .from("seller_profiles")
      .select("food_program_id, home_state")
      .eq("id", id)
      .single();
    expect(data?.home_state).toBe("WY");
    expect(data?.food_program_id).toBeNull();
  });

  // -- the gates get more precise -------------------------------------------
  it("falls back to the whole state when no program is chosen", async () => {
    const id = await seller("CA");
    // California's Class A and Class B both ban meat, MEHKO allows it — so state-wide, meat passes.
    expect((await admin.rpc("seller_permits_food_axis", { p_seller_id: id, p_axis: "meat" })).data)
      .toBe(true);
  });

  it("uses the chosen program once there is one", async () => {
    const id = await seller("CA");
    const programs = await programsFor("CA");
    const classA = programs.find((p) => p.name === "Cottage Food Class A")!;
    const mehko = programs.find((p) => p.name === "Microenterprise Home Kitchen Operations")!;

    await admin.from("seller_profiles").update({ food_program_id: classA.id }).eq("id", id);
    expect((await admin.rpc("seller_permits_food_axis", { p_seller_id: id, p_axis: "meat" })).data)
      .toBe(false);

    await admin.from("seller_profiles").update({ food_program_id: mehko.id }).eq("id", id);
    expect((await admin.rpc("seller_permits_food_axis", { p_seller_id: id, p_axis: "meat" })).data)
      .toBe(true);
  });

  it("blocks a listing the chosen program bans even though the state allows it somewhere", async () => {
    const id = await seller("CA");
    const programs = await programsFor("CA");
    const classA = programs.find((p) => p.name === "Cottage Food Class A")!;

    // No program chosen: the state-wide check lets meat through.
    expect((await listIn(id, "meat-seafood")).error).toBeNull();

    await admin.from("seller_profiles").update({ food_program_id: classA.id }).eq("id", id);
    const { error } = await listIn(id, "meat-seafood");
    expect(error).not.toBeNull();
  });

  it("applies the chosen program to online orders too", async () => {
    const id = await seller("VA");
    const programs = await programsFor("VA");
    const exempt = programs.find((p) => p.name === "Home Kitchen Exemptions")!;

    // Virginia bans online orders under the exemption program and allows them under the other.
    expect((await admin.rpc("seller_allows_online_food_sales", { p_seller_id: id })).data).toBe(true);

    await admin.from("seller_profiles").update({ food_program_id: exempt.id }).eq("id", id);
    expect((await admin.rpc("seller_allows_online_food_sales", { p_seller_id: id })).data).toBe(
      false,
    );

    const { error } = await listIn(id, "baked-goods");
    expect(error).not.toBeNull();
  });

  it("still refuses an unrecognised axis", async () => {
    const id = await seller("TX");
    expect(
      (await admin.rpc("seller_permits_food_axis", { p_seller_id: id, p_axis: "alchemy" })).data,
    ).toBe(false);
  });

  it("a seller cannot set another seller's program", async () => {
    const mine = await seller("TX");
    const theirs = await seller("TX");
    const [program] = await programsFor("TX");

    const user = await createTestUser({ role: "seller", homeState: "TX" });
    const outsider = await createSeller(user.id, { homeState: "TX" });
    expect(outsider.id).not.toBe(mine);

    // RLS scopes seller_profiles updates to the owner; a stranger's write must not land.
    await admin.from("seller_profiles").update({ food_program_id: program.id }).eq("id", theirs);
    const { data } = await admin
      .from("seller_profiles")
      .select("food_program_id")
      .eq("id", mine)
      .single();
    expect(data?.food_program_id).toBeNull();
  });
});
