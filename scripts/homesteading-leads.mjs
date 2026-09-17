/**
 * Read the homesteading.com farmers-market directory as a LEAD LIST: markets it names that we have
 * no row for, so a person can go and verify each against a primary source.
 *
 * Usage:
 *
 *   node scripts/homesteading-leads.mjs --pages 5            # try a few pages first
 *   node scripts/homesteading-leads.mjs                      # the whole directory
 *   node scripts/homesteading-leads.mjs --out data/markets/homesteading-leads.json
 *
 * What it takes, and what it deliberately does not:
 *
 *   - Takes the market's NAME, street address, town, state, ZIP, phone and its own website. Those
 *     are facts about a public market; the point of collecting them is to go and check them.
 *   - Takes NO photograph. The listing pictures are Google Maps user submissions rehosted without
 *     the photographer's name (every listing carries a "Google Rating" widget and the files are a
 *     bulk sequential import). The copyright sits with individual contributors who licensed it to
 *     nobody here, several frames contain identifiable people, and homesteading.com's own terms
 *     claim the site's content as "our sole property and/or our Associates".
 *   - Takes NO opening hours. They are not on the list pages anyway, and an aggregator's undated
 *     copy of someone else's hours is the source `data/markets/research-*.json` exists to refuse.
 *
 * Output is a file for a person to work through, NOT a write to the database. Nothing here
 * publishes: a lead is a name to check, and `markets` rows come from the USDA import or an admin.
 *
 * Manners: one request at a time, a pause between them, an identifying user agent, and robots.txt
 * checked once up front (it allows /farmers-markets/).
 */

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { lastPage, parseListings } from "./lib/homesteading.mjs";

const argv = process.argv.slice(2);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const BASE = "https://homesteading.com/farmers-markets/";
const UA =
  "HarvestLocalBot/1.0 (+https://harvestlocal.app; market directory research; contact: hello@harvestlocal.app)";
const PAUSE_MS = Number(value("pause") ?? 1500);
const MAX_PAGES = Number(value("pages") ?? 0) || Infinity;
const OUT = value("out") ?? "data/markets/homesteading-leads.json";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const robots = await get("https://homesteading.com/robots.txt").catch(() => "");
  if (/^\s*Disallow:\s*\/farmers-markets/im.test(robots)) {
    throw new Error("robots.txt now disallows /farmers-markets/ — stopping.");
  }

  const first = await get(`${BASE}?directory_type=farmers-markets&view=list`);
  const total = Math.min(lastPage(first), MAX_PAGES);
  console.log(`Directory reports ${lastPage(first)} pages; reading ${total}.`);

  const seen = new Map();
  let pages = 0;
  for (let page = 1; page <= total; page++) {
    const url =
      page === 1
        ? `${BASE}?directory_type=farmers-markets&view=list`
        : `${BASE}page/${page}/?directory_type=farmers-markets&view=list`;
    let html;
    try {
      html = page === 1 ? first : await get(url);
    } catch (err) {
      console.log(`  page ${page}: ${err.message} — skipped`);
      await sleep(PAUSE_MS);
      continue;
    }
    for (const listing of parseListings(html)) {
      if (listing.name && !seen.has(listing.sourceUrl)) seen.set(listing.sourceUrl, listing);
    }
    pages++;
    if (page % 25 === 0 || page === total) {
      console.log(`  page ${page}/${total} — ${seen.size} listings so far`);
    }
    if (page < total) await sleep(PAUSE_MS);
  }

  const listings = [...seen.values()];
  writeFileSync(OUT, `${JSON.stringify(listings, null, 2)}\n`);
  const withState = listings.filter((l) => l.state).length;
  console.log(`\nRead ${pages} pages → ${listings.length} listings (${withState} with a usable state).`);
  console.log(`Wrote ${OUT}`);
}

// pathToFileURL, not a hand-built string: on Windows argv[1] is "C:\..." and the naive form yields
// "file://C:/..." against an import.meta.url of "file:///C:/...", so the script silently does nothing.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
