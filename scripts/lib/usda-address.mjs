/**
 * Pulling a city, state and ZIP out of the USDA directory's one free-text address field.
 *
 * This exists because the portal's API changed shape. It used to serve a CSV with `location_city`,
 * `location_state` and `location_zipcode` as their own columns — `scripts/lib/usda-format.mjs` still
 * names them — and it now serves JSON whose only location field is `location_address`, a single
 * string. `markets.state` is not optional: it is the URL segment and the discovery half of
 * CLAUDE.md rule 1, so without it a listing cannot be imported at all.
 *
 * Parsing an address is exactly the sort of guessing this codebase avoids, so the rule here is
 * **recognise or refuse**. Every shape below was read off the real data; anything that does not
 * match returns a null state and the importer skips the row rather than filing it under a state it
 * inferred. A market in the wrong state would advertise a seller to buyers who cannot lawfully
 * order from them.
 *
 * The four shapes the directory actually uses:
 *
 *     7350 Pine Creek Road, Colorado Springs, Colorado 80919     name + ZIP
 *     101 Main Street, Martin, TN, USA                           code + country
 *     511 Woodland Street, Nashville, Tennessee TN               name + code
 *     625 52nd Street, Kenosha, WI 53140                         code + ZIP
 *
 * Puerto Rico and the Virgin Islands appear in the data and are deliberately NOT mapped: the
 * compliance tables cover 51 jurisdictions (the states and DC) and a market in a place we hold no
 * cottage-food rules for has nothing to say to a seller.
 */

const NAME_TO_CODE = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN",
  iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY",
};

const CODES = new Set(Object.values(NAME_TO_CODE));

// Longest first, so "West Virginia" is tried before "Virginia" and "New York" before "York".
const NAMES_LONGEST_FIRST = Object.keys(NAME_TO_CODE).sort((a, b) => b.length - a.length);

/**
 * @param {string | null | undefined} raw
 * @returns {{ street: string|null, city: string|null, state: string|null, zip: string|null }|null}
 */
export function parseUsdaAddress(raw) {
  let text = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;

  // Country and ZIP, in either order and sometimes both — "Gainesville, FL, USA 32601" is real.
  // Stripped in a loop until nothing more comes off, rather than assuming which trails which.
  let zip = null;
  for (;;) {
    const before = text;
    // "USA", "U.S.A.", "U.S.", and a bare "US" — all four appear in the data.
    text = text.replace(/,?\s*(U\.?S\.?A\.?|U\.?S\.?|United States)\s*$/i, "").trim();
    const zipMatch = text.match(/\b(\d{5})(?:-\d{4})?\s*$/);
    if (zipMatch) {
      zip ??= zipMatch[1];
      text = text.slice(0, zipMatch.index).trim();
    }
    text = text.replace(/,\s*$/, "").trim();
    if (text === before) break;
  }

  // The tail now ends in one of: "XX" | "StateName" | "StateName XX".
  let state = null;

  const codeMatch = text.match(/(?:^|[,\s])([A-Za-z]{2})$/);
  if (codeMatch && CODES.has(codeMatch[1].toUpperCase())) {
    state = codeMatch[1].toUpperCase();
    text = text.slice(0, codeMatch.index).trim().replace(/,\s*$/, "");
  }

  // A trailing state NAME, which is either the state itself or — where a code was already found —
  // the name spelled out in front of it.
  //
  // A code, once matched, WINS. Several cities are also state names: "Washington, DC" and
  // "Virginia, MN" both end in a state name that is not the state, and an earlier version treated
  // the disagreement as a parse failure and dropped every listing in Washington DC.
  const lower = text.toLowerCase();
  const name = NAMES_LONGEST_FIRST.find(
    (n) => lower === n || lower.endsWith(`,${n}`) || lower.endsWith(` ${n}`) || lower.endsWith(`, ${n}`),
  );
  if (name) {
    const fromName = NAME_TO_CODE[name];
    if (!state) {
      state = fromName;
      text = text.slice(0, lower.lastIndexOf(name)).trim().replace(/,\s*$/, "");
    } else if (state === fromName) {
      // "Nashville, Tennessee TN" — spelled twice, so take it off and leave the city behind.
      text = text.slice(0, lower.lastIndexOf(name)).trim().replace(/,\s*$/, "");
    }
    // Otherwise it is a city that shares a state's name; the code stands and the city stays.
  }

  if (!state) {
    // Last resort: some listings bolt directions onto the end — "…Phoenix, AZ 85018 Take highway
    // 51 to Indian School Road…" — so the address is in the middle of the string rather than at
    // the end of it. A two-letter state code immediately followed by a five-digit ZIP is a strong
    // enough signal to cut on; the LAST one wins, since prose after it may mention other places.
    const scan = [...text.matchAll(/\b([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?\b/g)].filter((m) =>
      CODES.has(m[1].toUpperCase()),
    );
    const hit = scan[scan.length - 1];
    if (!hit) return { street: null, city: null, state: null, zip };

    state = hit[1].toUpperCase();
    zip ??= hit[2];
    text = text.slice(0, hit.index).trim().replace(/,\s*$/, "");
  }

  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  const city = parts.length > 1 ? parts[parts.length - 1] : null;
  const street = parts.length > 1 ? parts.slice(0, -1).join(", ") : (parts[0] ?? null);

  return { street: street || null, city, state, zip };
}
