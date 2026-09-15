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
 *   node scripts/market-websites.mjs --state TX --retry-failed          # only unreachable / timed out / unsaved
 *   node scripts/market-websites.mjs --state TX --status unrelated      # re-judge one verdict after a rule change
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
 *   - Touch a picture a person uploaded on /admin/markets (`image_source = 'admin'`).
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  isSocialHost,
  openingHours,
  pageVerdict,
  previewImage,
  robotsAllows,
  robotsRules,
  siteKey,
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
// Revisit only the visits that failed for reasons that may have been ours (our network, a blip on
// their end) rather than a clear answer from the site — instead of re-crawling every site.
const RETRY_FAILED = flag("retry-failed");
// Revisit markets holding one verdict, whenever they were checked — for re-judging a verdict after
// the rules behind it change (`--status unrelated`).
const ONLY_STATUS = value("status");

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

/**
 * May we fetch `url`? Returns null for yes, or the note to record for no. Cached per origin.
 *
 * The three noes are kept apart because the note is what someone reads later to learn why a market
 * has no picture: a site that is simply gone (DNS or connection failure — common, since the
 * directory's addresses date back years) is not a site that asked us to stay away.
 */
async function refusal(url) {
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
          // RFC 9309 §2.3.1.4: a server error on robots.txt means assume complete disallow.
          if (res.status >= 500) return { blocked: "robots.txt server error, treated as no" };
          if (!res.ok || !body) return { rules: [] };
          return { rules: robotsRules(body.toString("utf8"), USER_AGENT) };
        } catch (err) {
          return { blocked: err.name === "TimeoutError" ? "timed out" : "site unreachable" };
        }
      })(),
    );
  }
  const robots = await robotsCache.get(origin);
  if (robots.blocked) return robots.blocked;
  return robotsAllows(robots.rules, url.pathname + url.search) ? null : "robots.txt disallows";
}

const VERDICT_NOTES = {
  parked: "domain for sale, not the market's",
  taken_over: "domain taken over by spam, not the market's",
  unrelated: "page does not mention the market",
  unreadable: "page has too little text to read (built by JavaScript?)",
};
/** The verdicts that mean the site is not the market's any more — the link goes, and what we took. */
const AGAINST = new Set(["unreachable", "parked", "taken_over", "unrelated"]);

/**
 * Read one market's site and write nothing. Returns `{ note, status, imageUrl?, imageBytes?,
 * hours? }`, where `status` is the `website_status` verdict — or undefined when this visit says
 * nothing either way (a 403, robots.txt, a timeout), which the caller must not treat as "gone".
 */
async function readSite(rawUrl, marketName, rejectedImage = null) {
  const url = siteUrl(rawUrl);
  if (!url) return { note: "website address unusable" };
  if (isSocialHost(url.hostname)) return { note: "social media page, not scanned" };
  const pageRefused = await refusal(url);
  if (pageRefused) {
    return { note: pageRefused, status: pageRefused === "site unreachable" ? "unreachable" : undefined };
  }

  let page;
  try {
    page = await fetchCapped(url, { accept: "text/html,application/xhtml+xml", maxBytes: PAGE_MAX_BYTES });
  } catch (err) {
    return err.name === "TimeoutError"
      ? { note: "timed out" }
      : { note: "site unreachable", status: "unreachable" };
  }
  if (!page.res.ok) {
    const gone = page.res.status === 404 || page.res.status === 410;
    return { note: `HTTP ${page.res.status}`, status: gone ? "unreachable" : undefined };
  }
  if (!page.body) return { note: "page too large" };
  if (!/html/i.test(page.res.headers.get("content-type") ?? "")) return { note: "not an HTML page" };

  const finalUrl = page.res.url || url.toString();
  const html = page.body.toString("utf8");

  // Before anything is taken from it: is this page still the market's? A lapsed domain's new
  // owner supplies a preview image too, and in Texas two of them were gambling adverts.
  const verdict = pageVerdict(html, finalUrl, marketName);
  // "unreadable" clears any earlier verdict (status null: the link shows again) but takes nothing,
  // because a page we could not read cannot confirm a picture or a schedule is the market's.
  if (verdict === "unreadable") return { note: VERDICT_NOTES.unreadable, status: null };
  if (verdict !== "ok") return { note: VERDICT_NOTES[verdict], status: verdict };

  const hours = openingHours(html, marketName);
  const imageUrl = previewImage(html, finalUrl);
  // `noImage`: the site answered and has no usable picture — as opposed to a picture we failed to
  // fetch this time, which must not wipe the one we already hold.
  if (!imageUrl) return { note: "no preview image", status: "ok", hours, noImage: true };
  if (imageUrl === rejectedImage) {
    return { note: "image was rejected on review", status: "ok", hours, noImage: true };
  }

  const img = new URL(imageUrl);
  const imageRefused = await refusal(img);
  if (imageRefused) return { note: `image: ${imageRefused}`, status: "ok", hours };

  await sleep(PAUSE_MS);
  let image;
  try {
    image = await fetchCapped(img, { accept: "image/avif,image/webp,image/png,image/jpeg,image/*", maxBytes: IMAGE_MAX_BYTES });
  } catch {
    return { note: "image unreachable", status: "ok", hours };
  }
  const type = image.res.headers.get("content-type") ?? "";
  if (!image.res.ok || !image.body) return { note: `image HTTP ${image.res.status}`, status: "ok", hours };
  if (!/^image\//i.test(type) || /svg/i.test(type)) {
    return { note: "image not a photo format", status: "ok", hours };
  }

  return { note: "ok", status: "ok", imageUrl, imageBytes: image.body, hours };
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
  const thumb = await sharp(bytes)
    .rotate()
    .resize(THUMB_PX, THUMB_PX, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  // A white logo drawn on transparency flattens to a white square — six of them reached the CA,
  // MN and MI cards before anyone looked. One flat colour is not a picture of anything. (Measured
  // on the output: `stats()` on a pipeline reads the input, alpha channel and all.)
  const { channels } = await sharp(thumb).stats();
  return channels.every((c) => c.stdev < 4) ? "blank" : thumb;
}

// --- one URL, nothing written ----------------------------------------------

async function inspectOne(rawUrl) {
  const name = value("name");
  if (!name) console.log("(no --name: the page check and hours need the market's name)");
  const result = await readSite(rawUrl, name ?? "");
  console.log(`note:  ${result.note}`);
  console.log(`site:  ${result.status ?? "no verdict"}`);
  console.log(`image: ${result.imageUrl ?? "—"}`);
  if (result.imageBytes) {
    const thumb = await thumbnail(result.imageBytes);
    console.log(
      thumb === "blank"
        ? "thumb: one flat colour — not used"
        : thumb
          ? `thumb: ${Math.round(thumb.length / 1024)} KB`
          : "thumb: image too small to use",
    );
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
      .select(
        "id, state, slug, name, website_url, website_checked_at, website_check_note, image_path, image_source, image_rejected_source_url, hours:market_hours(source)",
      )
      .not("website_url", "is", null)
      .or(
        ONLY_STATUS
          ? `website_status.eq.${ONLY_STATUS.replace(/[^a-z_]/g, "")}`
          : RETRY_FAILED
          ? "website_checked_at.is.null,website_check_note.ilike.*unreachable*,website_check_note.ilike.*timed out*"
          : `website_checked_at.is.null,website_checked_at.lt."${cutoff}"`,
      )
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

  // How many markets, in any state, list each site. A page shared by several markets can still
  // give the organiser's picture, but its schedule cannot be every one of those markets' schedule.
  const siteCounts = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("markets")
      .select("website_url")
      .not("website_url", "is", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data) {
      const key = siteKey(row.website_url);
      if (key) siteCounts.set(key, (siteCounts.get(key) ?? 0) + 1);
    }
    if (data.length < 1000) break;
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
    const result = await readSite(m.website_url, m.name, m.image_rejected_source_url);
    const update = { website_checked_at: new Date().toISOString(), website_check_note: result.note };

    // What this visit means for what we already hold. A clear verdict against the site drops the
    // picture and the website hours, because they came from a site that is no longer the market's.
    // "ok" replaces them with whatever the site offers now. No verdict (a 403, robots.txt, a
    // timeout) changes nothing: it is not news about the market.
    const against = AGAINST.has(result.status);
    if (result.status !== undefined) update.website_status = result.status;
    if (against) result.hours = null;
    const dropImage = against || result.noImage === true;
    const replaceHours = result.status !== undefined;

    // A picture a person uploaded on /admin/markets is theirs to change, not the scan's: neither
    // replaced nor cleared, whatever the site says now.
    const personPicked = m.image_source === "admin";
    if (personPicked) result.imageBytes = null;

    if (dropImage && m.image_path && !personPicked) {
      Object.assign(update, {
        image_path: null,
        image_url: null,
        image_source_url: null,
        image_source: null,
      });
      if (!DRY_RUN) await db.storage.from(BUCKET).remove([m.image_path]);
    }

    if (result.imageBytes) {
      const thumb = await thumbnail(result.imageBytes).catch(() => null);
      if (!thumb) {
        update.website_check_note = "image too small or unreadable";
      } else if (thumb === "blank") {
        update.website_check_note = "image is one flat colour (a white logo on transparency?)";
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
            image_source: "website",
          });
        }
      }
    }

    const personEntered = (m.hours ?? []).some((h) => h.source !== "website");
    const sharedBy = siteCounts.get(siteKey(m.website_url)) ?? 1;
    if (result.hours && sharedBy > 1) {
      update.website_check_note += `; hours not used, site shared by ${sharedBy} markets`;
      result.hours = null;
    }
    // Website hours are replaced wholesale on any visit with a verdict — including by nothing, when
    // the site stopped publishing them — and a person's rows are never touched.
    if (replaceHours && !personEntered && !DRY_RUN) {
      await db.from("market_hours").delete().eq("market_id", m.id).eq("source", "website");
    }
    if (result.hours && replaceHours && !personEntered && !DRY_RUN) {
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
