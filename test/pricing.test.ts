import { describe, expect, it } from "vitest";

import { CartError, MAX_LINE_QUANTITY, priceCart, type PricableProduct } from "@/lib/orders/pricing";
import type { DropLike } from "@/lib/orders/drops";

const SELLER = "seller-1";

function product(overrides: Partial<PricableProduct> = {}): PricableProduct {
  return {
    id: "p1",
    title: "Sourdough loaf",
    price: "8.50",
    status: "active",
    seller_id: SELLER,
    quantity_available: 10,
    tax_code: null,
    category_tax_code: "txcd_20030000",
    category_name: "Baked goods",
    variants: [],
    drops: [],
    ...overrides,
  };
}

describe("priceCart — server-side re-pricing (CLAUDE.md rule 3)", () => {
  it("computes line and subtotal totals from the product rows, in cents", () => {
    const cart = priceCart(
      [
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
      ],
      [
        product({ id: "p1", price: "8.50" }),
        product({ id: "p2", price: "3.99", title: "Jam" }),
      ],
      SELLER,
    );

    expect(cart.lines[0]).toMatchObject({ unitPrice: 850, quantity: 2, lineTotal: 1700 });
    expect(cart.lines[1]).toMatchObject({ unitPrice: 399, quantity: 1, lineTotal: 399 });
    expect(cart.subtotal).toBe(2099);
  });

  it("does not trust any client-supplied price — only productId and quantity are read", () => {
    const cart = priceCart(
      [{ productId: "p1", quantity: 3, price: 1, lineTotal: 1 } as never],
      [product({ price: "2.00" })],
      SELLER,
    );
    expect(cart.subtotal).toBe(600);
  });

  it("snapshots the tax code and category, preferring the product's own tax code", () => {
    const [withOwn, withCategory] = priceCart(
      [
        { productId: "a", quantity: 1 },
        { productId: "b", quantity: 1 },
      ],
      [
        product({ id: "a", tax_code: "txcd_override" }),
        product({ id: "b", tax_code: null }),
      ],
      SELLER,
    ).lines;
    expect(withOwn.taxCode).toBe("txcd_override");
    expect(withCategory.taxCode).toBe("txcd_20030000");
  });

  it("rejects an empty basket", () => {
    expect(() => priceCart([], [], SELLER)).toThrow(CartError);
  });

  it("rejects a product from a different seller — one order, one seller", () => {
    try {
      priceCart([{ productId: "p1", quantity: 1 }], [product({ seller_id: "other" })], SELLER);
      expect.unreachable();
    } catch (e) {
      expect((e as CartError).code).toBe("wrong_seller");
    }
  });

  it("rejects an unknown or inactive product", () => {
    expect(() => priceCart([{ productId: "ghost", quantity: 1 }], [product()], SELLER)).toThrow(
      /no longer available/,
    );
    expect(() =>
      priceCart([{ productId: "p1", quantity: 1 }], [product({ status: "draft" })], SELLER),
    ).toThrow(/no longer for sale/);
  });

  it("rejects quantities outside 1..MAX_LINE_QUANTITY", () => {
    for (const q of [0, -1, MAX_LINE_QUANTITY + 1]) {
      expect(() =>
        priceCart([{ productId: "p1", quantity: q }], [product()], SELLER),
      ).toThrow(/quantity/);
    }
  });

  it("rejects ordering more than is in stock, but allows unlimited stock (null)", () => {
    expect(() =>
      priceCart([{ productId: "p1", quantity: 5 }], [product({ quantity_available: 4 })], SELLER),
    ).toThrow(/left/);
    expect(
      priceCart(
        [{ productId: "p1", quantity: MAX_LINE_QUANTITY }],
        [product({ quantity_available: null })],
        SELLER,
      ).subtotal,
    ).toBeGreaterThan(0);
  });

  it("keeps exact cents on prices that would drift in floating point", () => {
    const cart = priceCart(
      [{ productId: "p1", quantity: 3 }],
      [product({ price: "0.10" })],
      SELLER,
    );
    expect(cart.subtotal).toBe(30);
  });
});

/**
 * Pre-order batches. The binding refusal is `claim_drop_units` under its row lock — this is the
 * layer above it, and its job is to make sure a cart never gets far enough to need that refusal.
 */
describe("priceCart — batches", () => {
  const NOW = new Date("2026-12-10T12:00:00Z");

  const batch = (over: Partial<DropLike> = {}): DropLike => ({
    id: "d1",
    name: "Saturday bake",
    opensAt: "2026-12-08T00:00:00Z",
    closesAt: "2026-12-11T23:59:00Z",
    fulfillmentDate: "2026-12-13",
    pickupWindow: "9am–noon",
    unitCap: 20,
    unitsClaimed: 18,
    cancelledAt: null,
    ...over,
  });

  it("prices a line against an open batch and freezes the collection date onto it", () => {
    const cart = priceCart(
      [{ productId: "p1", quantity: 2 }],
      [product({ drops: [batch()] })],
      SELLER,
      NOW,
    );
    expect(cart.lines[0].dropId).toBe("d1");
    expect(cart.lines[0].dropSnapshot).toBe(
      "Saturday bake — collect Sunday 13 December, 9am–noon",
    );
  });

  it("refuses more than the batch has left, even with shelf stock to spare", () => {
    // quantity_available is 10 and the batch has 2. The batch is a real oven.
    expect(() =>
      priceCart([{ productId: "p1", quantity: 3 }], [product({ drops: [batch()] })], SELLER, NOW),
    ).toThrow(/Only 2 left in "Saturday bake"/);
  });

  it("refuses once the window has closed rather than falling back to ordinary selling", () => {
    const closed = batch({ closesAt: "2026-12-09T00:00:00Z", unitsClaimed: 4 });
    expect(() =>
      priceCart([{ productId: "p1", quantity: 1 }], [product({ drops: [closed] })], SELLER, NOW),
    ).toThrow(/isn't taking orders right now/);
  });

  it("refuses before the window opens", () => {
    const soon = batch({ opensAt: "2026-12-12T00:00:00Z", closesAt: "2026-12-14T00:00:00Z" });
    expect(() =>
      priceCart([{ productId: "p1", quantity: 1 }], [product({ drops: [soon] })], SELLER, NOW),
    ).toThrow(/Orders open in/);
  });

  it("refuses a sold-out batch and says so", () => {
    expect(() =>
      priceCart(
        [{ productId: "p1", quantity: 1 }],
        [product({ drops: [batch({ unitsClaimed: 20 })] })],
        SELLER,
        NOW,
      ),
    ).toThrow(/Sold out/);
  });

  it("leaves a listing with a cancelled batch selling the ordinary way", () => {
    const cart = priceCart(
      [{ productId: "p1", quantity: 2 }],
      [product({ drops: [batch({ cancelledAt: "2026-12-09T00:00:00Z" })] })],
      SELLER,
      NOW,
    );
    expect(cart.lines[0].dropId).toBeNull();
    expect(cart.subtotal).toBe(1700);
  });

  it("carries no batch on an ordinary listing", () => {
    const cart = priceCart([{ productId: "p1", quantity: 1 }], [product()], SELLER, NOW);
    expect(cart.lines[0].dropId).toBeNull();
    expect(cart.lines[0].dropSnapshot).toBeNull();
  });
});
