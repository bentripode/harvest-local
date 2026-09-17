/**
 * Deciding whether a Wikimedia Commons file really is a picture of a given market, and whether its
 * licence lets us publish it. Pure, so the rules are tested rather than trusted.
 *
 * Commons search is a full-text search over filenames and descriptions, so it answers confidently
 * and often wrongly: "Brattleboro Farmers Market" returns *Illustrated Catalogue of Cottage Organs*,
 * a public-domain book scan that happens to contain the words. Geosearch is worse — 14 of 15
 * markets had a freely-licensed image within a kilometre and not one was of the market; they are
 * courthouses, bridges and churches. So this module only accepts a file whose own title carries
 * the market's identifying words.
 */

/** Words nearly every market shares, which therefore say nothing about which market this is. */
const FILLER = new Set([
  "farmers", "farmer", "farmers'", "farmer's", "market", "markets", "marketplace", "greenmarket",
  "the", "at", "of", "and", "on", "a", "an", "inc", "llc", "association", "co",
  "community", "county", "city", "town", "village", "downtown", "certified", "growers", "grower",
]);

/**
 * Licences we may copy and serve. CC BY-SA and CC BY require the credit and the licence name;
 * CC0 and public domain do not, but we record them anyway so a later reader knows where it came
 * from. Anything else — "fair use", a non-commercial tag, an unreadable licence — is refused,
 * because a marketplace is a commercial use and NC would not cover it.
 */
const ALLOWED = [
  /^cc0/i,
  /^cc[ -]by([ -]sa)?[ -]?\d/i,
  /^public domain/i,
  /^pd[- ]/i,
  /^(pd|public domain)$/i,
];

const REFUSED = [/non[- ]?commercial/i, /\bnc\b/i, /\bnd\b/i, /fair use/i, /copyright/i];

export function licenceAllows(shortName) {
  const s = String(shortName ?? "").trim();
  if (!s) return false;
  if (REFUSED.some((re) => re.test(s))) return false;
  return ALLOWED.some((re) => re.test(s));
}

export function normalize(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The words that identify a market: "Dane County Farmers Market" → {dane}. */
export function distinctiveTokens(name) {
  return new Set(normalize(name).split(" ").filter((w) => w && w.length > 1 && !FILLER.has(w)));
}

/**
 * Whether a Commons file title is plausibly a picture of this market.
 *
 * EVERY identifying word must appear in the title, and the title must itself mention a market.
 * Both halves are needed. Without the first, "Portland Farmers Market" matches a photo of Portland;
 * without the second, "Dane County Farmers Market" matches a picture of Dane County's courthouse.
 *
 * This is necessary and NOT sufficient — see `placeAgrees`. A great many market names reduce to a
 * single common word, and one word matches the world: "East Town Market" in Milwaukee matched
 * "Downham Market - Town Hall - east side" in Norfolk, England, and "Farmers' Market on Broadway"
 * in Green Bay matched a Broadway market in New York City.
 */
export function titleMatchesMarket(marketName, fileTitle) {
  const title = normalize(fileTitle.replace(/^File:/i, ""));
  if (!/\bmarket/.test(title)) return false;
  const core = distinctiveTokens(marketName);
  if (core.size === 0) return false;
  return [...core].every((w) => title.includes(w));
}

/** Metres between two lng/lat pairs (haversine), or null when either is unknown. */
export function metresBetween(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * A photograph OF a market is taken at the market. 500m covers a big square and a stall that moved
 * along the street; it does not cover the other market across town.
 *
 * It was 2000m, which let "HoneySuckle Market, Dothan, Alabama" through as the picture for a
 * different Dothan market 1.6km away.
 */
export const MAX_METRES = 500;

/**
 * Whether the file is anchored to the right PLACE, which is what stops a one-word title match.
 *
 * COORDINATES ONLY, and a file without them is refused. There used to be a fallback that accepted
 * the market's town name appearing in the title, and it was responsible for every bad match in the
 * first national sample: "The Market at Petersburg" in ALASKA took a photograph of the city market
 * in Petersburg, VIRGINIA, and "Arab Farmers' Market" — Arab, Alabama — took a picture of Arab
 * farmers on the border between Tel Aviv and Jaffa. A town name is not a location; it is a word
 * that many towns share.
 *
 * The cost is coverage, and it is worth paying: this drops the national hit rate from about 2% to
 * well under 1%, and what it removes is precisely the matches that were wrong.
 */
export function placeAgrees(market, candidate) {
  const metres = metresBetween(
    { lat: market.lat, lng: market.lng },
    { lat: candidate.lat, lng: candidate.lng },
  );
  if (metres === null) return { ok: false, how: "no coordinates on the file" };
  return metres <= MAX_METRES
    ? { ok: true, how: `${Math.round(metres)}m away` }
    : { ok: false, how: `${Math.round(metres)}m away` };
}

/** Filetypes worth downloading. An SVG logo or a PDF is not a photograph of a market. */
export function isPhotograph(fileTitle) {
  return /\.(jpe?g|png|webp)$/i.test(String(fileTitle ?? ""));
}

/**
 * The best publishable candidate for a market, or null with the reason.
 *
 * `market` is { name, city, lat, lng }; `candidates` are Commons search results carrying
 * { title, licence, author, descriptionUrl, width, height, lat, lng }.
 *
 * Four tests, all required: it is a photograph, its title is this market's, it is anchored to this
 * PLACE, and its licence lets a commercial site publish it with a credit we actually hold.
 */
export function pickCommonsPhoto(market, candidates, minPx = 640) {
  const name = typeof market === "string" ? market : market.name;
  const where = typeof market === "string" ? { city: null, lat: null, lng: null } : market;
  const reasons = [];
  const usable = [];

  for (const c of candidates ?? []) {
    if (!isPhotograph(c.title)) { reasons.push("not a photograph"); continue; }
    if (!titleMatchesMarket(name, c.title)) { reasons.push("title is not this market"); continue; }
    const place = placeAgrees(where, c);
    if (!place.ok) { reasons.push(`wrong place (${place.how})`); continue; }
    if (!licenceAllows(c.licence)) { reasons.push(`licence "${c.licence ?? "?"}" not usable`); continue; }
    if (!c.author) { reasons.push("no author recorded"); continue; }
    if ((c.width ?? 0) < minPx || (c.height ?? 0) < minPx) { reasons.push("too small"); continue; }
    usable.push({ ...c, how: place.how });
  }

  if (usable.length === 0) {
    return { photo: null, reason: reasons[0] ?? "no candidates" };
  }
  // Largest wins: these become a wide card image, and Commons holds some tiny thumbnails.
  usable.sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0));
  return { photo: usable[0], reason: null };
}

/** Commons wraps author in HTML (a link to the uploader's user page). The licence wants the name. */
export function cleanAuthor(raw) {
  const text = String(raw ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 120 ? `${text.slice(0, 119)}…` : text || null;
}
