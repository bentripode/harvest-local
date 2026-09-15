import { describe, expect, it } from "vitest";

import {
  emptyCategorySentence,
  resolveCategory,
  shopHref,
  topLevelCategories,
} from "@/lib/products/category-filter";

const cat = (slug: string, sort_order: number, parent_id: string | null = null) => ({
  id: `id-${slug}`,
  name: slug.replace(/-/g, " "),
  slug,
  parent_id,
  sort_order,
});

const all = [
  cat("baked-goods", 20),
  cat("produce", 10),
  cat("baked-goods-bread", 10, "id-baked-goods"),
  cat("crafts-artisan-goods", 80),
];

describe("topLevelCategories", () => {
  it("drops subcategories and orders by sort_order", () => {
    expect(topLevelCategories(all).map((c) => c.slug)).toEqual([
      "produce",
      "baked-goods",
      "crafts-artisan-goods",
    ]);
  });
});

describe("resolveCategory", () => {
  const top = topLevelCategories(all);

  it("finds a top-level category by slug", () => {
    expect(resolveCategory("produce", top)?.id).toBe("id-produce");
  });

  it("will not resolve a subcategory, which the product column never holds", () => {
    expect(resolveCategory("baked-goods-bread", top)).toBeNull();
  });

  it("treats unknown, empty, missing and repeated values as no filter", () => {
    expect(resolveCategory("nope", top)).toBeNull();
    expect(resolveCategory("", top)).toBeNull();
    expect(resolveCategory(undefined, top)).toBeNull();
    expect(resolveCategory(["produce", "baked-goods"], top)).toBeNull();
  });
});

describe("shopHref", () => {
  it("omits defaults", () => {
    expect(shopHref({ view: "list", category: null })).toBe("/shop");
  });

  it("keeps the category when switching view, and the view when choosing a category", () => {
    expect(shopHref({ view: "map", category: "produce" })).toBe("/shop?view=map&category=produce");
    expect(shopHref({ view: "list", category: "produce" })).toBe("/shop?category=produce");
    expect(shopHref({ view: "map", category: null })).toBe("/shop?view=map");
  });
});

describe("emptyCategorySentence", () => {
  it("does not claim the state is empty — only this category is", () => {
    expect(emptyCategorySentence("Baked Goods", "Texas")).toBe(
      "Nobody in Texas is listing baked goods right now.",
    );
  });
});
