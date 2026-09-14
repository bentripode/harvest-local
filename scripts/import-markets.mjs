/**
 * Import the USDA Local Food Directory's farmers-market listings into `public.markets`.
 *
 * The directory is a US government work and in the public domain. It is the only national list of
 * farmers markets with coordinates, and it is what lets a market page exist before any seller does
 * — which is the whole point of the entity (20260908130000_markets.sql).
 *
 * Usage:
 *
 *   node scripts/import-markets.mjs --fetch                  # pull the live CSV, all states
 *   node scripts/import-markets.mjs --file fm.csv            # a CSV you already downloaded
 *   node scripts/import-markets.mjs --file fm.csv --state TX --state VT
 *   node scripts/import-markets.mjs --file fm.csv --dry-run
 *
 *   node scripts/import-markets.mjs --contacts --state TX          # fill websites + phones (keyed API)
 *   node scripts/import-markets.mjs --contacts --all-states
 *   node scripts/import-markets.mjs --contacts --file tx.json      # a keyed-API response you saved
 *
 * `--contacts` exists because the bulk export has NO website, phone or hours column — its JSON
 * dropped them — so every market imported from it has none. The keyed API (`USDA_API_KEY`, free
 * from the portal) carries `media_website` and `contact_phone`, and nothing else the bulk import
 * does not already have better: it has the description for 6 Texas markets where the bulk file had
 * dozens. So this mode never re-imports a row; it matches on the listing id and UPDATES those two
 * columns, and only where the API has a value. An absent website is "no information", never "clear
 * it". (Neither source has opening hours; see scripts/market-websites.mjs.)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from .env.local if present):
 * `upsert_market` is granted to service_role alone.
 *
 * Idempotent. Every row is keyed on (source='usda', source_id=<the directory's listing id>), so a
 * re-run updates in place and never duplicates. A market's slug is set once, on first insert, and
 * never updated — the URL gets published and shared, so it must not move because upstream tidied
 * a market's name.
 *
 * What it deliberately does NOT do:
 *
 *   - Invent opening hours. The directory's `operating_times` is free text and absent for a large
 *     share of listings; it lands verbatim in `markets.hours_text` and nowhere else. The
 *     structured `market_hours` rows that drive "open Saturday 9-3" are entered by a person, not
 *     parsed out of prose — a market a buyer might drive to is not a thing to guess at.
 *   - Import a listing with no id, name or state; none of those can be addressed by a URL.
 *   - Delete anything. A listing that vanishes upstream is left alone; hide it by hand.
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  apiRecords,
  buildIndex,
  clean,
  contactFields,
  US_STATES,
  detectDelimiter,
  num,
  parseDelimited,
  uniqueSlug,
} from "./lib/usda-format.mjs";
import { parseUsdaAddress } from "./lib/usda-address.mjs";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const DOWNLOAD_URL =
  "https://www.usdalocalfoodportal.com/api/download_by_directory?directory=farmersmarket";

// --- env -------------------------------------------------------------------

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i).trim()] ??= line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
}

// --- args ------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const values = (name) =>
  argv.reduce((acc, a, i) => (a === `--${name}` && argv[i + 1] ? [...acc, argv[i + 1]] : acc), []);

const DRY_RUN = flag("dry-run");
const ONLY_STATES = values("state").map((s) => s.toUpperCase());

// --- main ------------------------------------------------------------------

async function loadCsv() {
  const file = value("file");
  if (file) {
    if (!existsSync(file)) throw new Error(`no such file: ${file}`);
    return readFileSync(file, "utf8");
  }
  if (!flag("fetch")) throw new Error("pass --file <csv> or --fetch");

  process.stdout.write(`fetching ${DOWNLOAD_URL}\n`);
  // The portal 403s any request whose user-agent looks automated, and 301s to a trailing slash.
  // Both were previously read as "the portal is down"; it was not.
  const res = await fetch(DOWNLOAD_URL, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
      accept: "application/json,text/csv,*/*",
    },
  });
  if (!res.ok) {
    throw new Error(
      `download failed: HTTP ${res.status}. Download by hand from ` +
        `https://www.usdalocalfoodportal.com/fe/datasharing/ and pass --file.`,
    );
  }
  return res.text();
}

/**
 * The directory now serves JSON, and one free-text `location_address` where it used to have
 * `location_city`, `location_state` and `location_zipcode` as their own columns.
 *
 * Rather than teach the whole pipeline a second shape, JSON is flattened into the same header +
 * rows table the delimited path produces, with the address split back out into the columns the
 * FIELDS map already names. A record whose state cannot be read is passed through with an empty
 * one and skipped downstream, exactly like a CSV row missing its state — `markets.state` is the URL
 * and the discovery half of rule 1, so guessing it is not an option.
 */
function tableFromJson(text) {
  const records = JSON.parse(text);
  if (!Array.isArray(records) || records.length === 0) return [];

  const keys = [...new Set(records.flatMap((r) => Object.keys(r)))];
  const derived = ["location_city", "location_state", "location_zipcode"];
  const header = [...keys.filter((k) => !derived.includes(k)), ...derived];

  const rows = [header];
  for (const record of records) {
    const parsed = parseUsdaAddress(record.location_address) ?? {};
    rows.push(
      header.map((key) => {
        if (key === "location_city") return parsed.city ?? "";
        if (key === "location_state") return parsed.state ?? "";
        if (key === "location_zipcode") return parsed.zip ?? "";
        if (key === "location_address") return parsed.street ?? record.location_address ?? "";
        const v = record[key];
        return v == null ? "" : String(v);
      }),
    );
  }
  return rows;
}

async function main() {
  const text = await loadCsv();
  const looksJson = text.trimStart().startsWith("[") || text.trimStart().startsWith("{");
  const rows = looksJson ? tableFromJson(text) : parseDelimited(text, detectDelimiter(text));
  if (rows.length < 2) throw new Error("no data rows");

  const index = buildIndex(rows[0]);
  for (const required of ["id", "name", "state"]) {
    if (index[required] < 0) {
      throw new Error(
        `no column found for "${required}". Header was: ${rows[0].join(", ")}\n` +
          `Add the new name to FIELDS.${required} in scripts/lib/usda-format.mjs.`,
      );
    }
  }

  if (!DRY_RUN && (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const db = DRY_RUN
    ? null
    : createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

  const takenByState = new Map();
  const at = (row, key) => (index[key] >= 0 ? row[index[key]] : null);

  let imported = 0;
  let skipped = 0;
  const failures = [];

  for (const row of rows.slice(1)) {
    const sourceId = clean(at(row, "id"));
    const name = clean(at(row, "name"));
    const state = clean(at(row, "state"))?.toUpperCase();

    if (!sourceId || !name || !state || state.length !== 2) {
      skipped++;
      continue;
    }
    if (ONLY_STATES.length > 0 && !ONLY_STATES.includes(state)) continue;

    const city = clean(at(row, "city"));
    if (!takenByState.has(state)) takenByState.set(state, new Set());
    const slug = uniqueSlug(name, city, takenByState.get(state));
    if (!slug) {
      skipped++;
      continue;
    }

    const args = {
      p_source: "usda",
      p_source_id: sourceId,
      p_slug: slug,
      p_name: name,
      p_state: state,
      p_city: city,
      p_address: clean(at(row, "address")),
      p_postal: clean(at(row, "zip")),
      p_lng: num(at(row, "lng")),
      p_lat: num(at(row, "lat")),
      p_season: clean(at(row, "season")),
      p_hours: clean(at(row, "hours")),
      p_website: clean(at(row, "website")),
      p_phone: clean(at(row, "phone")),
      p_source_updated_at: clean(at(row, "updated")),
    };

    if (DRY_RUN) {
      imported++;
      if (imported <= 5) process.stdout.write(`  ${state}/${slug} — ${name}\n`);
      continue;
    }

    const { error } = await db.rpc("upsert_market", args);
    if (error) failures.push(`${state}/${slug}: ${error.message}`);
    else imported++;

    if (imported > 0 && imported % 500 === 0) {
      process.stdout.write(`  ${imported} imported…\n`);
    }
  }

  process.stdout.write(
    `\n${DRY_RUN ? "would import" : "imported"} ${imported}` +
      `${skipped ? `, skipped ${skipped} unusable row(s)` : ""}` +
      `${failures.length ? `, ${failures.length} failed` : ""}\n`,
  );
  for (const f of failures.slice(0, 20)) process.stdout.write(`  ! ${f}\n`);
  if (failures.length > 20) process.stdout.write(`  … and ${failures.length - 20} more\n`);
}

// --- --contacts: websites and phones from the keyed API ------------------------

const API_URL = "https://www.usdalocalfoodportal.com/api/farmersmarket/";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

/**
 * One state's listings from the keyed API. The portal answers 504 for long stretches and then
 * recovers, so a failure is retried a minute apart before giving up on that state. The key never
 * appears in output — errors name the state, not the URL.
 */
async function fetchStateContacts(state, key) {
  const url = `${API_URL}?apikey=${encodeURIComponent(key)}&state=${state}`;
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(300_000),
        headers: { "user-agent": BROWSER_UA, accept: "application/json" },
      });
      const text = await res.text();
      if (res.ok && /^\s*[[{]/.test(text)) return apiRecords(JSON.parse(text));
      process.stdout.write(`  ${state}: HTTP ${res.status}, retrying (${attempt}/8)\n`);
    } catch (err) {
      process.stdout.write(`  ${state}: ${err.name}, retrying (${attempt}/8)\n`);
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
  throw new Error(`${state}: the USDA API did not answer after 8 attempts`);
}

async function enrichContacts() {
  const file = value("file");
  const states = flag("all-states") ? US_STATES : ONLY_STATES;
  if (!file && states.length === 0) throw new Error("pass --state XX, --all-states, or --file");
  if (!file && !env.USDA_API_KEY) throw new Error("USDA_API_KEY is not set (.env.local)");
  if (!DRY_RUN && (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const db = DRY_RUN
    ? null
    : createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

  const batches = file
    ? [[file, apiRecords(JSON.parse(readFileSync(file, "utf8")))]]
    : states.map((s) => [s, null]);

  const total = { records: 0, withContact: 0, updated: 0, unmatched: 0, failed: 0 };
  for (const [label, preloaded] of batches) {
    const records = preloaded ?? (await fetchStateContacts(label, env.USDA_API_KEY));
    let updated = 0;
    let unmatched = 0;

    for (const record of records) {
      total.records++;
      const { sourceId, website, phone, facebook } = contactFields(record);
      if (!sourceId || (!website && !phone && !facebook)) continue;
      total.withContact++;

      const patch = {};
      if (website) Object.assign(patch, { website_url: website, website_source: "usda" });
      if (phone) patch.phone = phone;
      if (facebook) patch.facebook_url = facebook;

      if (DRY_RUN) {
        updated++;
        continue;
      }
      const { data, error } = await db
        .from("markets")
        .update(patch)
        .eq("source", "usda")
        .eq("source_id", sourceId)
        .select("id");
      if (error) {
        total.failed++;
        process.stdout.write(`  ! ${sourceId}: ${error.message}\n`);
      } else if (!data || data.length === 0) {
        unmatched++; // listed by the API but never imported (e.g. an unreadable address)
      } else {
        updated++;
      }
    }
    total.updated += updated;
    total.unmatched += unmatched;
    process.stdout.write(
      `${label}: ${records.length} listings, ${updated} ${DRY_RUN ? "would be " : ""}updated` +
        `${unmatched ? `, ${unmatched} not in our directory` : ""}\n`,
    );
  }

  process.stdout.write(
    `\n${total.records} listings, ${total.withContact} with a website or phone, ` +
      `${total.updated} ${DRY_RUN ? "would be " : ""}updated` +
      `${total.unmatched ? `, ${total.unmatched} not in our directory` : ""}` +
      `${total.failed ? `, ${total.failed} failed` : ""}\n`,
  );
}

(flag("contacts") ? enrichContacts() : main()).catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
