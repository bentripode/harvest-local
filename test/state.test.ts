import { describe, expect, it } from "vitest";

import { US_STATES, isUsState, sameState, stateName } from "@/lib/geo/state";

describe("US_STATES", () => {
  it("is the 50 states plus DC", () => {
    expect(US_STATES).toHaveLength(51);
    expect(new Set(US_STATES).size).toBe(51);
    expect(US_STATES).toContain("DC");
  });
});

describe("isUsState", () => {
  it("accepts valid two-letter codes", () => {
    expect(isUsState("TX")).toBe(true);
    expect(isUsState("CA")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isUsState("tx")).toBe(false);
    expect(isUsState("XX")).toBe(false);
    expect(isUsState("")).toBe(false);
    expect(isUsState(null)).toBe(false);
    expect(isUsState(undefined)).toBe(false);
    expect(isUsState(42)).toBe(false);
  });
});

describe("sameState — the geofence predicate (CLAUDE.md rule 1)", () => {
  it("matches only identical non-empty codes", () => {
    expect(sameState("TX", "TX")).toBe(true);
  });

  it("never matches across states", () => {
    expect(sameState("TX", "CA")).toBe(false);
  });

  it("never matches when either side is missing", () => {
    expect(sameState(null, "TX")).toBe(false);
    expect(sameState("TX", null)).toBe(false);
    expect(sameState(null, null)).toBe(false);
    expect(sameState("", "")).toBe(false);
    expect(sameState(undefined, undefined)).toBe(false);
  });

  it("is case-sensitive — codes are always stored uppercase", () => {
    expect(sameState("tx", "TX")).toBe(false);
  });
});

describe("stateName", () => {
  it("maps a code to a full name", () => {
    expect(stateName("TX")).toBe("Texas");
    expect(stateName("DC")).toBe("District of Columbia");
  });

  it("falls back to the input for unknown or missing codes", () => {
    expect(stateName("XX")).toBe("XX");
    expect(stateName(null)).toBe("");
    expect(stateName(undefined)).toBe("");
  });
});
