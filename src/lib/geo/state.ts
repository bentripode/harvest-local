/**
 * US state helpers. `home_state` on `profiles` / `seller_profiles` is a two-letter code and the
 * anchor for the whole geofence: a buyer in state X may only transact with a seller in state X
 * (ARCHITECTURE.md §4). In Phase 2 the buyer's state is self-attested via a picker; the
 * `orders_same_state_only` CHECK + the checkout server guard + the discovery filter are the three
 * enforcement layers.
 */

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
  "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY", "DC",
] as const;

export type UsState = (typeof US_STATES)[number];

const STATE_NAMES: Record<UsState, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

export function isUsState(value: unknown): value is UsState {
  return typeof value === "string" && (US_STATES as readonly string[]).includes(value);
}

export function stateName(code: string | null | undefined): string {
  return code && isUsState(code) ? STATE_NAMES[code] : (code ?? "");
}

/** The geofence predicate. Null/blank on either side is never a match. */
export function sameState(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a === b;
}
