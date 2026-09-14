/**
 * Visit each market's own website and record what it says about itself: its link-preview picture
 * (copied as a small thumbnail) and, where the site publishes them as schema.org data, its opening
 * hours. See 20260914110000_market_website_scan.sql for why each is stored the way it is.
 *
 * Usage:
 *
 *   node scripts/market-websites.mjs --url https://example-market.org   # read one site, write nothing
 *   node scripts/market-websites.mjs --state TX                         # every TX market with a site
 *   node scripts/market-websites.mjs --state TX --limit 20 --dry-run    # look, don't write
 *   node scripts/market-websites.mjs --state TX --recheck-days 0        # revisit even recent ones
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from .env.local), except for
 * --url. Uses sharp (installed with Next) to make the thumbnail.
 *
 * Manners, because these are small community websites and we are a stranger:
 *
 *   - robots.txt is read for every site and obeyed, for the page and for the image. A server
 *     error on robots.txt counts as "keep out" (RFC 9309 §2.3.1.4); a missing one allows.
 *   - One request at a time per site, a pause between them, a handful of sites in parallel.
 *   - The user agent says who we are, and nothing is fetched twice within --recheck-days (30).
 *   - Social platforms are skipped outright: they need a login and forbid this in their terms.
 *
 * What it deliberately does NOT do:
 *
 *   - Take a picture from the page body. Only the image the site explicitly offers to represent
 *     itself (og:image, twitter:image, or its organisation's JSON-LD image/logo) — an arbitrary
 *     <img> could be a sponsor's logo, and we would be presenting it as the market.
 *   - Read hours out of prose. Only schema.org openingHours / openingHoursSpecification, and only
 *     when the page has exactly one schedule that parses completely.
 *   - Touch hours a person entered. A market with any `source = 'admin'` row is left alone.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  isSocialHost,
  openingHours,
  previewImage,
  robotsAllows,
  robotsRules,
  siteUrl,
} from "./lib/market-site.mjs";

const require = createRequire(import.meta.url);

// --- env + args ------------------------------------------------------------

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i < 1 || line.trimStart().startsWith("#")) continue;
    env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const DRY_RUN = flag("dry-run");
const ONE_URL = value("url");
const STATE = value("state")?.toUpperCase();
const LIMIT = Number(value("limit") ?? Infinity);
const RECHECK_DAYS = Number(value("recheck-days") ?? 30);

const SITE = env.NEXT_PUBLIC_SITE_URL || "https://harvestlocal.app";
const USER_AGENT = `HarvestLocalBot/1.0 (+${SITE}; farmers market directory)`;
const PARALLEL_SITES = 4;
const PAUSE_MS = 1000;
const PAGE_TIMEOUT_MS = 12000;
const PAGE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const THUMB_PX = 480;
const MIN_IMAGE_PX = 120; // smaller is an icon or a tracking pixel, not a picture of anything
const BUCKET = "market-images";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- fetching --------------------------------------------------------------

async function fetchCapped(url, { accept, maxBytes }) {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    headers: { "user-agent": USER_AGENT, accept },
  });
  if (!res.ok) return { res, body: null };
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    size += chunk.length;
    if (size > maxBytes) {
      await reader.cancel();
      return { res, body: null, tooBig: true };
    }
    chunks.push(chunk);
  }
  return { res, body: Buffer.concat(chunks) };
}

const robotsCache = new Map();

/** Whether we may fetch `url`. Cached per origin for the run. */
async function mayFetch(url) {
  const origin = url.origin;
  if (!robotsCache.has(origin)) {
    robotsCache.set(
      origin,
      (async () => {
        try {
          const { res, body } = await fetchCapped(`${origin}/robots.txt`, {
            accept: "text/plain",
            maxBytes: 512 * 1024,
          });
          if (res.status >= 500) return [{ allow: false, path: "/" }];
          if (!res.ok || !body) return [];
          return robotsRules(body.toString("utf8"), USER_AGENT);
        } catch {
          return [{ allow: false, path: "/" }]; // unreachable: assume no
        }
      })(),
    );
  }
  const rules = await robotsCache.get(origin);
  return robotsAllows(rules, url.pathname + url.search);
}

/** Read one market's site. Returns { note, imageUrl?, imageBytes?, hours? } and writes nothing. */
async function readSite(rawUrl) {
  const url = siteUrl(rawUrl);
  if (!url) return { note: "website address unusable" };
  if (isSocialHost(url.hostname)) return { note: "social media page, not scanned" };
  if (!(await mayFetch(url))) return { note: "robots.txt disallows" };

  let page;
  try {
    page = await fetchCapped(url, { accept: "text/html,application/xhtml+xml", maxBytes: PAGE_MAX_BYTES });
  } catch (err) {
    return { note: err.name === "TimeoutError" ? "timed out" : "unreachable" };
  }
  if (!page.res.ok) return { note: `HTTP ${page.res.status}` };
  if (!page.body) return { note: "page too large" };
  if (!/html/i.test(page.res.headers.get("content-type") ?? "")) return { note: "not an HTML page" };

  const finalUrl = page.res.url || url.toString();
  const html = page.body.toString("utf8");
  const hours = openingHours(html);
  const imageUrl = previewImage(html, finalUrl);
  if (!imageUrl) return { note: "no preview image", hours };

  const img = new URL(imageUrl);
  if (!(await mayFetch(img))) return { note: "robots.txt disallows the image", hours };

  await sleep(PAUSE_MS);
  let image;
  try {
    image = await fetchCapped(img, { accept: "image/avif,image/webp,image/png,image/jpeg,image/*", maxBytes: IMAGE_MAX_BYTES });
  } catch {
    return { note: "image unreachable", hours };
  }
  const type = image.res.headers.get("content-type") ?? "";
  if (!image.res.ok || !image.body) return { note: `image HTTP ${image.res.status}`, hours };
  if (!/^image\//i.test(type) || /svg/i.test(type)) return { note: "image not a photo format", hours };

  return { note: "ok", imageUrl, imageBytes: image.body, hours };
}

async function thumbnail(bytes) {
  let sharp;
  try {
    ({ default: sharp } = await import("sharp"));
  } catch {
    throw new Error("sharp is not installed — it ships with Next; run npm install.");
  }
  const meta = await sharp(bytes).metadata();
  if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < MIN_IMAGE_PX) return null;
  return sharp(bytes)
    .rotate()
    .resize(THUMB_PX, THUMB_PX, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

// --- one URL, nothing written ----------------------------------------------

async function inspectOne(rawUrl) {
  const result = await readSite(rawUrl);
  console.log(`note:  ${result.note}`);
  console.log(`image: ${result.imageUrl ?? "—"}`);
  if (result.imageBytes) {
    const thumb = await thumbnail(result.imageBytes);
    console.log(thumb ? `thumb: ${Math.round(thumb.length / 1024)} KB` : "thumb: image too small to use");
  }
  console.log(`hours: ${result.hours ? JSON.stringify(result.hours) : "— (none published as schema.org data)"}`);
}

// --- the directory ---------------------------------------------------------

async function scanDirectory() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const { createClient } = require("@supabase/supabase-js");
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const cutoff = new Date(Date.now() - RECHECK_DAYS * 86400_000).toISOString();
  const markets = [];
  for (let from = 0; ; from += 1000) {
    let q = db
      .from("markets")
      .select("id, state, slug, name, website_url, website_checked_at, hours:market_hours(source)")
      .not("website_url", "is", null)
      .or(`website_checked_at.is.null,website_checked_at.lt."${cutoff}"`)
      .order("state")
      .order("slug")
      .range(from, from + 999);
    if (STATE) q = q.eq("state", STATE);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    markets.push(...data);
    if (data.length < 1000) break;
  }
  const todo = markets.slice(0, LIMIT);
  if (todo.length === 0) {
    console.log("Nothing to do — no market with a website is due a visit.");
    return;
  }

  // One queue per site, so a site is never hit by two requests at once.
  const bySite = new Map();
  for (const m of todo) {
    const host = siteUrl(m.website_url)?.hostname ?? `bad:${m.id}`;
    if (!bySite.has(host)) bySite.set(host, []);
    bySite.get(host).push(m);
  }
  const queues = [...bySite.values()];
  console.log(`${todo.length} markets on ${queues.length} sites${DRY_RUN ? " (dry run)" : ""}\n`);

  const tally = {};
  let done = 0;

  async function handle(m) {
    const result = await readSite(m.website_url);
    const note = result.note;
    const update = { website_checked_at: new Date().toISOString(), website_check_note: note };

    if (result.imageBytes) {
      const thumb = await thumbnail(result.imageBytes).catch(() => null);
      if (!thumb) {
        update.website_check_note = "image too small or unreadable";
      } else if (!DRY_RUN) {
        const path = `${m.state.toLowerCase()}/${m.slug}.jpg`;
        const { error } = await db.storage
          .from(BUCKET)
          .upload(path, thumb, { contentType: "image/jpeg", upsert: true });
        if (error) {
          update.website_check_note = `upload failed: ${error.message}`;
        } else {
          // Versioned by content, so a changed picture is not served stale from the CDN.
          const v = createHash("sha1").update(thumb).digest("hex").slice(0, 10);
          const { data } = db.storage.from(BUCKET).getPublicUrl(path);
          Object.assign(update, {
            image_path: path,
            image_url: `${data.publicUrl}?v=${v}`,
            image_source_url: result.imageUrl,
          });
        }
      }
    }

    const personEntered = (m.hours ?? []).some((h) => h.source !== "website");
    if (result.hours && !personEntered && !DRY_RUN) {
      await db.from("market_hours").delete().eq("market_id", m.id).eq("source", "website");
      const { error } = await db.from("market_hours").insert(
        result.hours.map((h) => ({
          market_id: m.id,
          day_of_week: h.dayOfWeek,
          opens: h.opens,
          closes: h.closes,
          source: "website",
        })),
      );
      if (error) update.website_check_note += `; hours not saved: ${error.message}`;
    }

    if (!DRY_RUN) {
      const { error } = await db.from("markets").update(update).eq("id", m.id);
      if (error) update.website_check_note += `; row not updated: ${error.message}`;
    }

    const key = update.website_check_note.split(":")[0];
    tally[key] = (tally[key] ?? 0) + 1;
    if (result.hours) tally["with hours"] = (tally["with hours"] ?? 0) + 1;
    done++;
    console.log(
      `[${done}/${todo.length}] ${m.state}/${m.slug} — ${update.website_check_note}` +
        (result.hours ? ` · ${result.hours.length} hour slot(s)` : ""),
    );
  }

  async function worker() {
    for (;;) {
      const queue = queues.shift();
      if (!queue) return;
      for (const m of queue) {
        try {
          await handle(m);
        } catch (err) {
          done++;
          tally.error = (tally.error ?? 0) + 1;
          console.log(`[${done}/${todo.length}] ${m.state}/${m.slug} — error: ${err.message}`);
        }
        await sleep(PAUSE_MS);
      }
    }
  }

  await Promise.all(Array.from({ length: PARALLEL_SITES }, worker));
  console.log("\nSummary:");
  for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${n}  ${k}`);
}

(ONE_URL ? inspectOne(ONE_URL) : scanDirectory()).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
