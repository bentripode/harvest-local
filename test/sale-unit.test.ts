import { describe, expect, it } from "vitest";

import {
  lowestVariantPrice,
  needsVariantChoice,
  resolveSaleUnit,
  type ProductLike,
  type VariantLike,
} from "@/lib/orders/sale-unit";

/**
 * The single place a price comes from (CLAUDE.md rule 3). A product either has variants or it
 * doesn't, and the whole point of this module is that those two shapes never become two pricing
 * paths — so the cases here are mostly about which unit wins, and about refusing rather than
 * guessing when the answer is ambiguous.
 */

const product = (over: Partial<ProductLike> = {}): ProductLike => ({
  id: "p1",
  title: "Sourdough",
  price: "8.50",
  quantity_available: 10,
  ...over,
});

const variant = (over: Partial<VariantLike> = {}): VariantLike => ({
  id: "v1",
  name: "Half loaf",
  price: "5.00",
  quantity_available: 4,
  is_active: true,
  ...over,
});

describe("resolveSaleUnit — no variants", () => {
  it("sells the product itself, exactly as before variants existed", () => {
    const r = resolveSaleUnit(product(), []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.unit).toMatchObject({
      productId: "p1",
      variantId: null,
      variantName: null,
      displayTitle: "Sourdough",
      unitPrice: 850,
      stock: 10,
    });
  });

  it("carries a null stock through as unlimited", () => {
    const r = resolveSaleUnit(product({ quantity_available: null }), []);
    expect(r.ok && r.unit.stock).toBeNull();
  });

  it("ignores a variant id that was sent for a product with none", () => {
    const r = resolveSaleUnit(product(), [], "v1");
    expect(r.ok).toBe(true);
    expect(r.ok && r.unit.variantId).toBeNull();
  });
});

describe("resolveSaleUnit — with variants", () => {
  const two = [variant({ id: "v1", name: "Half loaf", price: "5.00" }), variant({ id: "v2", name: "Whole loaf", price: "9.00" })];

  it("never falls back to the product's own price", () => {
    const r = resolveSaleUnit(product({ price: "8.50" }), two, "v2");
    expect(r.ok && r.unit.unitPrice).toBe(900);
  });

  it("names the chosen option on the line", () => {
    const r = resolveSaleUnit(product(), two, "v1");
    expect(r.ok && r.unit.displayTitle).toBe("Sourdough — Half loaf");
    expect(r.ok && r.unit.variantName).toBe("Half loaf");
  });

  it("takes the stock from the variant, not the product", () => {
    const r = resolveSaleUnit(product({ quantity_available: 100 }), [variant({ quantity_available: 2 })], "v1");
    expect(r.ok && r.unit.stock).toBe(2);
  });

  it("refuses when more than one option exists and none was chosen", () => {
    const r = resolveSaleUnit(product(), two);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe("variant_required");
  });

  it("resolves without a choice when there is only one — a variant used just to carry a weight", () => {
    const r = resolveSaleUnit(product(), [variant()]);
    expect(r.ok && r.unit.variantId).toBe("v1");
  });

  it("refuses an unknown id rather than silently picking another", () => {
    const r = resolveSaleUnit(product(), two, "does-not-exist");
    expect(!r.ok && r.error).toBe("variant_not_found");
  });

  it("refuses an inactive id, and does not count it towards the choice", () => {
    const mixed = [variant({ id: "v1", is_active: false }), variant({ id: "v2", name: "Whole", is_active: true })];
    expect(resolveSaleUnit(product(), mixed, "v1")).toMatchObject({ ok: false, error: "variant_not_found" });
    // Only one is buyable, so no choice is needed.
    const r = resolveSaleUnit(product(), mixed);
    expect(r.ok && r.unit.variantId).toBe("v2");
  });

  it("refuses when every option is switched off, rather than selling the product price", () => {
    const r = resolveSaleUnit(product(), [variant({ is_active: false })]);
    expect(!r.ok && r.error).toBe("no_variants_available");
  });
});

describe("lowestVariantPrice", () => {
  it("gives the cheapest buyable option, for a 'from $X' on a card", () => {
    expect(
      lowestVariantPrice([variant({ price: "9.00" }), variant({ id: "v2", price: "5.00" })]),
    ).toBe(500);
  });

  it("ignores options that aren't for sale", () => {
    expect(
      lowestVariantPrice([
        variant({ price: "1.00", is_active: false }),
        variant({ id: "v2", price: "7.00" }),
      ]),
    ).toBe(700);
  });

  it("is null with nothing buyable", () => {
    expect(lowestVariantPrice([])).toBeNull();
    expect(lowestVariantPrice([variant({ is_active: false })])).toBeNull();
  });
});

describe("needsVariantChoice", () => {
  it("is true only when there is a real choice to make", () => {
    expect(needsVariantChoice([])).toBe(false);
    expect(needsVariantChoice([variant()])).toBe(false);
    expect(needsVariantChoice([variant(), variant({ id: "v2", name: "Whole" })])).toBe(true);
    expect(needsVariantChoice([variant(), variant({ id: "v2", is_active: false })])).toBe(false);
  });
});
