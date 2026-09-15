/**
 * Publish researched market details from `data/markets/research-<state>.json`.
 *
 *   node scripts/apply-market-research.mjs --file data/markets/research-tx.json [--dry-run]
 *
 * The file is the record: each entry was read from listings by a person (or by Claude on the
 * owner's instruction) and names its sources, and keeping it in the repo means the directory can
 * be rebuilt from it and anyone can see what was claimed and why. Every entry is validated first
 * (scripts/lib/market-research.mjs); one bad entry stops the whole run.
 *
 * What it will and will not overwrite:
 *
 *   - website: set only where the market has none, or one the website scan found dead or someone
 *     else's (`website_status` unreachable / parked / taken_over / unrelated). A working USDA
 *     website is never replaced. A new one is marked `website_source = 'research'` and left for the
 *     next `scripts/market-websites.mjs` run to check and take a picture from.
 *   - facebook: set only where there is none. It is a link; nothing is collected from Facebook,
 *     which forbids automated collection.
 *   - hours: written as `source = 'research'` with the source note and URL, replacing earlier
 *     research rows — and never where a person entered hours or the market's own site publishes
 *     them. The season, if known, goes in `market_hours.note`.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from .env.local).
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { validateEntry } from "./lib/market-research.mjs";

const require = createRequire(import.meta.url);

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i < 1 || line.trimStart().startsWith("#")) continue;
    env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const argv = process.argv.slice(2);
const fileArg = argv[argv.indexOf("--file") + 1];
const DRY_RUN = argv.includes("--dry-run");
const AGAINST = new Set(["unreachable", "parked", "taken_over", "unrelated"]);

async function main() {
  if (!argv.includes("--file") || !fileArg || !existsSync(fileArg)) {
    throw new Error("Usage: node scripts/apply-market-research.mjs --file data/markets/research-xx.json");
  }
  const entries = JSON.parse(readFileSync(fileArg, "utf8"));
  if (!Array.isArray(entries)) throw new Error("the research file must be a JSON array");

  const valid = [];
  const errors = [];
  for (const e of entries) {
    const r = validateEntry(e);
    if (r.ok) valid.push(r.value);
    else errors.push(...r.errors);
  }
  if (errors.length > 0) throw new Error(`Refusing to apply — fix these first:\n  ${errors.join("\n  ")}`);

  const { createClient } = require("@supabase/supabase-js");
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const tally = { website: 0, facebook: 0, hours: 0, kept: 0, missing: 0 };
  for (const r of valid) {
    const { data: m, error } = await db
      .from("markets")
      .select("id, name, website_url, website_status, facebook_url, hours:market_hours(source)")
      .eq("state", r.state)
      .eq("slug", r.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!m) {
      tally.missing++;
      console.log(`! ${r.state}/${r.slug}: no such market`);
      continue;
    }

    const said = [];
    const patch = {};
    if (r.website) {
      const usable = m.website_url && !AGAINST.has(m.website_status);
      if (usable && m.website_url !== r.website) {
        said.push("kept USDA website");
        tally.kept++;
      } else if (!usable) {
        Object.assign(patch, {
          website_url: r.website,
          website_source: "research",
          website_status: null,
          website_checked_at: null,
          website_check_note: null,
        });
        said.push("website");
        tally.website++;
      }
    }
    if (r.facebook && !m.facebook_url) {
      patch.facebook_url = r.facebook;
      said.push("facebook");
      tally.facebook++;
    }

    const others = (m.hours ?? []).filter((h) => h.source !== "research");
    if (r.hours && others.length > 0) {
      said.push(`kept ${others[0].source} hours`);
      tally.kept++;
    } else if (r.hours && !DRY_RUN) {
      await db.from("market_hours").delete().eq("market_id", m.id).eq("source", "research");
      const { error: insErr } = await db.from("market_hours").insert(
        r.hours.map((h) => ({
          market_id: m.id,
          day_of_week: h.dayOfWeek,
          opens: h.opens,
          closes: h.closes,
          note: r.season,
          source: "research",
          source_note: r.sourceNote,
          source_url: r.sourceUrl,
        })),
      );
      if (insErr) throw new Error(`${r.state}/${r.slug}: ${insErr.message}`);
      said.push(`${r.hours.length} hour slot(s)`);
      tally.hours++;
    } else if (r.hours) {
      said.push(`${r.hours.length} hour slot(s)`);
      tally.hours++;
    }

    if (Object.keys(patch).length > 0 && !DRY_RUN) {
      const { error: upErr } = await db.from("markets").update(patch).eq("id", m.id);
      if (upErr) throw new Error(`${r.state}/${r.slug}: ${upErr.message}`);
    }
    console.log(`${r.state}/${r.slug} — ${said.join(", ") || "nothing new"}`);
  }

  console.log(
    `\n${valid.length} entries${DRY_RUN ? " (dry run)" : ""}: ${tally.website} websites, ` +
      `${tally.facebook} Facebook pages, ${tally.hours} schedules` +
      `${tally.kept ? `, ${tally.kept} left as they were` : ""}` +
      `${tally.missing ? `, ${tally.missing} unknown markets` : ""}`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
