import { describe, expect, it } from "vitest";

import { describeCard, listingStock, type CardProduct } from "@/lib/products/card";
import type { VariantLike } from "@/lib/orders/sale-unit";
import type { DropLike } from "@/lib/orders/drops";

/**
 * A card is an advertisement, and the way it goes wrong is by quoting a number the listing itself
 * will then contradict. Most of these are about that: the price a buyer is shown before they click
 * has to be a price they can actually pay.
 */

const NOW = new Date("2026-12-10T12:00:00Z");

const product = (over: Partial<CardProduct> = {}): CardProduct => ({
  id: "p1",
  title: "Sourdough loaf",
  price: "8.50",
  quantityAvailable: 10,
  netWeightValue: "24",
  netWeightUnit: "oz",
  allergens: ["wheat"],
  variants: [],
  drops: [],
  ...over,
});

const variant = (over: Partial<VariantLike> = {}): VariantLike => ({
  id: "v1",
  name: "Half loaf",
  price: "6.00",
  quantity_available: 4,
  is_active: true,
  ...over,
});

const batch = (over: Partial<DropLike> = {}): DropLike => ({
  id: "d1",
  name: "Saturday bake",
  opensAt: "2026-12-08T00:00:00Z",
  closesAt: "2026-12-11T23:59:00Z",
  fulfillmentDate: "2026-12-13",
  pickupWindow: "9am–noon",
  unitCap: 20,
  unitsClaimed: 14,
  cancelledAt: null,
  ...over,
});

describe("describeCard — price", () => {
  it("uses the listing price when there are no options", () => {
    expect(describeCard(product(), NOW).priceLabel).toBe("$8.50");
  });

  it("NEVER quotes products.price for a listing that sells through options", () => {
    // The bug this module exists for: /shop was showing $8.50 for a listing whose options are
    // $6.00 and $11.00, because `products.price` is still populated and nobody maintains it once
    // options exist. `resolveSaleUnit` refuses to fall back to it; so does the card.
    const facts = describeCard(
      product({
        price: "8.50",
        variants: [variant({ price: "6.00" }), variant({ id: "v2", price: "11.00" })],
      }),
      NOW,
    );
    expect(facts.priceLabel).toBe("from $6.00");
    expect(facts.priceLabel).not.toContain("8.50");
  });

  it("quotes an exact price when every option costs the same", () => {
    // "from" implies a choice that changes what you pay. Here it doesn't.
    const facts = describeCard(
      product({ variants: [variant({ price: "6.00" }), variant({ id: "v2", price: "6.00" })] }),
      NOW,
    );
    expect(facts.priceLabel).toBe("$6.00");
  });

  it("quotes an exact price for a single option, because there is nothing to choose", () => {
    const facts = describeCard(product({ variants: [variant({ price: "6.00" })] }), NOW);
    expect(facts.priceLabel).toBe("$6.00");
    expect(facts.hasOptions).toBe(false);
  });

  it("ignores an option buyers cannot pick when working out the cheapest", () => {
    const facts = describeCard(
      product({
        variants: [
          variant({ price: "2.00", is_active: false }),
          variant({ id: "v2", price: "6.00" }),
          variant({ id: "v3", price: "11.00" }),
        ],
      }),
      NOW,
    );
    expect(facts.priceLabel).toBe("from $6.00");
  });

  it("says so rather than inventing a price when no option is buyable", () => {
    const facts = describeCard(
      product({ variants: [variant({ is_active: false })] }),
      NOW,
    );
    expect(facts.priceLabel).toBe("Unavailable");
    expect(facts.fromCents).toBeNull();
    expect(facts.orderable).toBe(false);
  });
});

describe("listingStock", () => {
  it("is the listing's own count without options", () => {
    expect(listingStock(product({ quantityAvailable: 3 }))).toBe(3);
    expect(listingStock(product({ quantityAvailable: null }))).toBeNull();
  });

  it("totals the buyable options, because the buyer hasn't chosen one yet", () => {
    expect(
      listingStock(
        product({
          variants: [
            variant({ quantity_available: 4 }),
            variant({ id: "v2", quantity_available: 3 }),
          ],
        }),
      ),
    ).toBe(7);
  });

  it("is unlimited when any buyable option is", () => {
    expect(
      listingStock(
        product({
          variants: [
            variant({ quantity_available: 4 }),
            variant({ id: "v2", quantity_available: null }),
          ],
        }),
      ),
    ).toBeNull();
  });

  it("does not count an option nobody can pick", () => {
    expect(
      listingStock(
        product({
          variants: [
            variant({ quantity_available: 4, is_active: false }),
            variant({ id: "v2", quantity_available: 3 }),
          ],
        }),
      ),
    ).toBe(3);
  });

  it("is zero when every option is switched off", () => {
    expect(listingStock(product({ variants: [variant({ is_active: false })] }))).toBe(0);
  });
});

describe("describeCard — availability", () => {
  it("counts down an ordinary listing", () => {
    expect(describeCard(product({ quantityAvailable: 3 }), NOW).availability).toBe("3 available");
  });

  it("says nothing about stock when there is no limit", () => {
    expect(describeCard(product({ quantityAvailable: null }), NOW).availability).toBeNull();
  });

  it("says sold out and refuses to be orderable at zero", () => {
    const facts = describeCard(product({ quantityAvailable: 0 }), NOW);
    expect(facts.availability).toBe("Sold out");
    expect(facts.orderable).toBe(false);
  });

  it("leads with the batch where the listing sells by batch", () => {
    const facts = describeCard(product({ drops: [batch()] }), NOW);
    expect(facts.availabilityIsBatch).toBe(true);
    expect(facts.availability).toBe("6 of 20 left — collect Sunday 13 December. Orders close in 1 day.");
    expect(facts.orderable).toBe(true);
  });

  it("is not orderable between batches, whatever the shelf says", () => {
    // quantity_available is 10. The batch closed on the 9th. Offering a basket button here is the
    // oversell the drops feature exists to prevent.
    const closed = batch({ closesAt: "2026-12-09T00:00:00Z" });
    const facts = describeCard(product({ quantityAvailable: 10, drops: [closed] }), NOW);
    expect(facts.orderable).toBe(false);
    expect(facts.availability).toMatch(/Orders closed/);
  });

  it("reports a sold-out batch as sold out even with shelf stock left", () => {
    const facts = describeCard(
      product({ quantityAvailable: 10, drops: [batch({ unitsClaimed: 20 })] }),
      NOW,
    );
    expect(facts.orderable).toBe(false);
    expect(facts.availability).toMatch(/^Sold out/);
  });
});

describe("describeCard — the buyer-safety facts", () => {
  it("carries net weight and allergens onto the card", () => {
    const facts = describeCard(product(), NOW);
    expect(facts.netWeight).toBe("24 oz");
    expect(facts.allergens).toBe("Wheat");
  });

  it("is null rather than empty where the seller hasn't said", () => {
    const facts = describeCard(
      product({ netWeightValue: null, netWeightUnit: null, allergens: [] }),
      NOW,
    );
    expect(facts.netWeight).toBeNull();
    expect(facts.allergens).toBeNull();
  });
});
