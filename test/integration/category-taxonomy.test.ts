import { afterAll, beforeAll, expect, it } from "vitest";

import {
  adminDb,
  cleanupAll,
  createSeller,
  createTestUser,
  describeDb,
  type TestUser,
} from "./helpers";

/**
 * Invariants of the shopping taxonomy.
 *
 * `categories.requires_food_permit` is the single flag behind FIVE gates — the licence gate
 * (rule 5), the programme requirement, the label guard, the allergen guard and the online-sales ban.
 * One wrong row therefore blocks lawful trade or permits unlawful trade across all of them at once,
 * and it was seeded by hand with a comment admitting it was "not a legal determination".
 *
 * These assertions exist because the alternative is reading a tree by eye. `20260909150000` renamed
 * a category by matching the wrong slug, the UPDATE hit no rows, and it reported success — a silent
 * no-op is the failure mode this file is here to catch.
 */

interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  requires_food_permit: boolean;
  food_axes: string[] | null;
}

async function categories(): Promise<Category[]> {
  const { data, error } = await adminDb()
    .from("categories")
    .select("id, name, slug, parent_id, requires_food_permit, food_axes");
  if (error) throw new Error(`categories: ${error.message}`);
  return (data ?? []) as Category[];
}

describeDb("category taxonomy", () => {
  it("does not require a cottage food permit for raw produce", async () => {
    // The correction in 20260909150000. Cottage food law governs food PREPARED in a home kitchen;
    // a tomato sold by the person who grew it is an agricultural product. With this true, a grower
    // needed a permit to open at all, an ingredients list and a net weight for a tomato, and could
    // not list in Washington whatsoever.
    const all = await categories();
    const produce = all.find((c) => c.slug === "produce");
    expect(produce, "produce category missing").toBeTruthy();

    const branch = all.filter((c) => c.id === produce!.id || c.parent_id === produce!.id);
    expect(branch.length).toBeGreaterThan(1);
    for (const c of branch) {
      expect(c.requires_food_permit, `${c.name} should not need a cottage food permit`).toBe(false);
    }
  });

  it("keeps the fresh/dried boundary in the NAME, where a seller will see it", async () => {
    // A bunch of cut basil is produce; a jar of dried oregano is a shelf-stable cottage food product
    // that needs a permit, a programme, a label and an allergen declaration. "Herbs" alone invites
    // the second to be filed as the first and escape all four.
    const all = await categories();
    const herbs = all.find((c) => c.slug === "produce-herbs");
    expect(herbs?.name).toBe("Fresh Herbs");
  });

  it("still requires a permit for everything that IS prepared in a kitchen", async () => {
    // The correction must not have leaked sideways.
    const all = await categories();
    for (const slug of ["baked-goods", "dairy-eggs", "meat-seafood", "pantry-preserves", "beverages"]) {
      const parent = all.find((c) => c.slug === slug);
      expect(parent, `${slug} missing`).toBeTruthy();
      expect(parent!.requires_food_permit, slug).toBe(true);

      for (const child of all.filter((c) => c.parent_id === parent!.id)) {
        expect(child.requires_food_permit, `${child.name} under ${slug}`).toBe(true);
      }
    }
  });

  it("never requires a food permit for something that isn't food", async () => {
    const all = await categories();
    for (const slug of ["flowers-plants", "crafts-artisan-goods"]) {
      const parent = all.find((c) => c.slug === slug);
      if (!parent) continue;
      expect(parent.requires_food_permit, slug).toBe(false);
      for (const child of all.filter((c) => c.parent_id === parent.id)) {
        expect(child.requires_food_permit, child.name).toBe(false);
      }
    }
  });

  it("gives a non-cottage-food category no regulatory axes, which would be meaningless on it", async () => {
    // The six axes grade PROCESSED food. A category outside the cottage food framework carrying one
    // would make `products_guard_food_categories` judge it against rules written for something else.
    const all = await categories();
    for (const c of all.filter((x) => !x.requires_food_permit)) {
      expect(c.food_axes ?? [], `${c.name} has axes but needs no permit`).toHaveLength(0);
    }
  });

  it("namespaces every subcategory slug under its parent's first word", async () => {
    // The convention 20260909150000 tripped over — it matched `slug = 'herbs'` and the row is
    // `produce-herbs`, so the UPDATE hit nothing and reported success.
    //
    // The rule is the parent's FIRST SEGMENT, not its whole slug: `crafts-artisan-goods` parents
    // `crafts-candles`, and `flowers-plants` parents `flowers-cut`. Asserted as it actually is
    // rather than as I first assumed, which was `${parent.slug}-` and is wrong for four branches.
    const all = await categories();
    const byId = new Map(all.map((c) => [c.id, c]));

    for (const child of all.filter((c) => c.parent_id)) {
      const parent = byId.get(child.parent_id!);
      expect(parent, `${child.name} has a dangling parent`).toBeTruthy();

      const stem = parent!.slug.split("-")[0];
      expect(child.slug.startsWith(`${stem}-`), `${child.slug} under ${parent!.slug}`).toBe(true);
      // And never a bare word, which is the shape that makes an UPDATE silently miss.
      expect(child.slug).toContain("-");
    }
  });

  it("has no category orphaned or nested more than one deep", async () => {
    // The UI renders exactly two levels. A grandchild would simply not appear anywhere.
    const all = await categories();
    const byId = new Map(all.map((c) => [c.id, c]));

    for (const c of all.filter((x) => x.parent_id)) {
      const parent = byId.get(c.parent_id!);
      expect(parent?.parent_id, `${c.name} is nested too deep`).toBeNull();
    }
  });

  it("keeps slugs unique, since they are how a category is addressed", async () => {
    const all = await categories();
    const slugs = all.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("uses only the six known regulatory axes", async () => {
    // A typo here silently stops `state_permits_food_axis` matching anything, so the gate passes a
    // listing it should have judged.
    const known = new Set([
      "shelf_stable",
      "refrigerated",
      "acidified",
      "fermented",
      "meat",
      // The exact six `state_permits_food_axis` maps. `dairy` is NOT one of them — an axis it
      // does not recognise makes that function return false, which blocks everything.
      "low_acid_canned",
    ]);
    const all = await categories();
    for (const c of all) {
      for (const axis of c.food_axes ?? []) {
        expect(known.has(axis), `${c.name} carries unknown axis "${axis}"`).toBe(true);
      }
    }
  });
});

/**
 * The subcategory axes were dead data until `20260909170000`: the guard resolved axes from
 * `category_id` only, so `Pickles & Ferments` ({acidified, fermented}) was judged by its parent
 * `Pantry & Preserves` ({shelf_stable}) and published in 13 states that ban acidified or fermented
 * food under every programme they run.
 */
describeDb("rule 7 reads BOTH taxonomy levels", () => {
  let sellerUser: TestUser;
  let seller: { id: string };
  let pantry: { id: string };
  let pickles: { id: string };
  let jam: { id: string };

  beforeAll(async () => {
    // Connecticut bans acidified AND fermented under every programme, allows shelf-stable, and
    // permits online orders — so the axis gate is the only thing that can block here. Washington
    // was the first choice and is unusable: it bans online food sales outright, so the control
    // case never reached the axis check at all.
    sellerUser = await createTestUser({ role: "seller", homeState: "CT" });
    seller = await createSeller(sellerUser.id, { homeState: "CT" });

    const { data } = await adminDb()
      .from("categories")
      .select("id, slug")
      .in("slug", ["pantry-preserves", "pantry-pickles-ferments", "pantry-jam-jelly"]);

    const bySlug = new Map((data ?? []).map((c) => [c.slug, c]));
    pantry = bySlug.get("pantry-preserves")!;
    pickles = bySlug.get("pantry-pickles-ferments")!;
    jam = bySlug.get("pantry-jam-jelly")!;
  });

  afterAll(cleanupAll);

  function publish(subcategoryId: string) {
    return adminDb().from("products").insert({
      seller_id: seller.id,
      title: "IT Axis Probe",
      price: "5.00",
      category_id: pantry.id,
      subcategory_id: subcategoryId,
      status: "active",
      ingredients: ["Cucumber", "Vinegar", "Salt"],
      net_weight_value: "16",
      net_weight_unit: "oz",
      allergens: [],
      allergens_confirmed_at: new Date().toISOString(),
    });
  }

  it("blocks an acidified subcategory in a state that bans it, despite a shelf-stable parent", async () => {
    const { error } = await publish(pickles.id);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/does not permit selling (acidified|fermented)/i);
  });

  it("still allows a shelf-stable sibling under the same parent", async () => {
    // The fix must block the acidified jar and not the jam beside it.
    const { data, error } = await publish(jam.id).select("id").single();
    expect(error).toBeNull();
    if (data) await adminDb().from("products").delete().eq("id", data.id);
  });
});
