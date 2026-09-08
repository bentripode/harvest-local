/**
 * Pure parsing helpers for the USDA farmers-market import.
 *
 * Split out from `scripts/import-markets.mjs` so they can be tested: a delimiter reader that
 * quietly loses a row, or a slug rule that collides, corrupts thousands of records at once and
 * would not be obvious from the summary line the importer prints.
 */

/**
 * RFC4180 reader with a configurable delimiter. The directory's export is pipe-separated but still
 * quotes fields containing the separator, so splitting on the delimiter drops rows.
 */
export function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "");
}

/** The export has shipped both pipe- and comma-separated; pick whichever the header uses. */
export function detectDelimiter(text) {
  const line = text.split(/\r?\n/, 1)[0] ?? "";
  return (line.match(/\|/g)?.length ?? 0) > (line.match(/,/g)?.length ?? 0) ? "|" : ",";
}

/**
 * The directory has renamed its columns more than once (`listing_name` vs `market_name`,
 * `location_address` vs `address`), so each field accepts every name it has shipped under.
 */
export const FIELDS = {
  id: ["listing_id", "id", "fmid"],
  name: ["listing_name", "market_name", "marketname", "name"],
  address: ["location_address", "address", "street"],
  city: ["location_city", "city"],
  state: ["location_state", "state"],
  zip: ["location_zipcode", "zipcode", "zip"],
  lat: ["location_y", "latitude", "y"],
  lng: ["location_x", "longitude", "x"],
  season: ["listing_desc", "season", "season1date"],
  hours: ["operating_times", "operating_hours", "season1time", "hours"],
  website: ["media_website", "website", "url"],
  phone: ["contact_phone", "phone"],
  updated: ["updatetime", "update_date", "updated"],
};

const squash = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

/** Map each logical field to its column position, or -1 when the header doesn't carry it. */
export function buildIndex(header) {
  const norm = header.map(squash);
  const index = {};
  for (const [key, candidates] of Object.entries(FIELDS)) {
    const found = candidates.map((c) => norm.indexOf(squash(c))).find((i) => i >= 0);
    index[key] = found ?? -1;
  }
  return index;
}

export function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * A slug unique within its state. Upstream has genuine duplicate names inside one state
 * ("Downtown Farmers Market" twice is common), so collisions fall back to the city and then to a
 * counter. Deterministic: re-importing an unchanged file yields the same slugs, which is what
 * keeps published URLs stable.
 *
 * `taken` is mutated — the caller holds one set per state.
 */
export function uniqueSlug(name, city, taken) {
  const base = slugify(name);
  if (!base) return null;
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }

  const withCity = city ? `${base}-${slugify(city)}` : base;
  let candidate = withCity;
  let n = 2;
  while (taken.has(candidate)) candidate = `${withCity}-${n++}`;
  taken.add(candidate);
  return candidate;
}

export const clean = (v) => {
  const s = (v ?? "").trim();
  return s === "" || s.toLowerCase() === "null" ? null : s;
};

/**
 * A coordinate, or null. The null check is load-bearing: `Number(null)` is 0, so without it a
 * listing with no coordinates imports at 0°N 0°E — a point in the Gulf of Guinea that would then
 * be a perfectly valid PostGIS row and would sit on the map among the real markets.
 */
export const num = (v) => {
  const s = clean(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
