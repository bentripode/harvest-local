/**
 * Match our markets to Google Place IDs, so the market page can show Google's photographs of them.
 *
 * Usage:
 *
 *   node scripts/google-places.mjs --state VT --dry-run       # look, write nothing
 *   node scripts/google-places.mjs --state VT
 *   node scripts/google-places.mjs --state VT --limit 20 --recheck-days 0
 *
 * Needs GOOGLE_MAPS_API_KEY and the Supabase service role key, both from .env.local.
 *
 * THE PLACE ID IS THE ONLY THING STORED, and that is not an accident. Google's Places policy says
 * "You must not pre-fetch, cache, or store Places API content beyond the allowed exceptions", and
 * names exactly one exception: "the place_id is exempt from caching restrictions. You can therefore
 * store place ID values indefinitely." So no photograph, no photo reference, no opening hours and
 * no rating is written here — the market page fetches those live at render time and shows the
 * photographer's credit beside them.
 *
 * Matching is verified, not trusted. Text Search fuzzy-matches: asking for "Salisbury Rowan Farmers
 * Market, 115 S Jackson St" answers with "Salisbury Farmers' Market" at 228 E Kerr St. A candidate
 * must agree on the identifying words of the name AND stand within 800m of the coordinates we
 * already hold (see scripts/lib/places-match.mjs). A market we cannot verify is left unmatched with
 * the reason recorded — an unmatched market shows its monogram tile, which is fine; a wrongly
 * matched one shows a photograph of somebody else's market, which is not.
 */

import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { pickPlace } from "./lib/places-match.mjs";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const value = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const STATE = (value("state") ?? "").toUpperCase();
const LIMIT = Number(value("limit") ?? 0) || Infinity;
const DRY_RUN = flag("dry-run");
const RECHECK_DAYS = Number(value("recheck-days") ?? 90);
const PAUSE_MS = Number(value("pause") ?? 200);

function env() {
  if (!existsSync(".env.local")) throw new Error("No .env.local");
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
      }),
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Candidate places for one market. The field mask is the narrowest that answers the question —
 * Google bills at the highest SKU any requested field belongs to, and `photos` alone would push
 * every search into the Enterprise tier for data we are not allowed to keep anyway.
 */
export async function searchPlaces(key, query) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.formattedAddress,places.primaryType,places.types",
    },
    // No locationBias, deliberately. Biasing to the coordinates we hold SUPPRESSED the right
    // answer: "Brandon Farmers Market, Central Park, Brandon, VT, 05733" biased to Brandon returned
    // a park, a town clerk and a brewery, while the plain "Brandon Farmers Market, Brandon, VT"
    // returned the actual market. Recall is Google's job here; verifying the answer is ours, and
    // `judgeCandidate` still measures the distance itself.
    body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  return (body.places ?? []).map((p) => ({
    id: p.id,
    name: p.displayName?.text ?? "",
    address: p.formattedAddress ?? null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    primaryType: p.primaryType ?? null,
    types: p.types ?? [],
  }));
}

async function main() {
  const e = env();
  const key = e.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set in .env.local");
  if (!/^[A-Z]{2}$/.test(STATE)) throw new Error("Pass --state XX");

  const base = e.NEXT_PUBLIC_SUPABASE_URL;
  const h = {
    apikey: e.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  const cutoff = new Date(Date.now() - RECHECK_DAYS * 864e5).toISOString();
  const url =
    `${base}/rest/v1/markets?select=id,name,city,address_text,postal_code,lng,lat,google_place_id,google_place_checked_at` +
    `&state=eq.${STATE}` +
    `&or=(google_place_checked_at.is.null,google_place_checked_at.lt."${cutoff}")`;
  const markets = (await (await fetch(url, { headers: h })).json()).slice(0, LIMIT);

  if (!Array.isArray(markets) || markets.length === 0) {
    console.log("Nothing to do — every market in that state has been looked up recently.");
    return;
  }
  console.log(`${markets.length} ${STATE} markets to look up${DRY_RUN ? " (dry run)" : ""}.\n`);

  let matched = 0;
  let refused = 0;
  for (const m of markets) {
    // Name and town only. Adding the street and ZIP pulled the search toward whatever sits at that
    // address — a park, a town clerk — instead of the market that meets there.
    const where = [m.city, STATE].filter(Boolean).join(", ");
    let result;
    try {
      const candidates = await searchPlaces(key, `${m.name}, ${where}`);
      result = pickPlace(m, candidates);
    } catch (err) {
      console.log(`  ?  ${m.name} — lookup failed: ${err.message}`);
      await sleep(PAUSE_MS);
      continue;
    }

    if (result.place) {
      matched++;
      console.log(`  ✓  ${m.name}\n       → ${result.place.name} (${Math.round(result.metres)}m, name ${result.score.toFixed(2)})`);
    } else {
      refused++;
      console.log(`  ·  ${m.name} — no match: ${result.reason}`);
    }

    if (!DRY_RUN) {
      const patch = {
        google_place_id: result.place?.id ?? null,
        google_place_checked_at: new Date().toISOString(),
        google_place_note: result.place ? null : result.reason,
      };
      await fetch(`${base}/rest/v1/markets?id=eq.${m.id}`, {
        method: "PATCH",
        headers: { ...h, Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      });
    }
    await sleep(PAUSE_MS);
  }

  console.log(`\n${matched} matched, ${refused} left unmatched.${DRY_RUN ? " Nothing written." : ""}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
