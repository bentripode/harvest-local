/**
 * Validate a market lead list and say how much of it is left to work through.
 *
 *   node scripts/check-market-leads.mjs                                  # every *-leads.json
 *   node scripts/check-market-leads.mjs --file data/markets/x-leads.json  # just one
 *   node scripts/check-market-leads.mjs --pending                        # list what is unread
 *
 * Exits non-zero if any file is malformed, so a lead list cannot rot into free text: the verdict
 * vocabulary is fixed and a finding must carry a date and a reason. See `lib/market-leads.mjs`.
 *
 * This is the counter, and it is the whole reason the validator is not dead code — the same role
 * `/admin/programs` plays for unverified programme rows. It reads and reports; it never writes a
 * file and never touches the database. A lead becomes a `markets` row through the USDA import or
 * an admin, after a person has read the market's own site.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { summarise, validateLeadFile } from "./lib/market-leads.mjs";

const DIR = "data/markets";
const argv = process.argv.slice(2);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const only = value("file");
const showPending = argv.includes("pending") || argv.includes("--pending");

const files = only
  ? [only]
  : readdirSync(DIR)
      .filter((f) => f.endsWith("-leads.json"))
      .map((f) => join(DIR, f));

if (files.length === 0) {
  console.log(`No *-leads.json in ${DIR}.`);
  process.exit(0);
}

let failed = false;

for (const path of files) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`${path}: not valid JSON — ${err.message}`);
    failed = true;
    continue;
  }

  // A bare array is raw scraper output (what `homesteading-leads.mjs` writes), not a record. That
  // is a legitimate file to have on disk and not an error — running the scraper and then the
  // checker should not report a failure for doing nothing wrong. It is only not a worklist yet.
  if (Array.isArray(parsed)) {
    console.log(`\n${path}`);
    console.log(`  ${parsed.length} entries, raw scraper output — no verdicts, so nothing to count.`);
    console.log(`  Annotate it into the record shape before trusting or committing it.`);
    continue;
  }

  const result = validateLeadFile(parsed);
  if (!result.ok) {
    console.error(`\n${path}: ${result.errors.length} problem(s)`);
    for (const e of result.errors) console.error(`  - ${e}`);
    failed = true;
    continue;
  }

  const s = summarise(parsed.leads);
  console.log(`\n${path}`);
  console.log(`  source     ${parsed.source} (scraped ${parsed.scrapedAt})`);
  console.log(`  ${s.total} entries · ${s.distinct} distinct · ${s.pending} unread · ${s.usable} usable`);
  for (const [verdict, n] of Object.entries(s.byVerdict)) {
    if (n > 0) console.log(`    ${verdict.padEnd(13)} ${n}`);
  }
  // The headline number is the one that misleads: "37 leads" read as 37 markets we could add,
  // when four are known wrong and none has been confirmed.
  if (s.usable === 0) {
    console.log(`  Nothing in this file is confirmed yet — do not import from it.`);
  }

  if (showPending) {
    for (const lead of parsed.leads) {
      if (lead.verdict !== "pending") continue;
      console.log(`    · ${lead.name} — ${lead.city ?? "?"}, ${lead.state ?? "?"}`);
      console.log(`      ${lead.sourceUrl}`);
    }
  }
}

process.exit(failed ? 1 : 0);
