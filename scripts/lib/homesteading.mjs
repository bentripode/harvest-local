/**
 * Reading the homesteading.com farmers-market list pages. Pure, so the rules are tested rather
 * than trusted — the markup is somebody else's and will change without telling us.
 *
 * Only facts about a public market are read here: its name, address, town, state, ZIP, phone and
 * its own website. No picture and no opening hours; `scripts/homesteading-leads.mjs` says why.
 */

/**
 * The real two-letter codes, so a country abbreviation cannot pass as a state. "Lake Havasu City
 * AZ 86403, US" was filing 28 Arizona markets under a state of "US".
 */
const US_STATES = new Set(
  ("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ " +
    "NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY AS GU MP PR VI").split(" "),
);

/** Street-address tails, so "115 S. Jackson St. Salisbury" yields the town and not the street. */
const STREET_TAIL =
  /^(st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|ln|lane|way|hwy|highway|pkwy|parkway|ct|court|pl|place|sq|square|ste|suite|apt|unit|trl|trail|cir|circle|ter|terrace|pike|route|rt|n|s|e|w|ne|nw|se|sw)\.?$/i;

export function decode(s) {
  return String(s ?? "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Tags out, entities decoded, whitespace collapsed. */
export function strip(html) {
  return decode(String(html ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** The directory's own highest page number, so the crawl stops where the directory does. */
export function lastPage(html) {
  let max = 1;
  for (const m of String(html ?? "").matchAll(/\/farmers-markets\/page\/(\d+)\//g)) {
    max = Math.max(max, Number(m[1]));
  }
  return max;
}

/**
 * A listing's address line into parts.
 *
 * Two things make this less obvious than it looks. The town is not delimited from the street — the
 * whole thing is one run of text — so the town is recovered by walking back from the comma and
 * stopping at the first street word. And the listing's DESCRIPTION is concatenated onto the address
 * in the same element ("… Salisbury, NC 28144 Join us at our location across from …"), so anything
 * after the ZIP is cut rather than carried into the address.
 *
 * Anchored on `, ST 12345`, which is the one reliably shaped part. A line without it returns nulls
 * rather than a guess — a lead filed under the wrong state is worse than a lead with no state.
 */
export function splitAddress(raw) {
  const text = strip(raw).replace(/^Address\s*:\s*/i, "");
  const empty = { addressText: text || null, street: null, city: null, state: null, postalCode: null };
  if (!text) return empty;

  // Shape 1, the US postal form: "115 S. Jackson St. Salisbury, NC 28144". The comma before the
  // state is optional — "Lake Havasu City AZ 86403" has none.
  const postal = /[,\s]\s*([A-Z]{2})[,\s]\s*(\d{5})(?:-\d{4})?\b/.exec(text);
  if (postal && US_STATES.has(postal[1])) {
    const before = text.slice(0, postal.index).trim();
    // A comma already delimits the town when there is one ("Kennedy Park, Danbury"); only fall back
    // to walking back through the words when the whole address is one undelimited run.
    const lastSegment = before.includes(",") ? before.slice(before.lastIndexOf(",") + 1).trim() : null;
    const words = before.split(/\s+/).filter(Boolean);
    const town = lastSegment ? lastSegment.split(/\s+/) : walkBackForTown(words);
    return {
      // Everything after the ZIP is the listing's prose, not part of the address.
      addressText: text.slice(0, postal.index + postal[0].length).trim() || null,
      street: words.slice(0, words.length - town.length).join(" ").replace(/[,\s]+$/, "") || null,
      city: town.join(" ") || null,
      state: postal[1],
      postalCode: postal[2],
    };
  }

  // Shape 2, the form Google hands back: "1225 3rd Street Northeast, Washington, DC, USA".
  // Comma-delimited, no ZIP, often a trailing country. Roughly half of these listings.
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  const country = parts.length > 1 && /^(usa|us|u\.s\.a?\.?|united states)$/i.test(parts.at(-1));
  const cut = country ? parts.slice(0, -1) : parts;
  const stateIdx = cut.findIndex((p, i) => i > 0 && US_STATES.has(p.toUpperCase()));
  if (stateIdx > 0) {
    return {
      addressText: cut.join(", ") || null,
      street: cut.slice(0, stateIdx - 1).join(", ") || null,
      city: cut[stateIdx - 1] || null,
      state: cut[stateIdx],
      postalCode: null,
    };
  }

  return empty;
}

/**
 * The town at the end of "115 S. Jackson St. Salisbury", walking back from the comma and stopping
 * at the first street word. Punctuation is stripped before the test, or "NW," slips past the check
 * and "707 1st Ave NW, Pine City" yields a town of "NW, Pine City".
 */
function walkBackForTown(words) {
  const town = [];
  for (let i = words.length - 1; i >= 0 && town.length < 4; i--) {
    const bare = words[i].replace(/[.,]+$/, "");
    if (/^\d/.test(bare) || STREET_TAIL.test(bare)) break;
    town.unshift(words[i].replace(/,$/, ""));
  }
  return town;
}

/** The content of one `directorist-listing-card-<field>` element within a listing block. */
function field(block, name) {
  const re = new RegExp(`directorist-listing-card-${name}[^>]*>([\\s\\S]*?)</li>`, "i");
  const m = re.exec(block);
  return m ? strip(m[1]) : null;
}

/** Every listing on one list page. */
export function parseListings(html) {
  const out = [];
  const blocks = String(html ?? "").split('<h2 class="directorist-listing-title">').slice(1);

  for (const block of blocks) {
    const title = /<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (!title) continue;
    const name = strip(title[2]);
    if (!name) continue;

    const chunk = block.slice(0, 8000);
    const address = splitAddress(field(chunk, "address"));
    const zip = (field(chunk, "zip") || "").match(/\b(\d{5})\b/);
    // Leading "(" included, or "(786) 620-5672" comes back as "786) 620-5672".
    const phone = (field(chunk, "phone") || "").match(/\(?\d[\d ()+.\-]{6,}/);

    // The listing's own site, never a link back into the directory.
    const websiteBlock = /directorist-listing-card-website[\s\S]{0,400}?href="(https?:\/\/[^"]+)"/i.exec(chunk);
    const website =
      websiteBlock && !/homesteading\.com/i.test(websiteBlock[1]) ? decode(websiteBlock[1]) : null;

    // The separate zip field is only a fallback, and only when it is not simply the street number
    // repeated — "11000 Red Road" was being filed as ZIP 11000.
    const loose = zip && !new RegExp(`^${zip[1]}\\b`).test(address.addressText ?? "") ? zip[1] : null;

    out.push({
      name,
      sourceUrl: decode(title[1]),
      ...address,
      postalCode: address.postalCode ?? loose,
      phone: phone ? phone[0].trim() : null,
      website,
    });
  }
  return out;
}
