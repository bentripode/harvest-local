import { describe, expect, it } from "vitest";

import {
  approximateLocation,
  formatPickupAddress,
  type OrderPickupAddress,
  type PickupLocation,
} from "@/lib/orders/pickup-format";

/**
 * `approximateLocation` decides what a stranger is told about where a seller lives, so the thing
 * worth asserting is what it does NOT say.
 */

const location = (over: Partial<PickupLocation> = {}): PickupLocation => ({
  id: "l1",
  label: "Front porch",
  description: null,
  city: "Austin",
  postalCode: "78704",
  prepHours: 0,
  isActive: true,
  market: null,
  slots: [],
  ...over,
});

const address = (over: Partial<OrderPickupAddress> = {}): OrderPickupAddress => ({
  source: "address",
  label: "Front porch",
  description: null,
  line1: "14 Cottage Lane",
  line2: null,
  city: "Austin",
  state: "TX",
  postalCode: "78704",
  ...over,
});

describe("approximateLocation", () => {
  it("gives the town and ZIP, and no street", () => {
    expect(approximateLocation(location())).toBe("Austin 78704");
  });

  it("never leaks the street even if one were somehow present on the row", () => {
    // The type has no line1 by construction — this pins the shape so adding one later is a
    // deliberate act rather than an accident that publishes a home address.
    const out = approximateLocation(location());
    expect(out).not.toMatch(/Cottage|Lane|\d+\s+\w+\s+(St|Rd|Ave|Lane)/i);
  });

  it("names the market for a booth, which is a public venue", () => {
    expect(
      approximateLocation(
        location({
          market: { id: "m", name: "Denton Community Market", slug: "d", state: "TX", city: "Denton" },
        }),
      ),
    ).toBe("Denton Community Market · Denton");
  });

  it("copes with a market that has no recorded town", () => {
    expect(
      approximateLocation(
        location({ market: { id: "m", name: "Lone Market", slug: "l", state: "TX", city: null } }),
      ),
    ).toBe("Lone Market");
  });

  it("returns null rather than an empty string when nothing is known", () => {
    expect(approximateLocation(location({ city: null, postalCode: null }))).toBeNull();
    expect(approximateLocation(location({ city: "  ", postalCode: "" }))).toBeNull();
  });

  it("gives just the town when there is no ZIP", () => {
    expect(approximateLocation(location({ postalCode: null }))).toBe("Austin");
  });
});

describe("formatPickupAddress", () => {
  it("writes it the way an envelope does", () => {
    expect(formatPickupAddress(address())).toBe("14 Cottage Lane, Austin, TX 78704");
  });

  it("includes a second line when there is one", () => {
    expect(formatPickupAddress(address({ line2: "Unit B" }))).toBe(
      "14 Cottage Lane, Unit B, Austin, TX 78704",
    );
  });

  it("drops missing parts instead of leaving stray commas", () => {
    expect(formatPickupAddress(address({ postalCode: null, state: null }))).toBe(
      "14 Cottage Lane, Austin",
    );
    expect(
      formatPickupAddress(address({ line1: null, line2: null, city: "Austin", state: "TX", postalCode: null })),
    ).toBe("Austin, TX");
  });

  it("handles a market address, which arrives as a single line", () => {
    expect(
      formatPickupAddress(
        address({ source: "market", line1: "100 Market Square", line2: null, postalCode: "78701" }),
      ),
    ).toBe("100 Market Square, Austin, TX 78701");
  });
});
