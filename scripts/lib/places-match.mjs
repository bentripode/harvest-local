/**
 * Deciding whether a Google Place really is the market we asked about. Pure, so the rule is tested
 * rather than trusted.
 *
 * Text Search fuzzy-matches and will happily answer with something else: asking for "Salisbury
 * Rowan Farmers Market, 115 S Jackson St" returns "Salisbury Farmers' Market" at 228 E Kerr St.
 * Accepting that would hang a photograph of one market on another market's page, which is the whole
 * failure this integration exists to avoid — so a candidate has to prove itself on two axes and a
 * market with nothing to check against is left unmatched rather than guessed.
 */

/** Words nearly every market shares, which therefore say nothing about which market this is. */
const FILLER = new Set([
  "farmers", "farmer", "farmers'", "farmer's", "market", "markets", "marketplace",
  "the", "at", "of", "and", "on", "a", "an", "inc", "llc", "association", "co",
  "community", "county", "city", "town", "village", "downtown", "certified", "growers", "grower",
]);

export function normalize(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The words that actually identify a market: "Salisbury Rowan Farmers Market" → {salisbury, rowan}. */
export function distinctiveTokens(name) {
  return new Set(normalize(name).split(" ").filter((w) => w && w.length > 1 && !FILLER.has(w)));
}

/**
 * Words that distinguish one place from its neighbour rather than abbreviating it. "North Salem"
 * is not a short form of "Salem", it is the next town — and that exact pair turned up in the
 * homesteading listings, pointing at a North Salem website under a Salem heading.
 */
const QUALIFIERS = new Set([
  "north", "south", "east", "west", "upper", "lower", "old", "new", "little", "big", "great",
  "central", "port", "fort", "mount", "saint", "st", "lake", "grand",
]);

/**
 * How much two market names agree on the words that identify them, 0–1.
 *
 * Proportion of the SMALLER set that is shared, not Jaccard: "Salisbury Farmers' Market" is a
 * plausible short form of "Salisbury Rowan Farmers Market", and Jaccard would punish it for the
 * word it is missing. Being a subset is normal between a directory name and Google's name.
 *
 * The exception is a qualifier only one side carries, which marks a different place rather than a
 * shorter name for the same one, and scores 0 however much else the two share.
 */
export function nameScore(a, b) {
  const x = distinctiveTokens(a);
  const y = distinctiveTokens(b);
  if (x.size === 0 || y.size === 0) return 0;

  for (const t of x) if (QUALIFIERS.has(t) && !y.has(t)) return 0;
  for (const t of y) if (QUALIFIERS.has(t) && !x.has(t)) return 0;

  let shared = 0;
  for (const t of x) if (y.has(t)) shared++;
  return shared / Math.min(x.size, y.size);
}

/** Metres between two lng/lat pairs (haversine). */
export function metresBetween(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** A market stall moves around a square; a different market is somewhere else entirely. */
export const MAX_METRES = 800;
/** Below this the names are describing different markets, however close together they stand. */
export const MIN_NAME_SCORE = 0.5;

/**
 * Google's own answer to "is this a farmers market", and the check that matters most.
 *
 * Without it the name test alone is far too weak, because the one word our name and a candidate's
 * usually share is the TOWN, which every business in that town also carries: "Peacham Farmers
 * Market" scored a perfect 1.00 against "Peacham Café", "Brandon Farmers Market" against "Brandon
 * Town Recreation Department", and "Killington Farmers Market" against "Killington Deli &
 * Marketplace". Each would have hung a photograph of a café or a council office on a market page.
 */
export const MARKET_TYPES = new Set(["farmers_market", "market"]);

export function looksLikeAMarket(candidate) {
  const types = candidate?.types ?? [];
  return types.some((t) => MARKET_TYPES.has(t));
}

/**
 * Whether `candidate` is our `market`.
 *
 * Both tests must pass, and BOTH must be answerable. A market with no coordinates of ours cannot be
 * checked on location, and several markets often share one town — so it is refused rather than
 * accepted on the name alone. 24 of our 7,032 rows have no location; they stay unmatched.
 */
export function judgeCandidate(market, candidate) {
  const score = nameScore(market.name, candidate.name);
  const metres = metresBetween(
    { lat: market.lat, lng: market.lng },
    { lat: candidate.lat, lng: candidate.lng },
  );

  if (!looksLikeAMarket(candidate)) {
    const what = candidate?.primaryType ?? "unknown";
    return { ok: false, reason: `not a market (Google calls it ${what})`, score, metres };
  }
  if (metres === null) {
    return { ok: false, reason: "no coordinates to verify against", score, metres };
  }
  if (score < MIN_NAME_SCORE) {
    return { ok: false, reason: `name too different (${score.toFixed(2)})`, score, metres };
  }
  if (metres > MAX_METRES) {
    return { ok: false, reason: `${Math.round(metres)}m away`, score, metres };
  }
  return { ok: true, reason: null, score, metres };
}

/** The best acceptable candidate, or null with the reason the closest one failed. */
export function pickPlace(market, candidates) {
  const judged = (candidates ?? []).map((c) => ({ candidate: c, ...judgeCandidate(market, c) }));
  // A `farmers_market` beats a generic `market`, then the closer name, then the nearer one. Google
  // does not return candidates best-first for this: asking for Brandon's market put "Wood's Market
  // Garden" ahead of "Brandon Farmers Market".
  const rank = (j) => (j.candidate?.primaryType === "farmers_market" ? 1 : 0);
  const good = judged
    .filter((j) => j.ok)
    .sort((a, b) => rank(b) - rank(a) || b.score - a.score || a.metres - b.metres);
  if (good.length > 0) return { place: good[0].candidate, ...good[0] };
  const nearest = judged.sort((a, b) => (a.metres ?? Infinity) - (b.metres ?? Infinity))[0];
  return { place: null, reason: nearest ? nearest.reason : "no candidates", score: 0, metres: null };
}
