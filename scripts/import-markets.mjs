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
  buildIndex,
  clean,
  detectDelimiter,
  num,
  parseDelimited,
  uniqueSlug,
} from "./lib/usda-format.mjs";

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
  const res = await fetch(DOWNLOAD_URL, {
    headers: { "user-agent": "harvest-local market import" },
  });
  if (!res.ok) {
    throw new Error(
      `download failed: HTTP ${res.status}. The portal is frequently down — download the CSV by ` +
        `hand from https://www.usdalocalfoodportal.com/fe/datasharing/ and pass --file.`,
    );
  }
  return res.text();
}

async function main() {
  const text = await loadCsv();
  const rows = parseDelimited(text, detectDelimiter(text));
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

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
