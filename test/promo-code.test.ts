import { describe, expect, it } from "vitest";

import { promoCodeSchema } from "@/lib/referrals/codes";

/**
 * `validatePromoCode` feeds the parsed output straight into an `.eq("code", …)` filter. The schema
 * is the barrier that stops a buyer from probing codes they were never given, so the SQL-wildcard
 * and quoting cases below matter as much as the happy path.
 */
describe("promoCodeSchema", () => {
  it("normalises case and surrounding whitespace", () => {
    expect(promoCodeSchema.parse("  spring24  ")).toBe("SPRING24");
    expect(promoCodeSchema.parse("BreadClub")).toBe("BREADCLUB");
  });

  it("accepts 4–20 alphanumeric characters", () => {
    expect(promoCodeSchema.safeParse("ABCD").success).toBe(true);
    expect(promoCodeSchema.safeParse("A1B2C3D4E5F6G7H8I9J0").success).toBe(true);
  });

  it("rejects SQL LIKE wildcards and quoting", () => {
    for (const bad of ["%", "AB%CD", "ABC_", "A'OR'1", 'AB"CD', "AB;CD", "AB--CD", "AB CD"]) {
      expect(promoCodeSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it("rejects out-of-range lengths", () => {
    expect(promoCodeSchema.safeParse("ABC").success).toBe(false);
    expect(promoCodeSchema.safeParse("A1B2C3D4E5F6G7H8I9J0K").success).toBe(false);
    expect(promoCodeSchema.safeParse("").success).toBe(false);
  });

  it("rejects reserved words", () => {
    for (const reserved of ["HARVEST", "admin", "  free  ", "Refund"]) {
      expect(promoCodeSchema.safeParse(reserved).success, reserved).toBe(false);
    }
  });
});
