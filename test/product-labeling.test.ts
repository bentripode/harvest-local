import { describe, expect, it } from "vitest";

import {
  formatAllergens,
  formatNetWeight,
  ingredientsToText,
  parseAllergens,
  parseIngredients,
  MAX_INGREDIENTS,
  missingLabelFields,
  describeMissingLabelFields,
} from "@/lib/products/labeling";

describe("parseIngredients", () => {
  it("keeps the seller's order — it is the label's order", () => {
    expect(parseIngredients("Wheat flour\nWater\nSalt")).toEqual(["Wheat flour", "Water", "Salt"]);
  });

  it("never re-sorts, even when the order looks wrong", () => {
    // Descending order by weight is the seller's call; alphabetising would corrupt the label.
    expect(parseIngredients("Salt\nWheat flour")).toEqual(["Salt", "Wheat flour"]);
  });

  it("accepts a comma-separated list pasted on one line", () => {
    expect(parseIngredients("Wheat flour, water, sea salt")).toEqual([
      "Wheat flour",
      "water",
      "sea salt",
    ]);
  });

  it("prefers newlines when both are present, so commas inside a name survive", () => {
    expect(parseIngredients("Chocolate, dark (70%)\nSugar")).toEqual([
      "Chocolate, dark (70%)",
      "Sugar",
    ]);
  });

  it("drops blanks and collapses whitespace", () => {
    expect(parseIngredients("  Wheat   flour \n\n\n Water ")).toEqual(["Wheat flour", "Water"]);
  });

  it("dedupes case-insensitively, keeping the first spelling", () => {
    expect(parseIngredients("Sugar\nsugar\nSUGAR")).toEqual(["Sugar"]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: MAX_INGREDIENTS + 20 }, (_, i) => `Item ${i}`).join("\n");
    expect(parseIngredients(many)).toHaveLength(MAX_INGREDIENTS);
  });

  it("round-trips through the textarea without reordering", () => {
    const list = ["Wheat flour", "Water", "Sea salt"];
    expect(parseIngredients(ingredientsToText(list))).toEqual(list);
  });
});

describe("allergens", () => {
  it("keeps only the federal nine", () => {
    expect(parseAllergens(["milk", "gluten", "wheat"])).toEqual(["milk", "wheat"]);
  });

  it("returns them in a stable canonical order, not the order ticked", () => {
    expect(parseAllergens(["sesame", "milk"])).toEqual(["milk", "sesame"]);
    expect(parseAllergens(["milk", "sesame"])).toEqual(["milk", "sesame"]);
  });

  it("dedupes", () => {
    expect(parseAllergens(["eggs", "eggs"])).toEqual(["eggs"]);
  });

  it("formats the way a label reads", () => {
    expect(formatAllergens(["wheat", "milk"])).toBe("Milk, Wheat");
    expect(formatAllergens(["shellfish"])).toBe("Crustacean shellfish");
  });

  it("shows nothing when none are present", () => {
    expect(formatAllergens([])).toBeNull();
  });
});

describe("formatNetWeight", () => {
  it("adds the metric equivalent NC, TN and CT require", () => {
    expect(formatNetWeight(24, "oz")).toBe("24 oz (680 g)");
    expect(formatNetWeight(1, "lb")).toBe("1 lb (454 g)");
    expect(formatNetWeight(16, "fl_oz")).toBe("16 fl oz (473 mL)");
  });

  it("leaves metric units alone", () => {
    expect(formatNetWeight(500, "g")).toBe("500 g");
    expect(formatNetWeight(1.5, "kg")).toBe("1.5 kg");
  });

  it("can omit the conversion for a state that doesn't ask", () => {
    expect(formatNetWeight(24, "oz", { metric: false })).toBe("24 oz");
  });

  it("keeps a decimal on small conversions rather than rounding them away", () => {
    expect(formatNetWeight(0.25, "oz")).toBe("0.25 oz (7.1 g)");
  });

  it("accepts the string a numeric column actually returns", () => {
    expect(formatNetWeight("24", "oz")).toBe("24 oz (680 g)");
  });

  it("counts are not converted", () => {
    expect(formatNetWeight(12, "count")).toBe("12 ct");
  });

  it("shows nothing without both a value and a unit", () => {
    expect(formatNetWeight(null, "oz")).toBeNull();
    expect(formatNetWeight(24, null)).toBeNull();
    expect(formatNetWeight("", "")).toBeNull();
  });

  it("rejects nonsense rather than printing it", () => {
    expect(formatNetWeight(0, "oz")).toBeNull();
    expect(formatNetWeight(-5, "oz")).toBeNull();
    expect(formatNetWeight(24, "stones")).toBeNull();
  });
});

describe("missingLabelFields", () => {
  const food = {
    isFoodCategory: true,
    status: "active",
    ingredients: ["Wheat flour", "Water"],
    netWeightValue: "24",
    netWeightUnit: "oz",
  };

  it("passes a complete food listing", () => {
    expect(missingLabelFields(food)).toEqual([]);
  });

  it("names each missing field", () => {
    expect(missingLabelFields({ ...food, ingredients: [] })).toEqual(["ingredients"]);
    expect(missingLabelFields({ ...food, netWeightValue: null })).toEqual(["net weight"]);
    expect(missingLabelFields({ ...food, ingredients: [], netWeightUnit: null })).toEqual([
      "ingredients",
      "net weight",
    ]);
  });

  it("treats a weight with no unit as missing — half a net weight is not one", () => {
    expect(missingLabelFields({ ...food, netWeightUnit: "" })).toEqual(["net weight"]);
  });

  it("lets a draft be saved half-finished, so the seller keeps their work", () => {
    expect(
      missingLabelFields({ ...food, status: "draft", ingredients: [], netWeightValue: null }),
    ).toEqual([]);
  });

  it("exempts an archived listing, which is off the storefront", () => {
    expect(missingLabelFields({ ...food, status: "archived", ingredients: [] })).toEqual([]);
  });

  it("guards sold_out too — it is still a published listing", () => {
    expect(missingLabelFields({ ...food, status: "sold_out", ingredients: [] })).toEqual([
      "ingredients",
    ]);
  });

  it("asks nothing of a non-food listing — a candle has no ingredient panel", () => {
    expect(
      missingLabelFields({
        ...food,
        isFoodCategory: false,
        ingredients: [],
        netWeightValue: null,
      }),
    ).toEqual([]);
  });
});

describe("describeMissingLabelFields", () => {
  it("says nothing when nothing is missing", () => {
    expect(describeMissingLabelFields([])).toBeNull();
  });

  it("reads as a sentence for one field and for two", () => {
    expect(describeMissingLabelFields(["ingredients"])).toContain("needs its ingredients");
    const both = describeMissingLabelFields(["ingredients", "net weight"]);
    expect(both).toContain("ingredients and net weight");
    expect(both).toContain("them");
  });

  it("offers the way out, so the seller is never stuck", () => {
    expect(describeMissingLabelFields(["net weight"])).toContain("draft");
  });
});
