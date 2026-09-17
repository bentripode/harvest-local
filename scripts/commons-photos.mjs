/**
 * Find a freely-licensed photograph of each market on Wikimedia Commons, and copy it into our own
 * bucket with the credit the licence requires.
 *
 * Usage:
 *
 *   node scripts/commons-photos.mjs --state VT --dry-run
 *   node scripts/commons-photos.mjs --state VT
 *   node scripts/commons-photos.mjs --all-states --limit 500
 *
 * Unlike a Google Places photo, a CC0/CC BY/CC BY-SA/public-domain file MAY be copied and served
 * from our bucket — that is the whole reason to prefer Commons. What the licence asks instead is
 * attribution, so the author and licence name are stored WITH the picture (see
 * 20260916110000_market_image_credit.sql); a photograph whose author we lost is one we may no
 * longer publish, and the CHECK constraint enforces that.
 *
 * Coverage is honestly narrow. Commons has real photographs of famous markets — Pike Place, Union
 * Square, Reading Terminal, Dane County, Ann Arbor — and essentially nothing of Dorset, Glover or
 * Abbeville. This sweep is for the first group; everything else keeps its monogram tile.
 *
 * NOTHING is accepted on proximity. Geosearch looked promising and is useless: 14 of 15 markets had
 * a freely-licensed image within a kilometre, and not one was of the market — they are courthouses,
 * bridges and churches. A file qualifies only if its own title carries the market's identifying
 * words AND mentions a market (scripts/lib/commons-match.mjs).
 *
 * It never overwrites a picture a person uploaded (`image_source = 'admin'`), and never one the
 * website scan took from the market's own site — that is the market's own choice of image and
 * outranks a stranger's snapshot.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { cleanAuthor, pickCommonsPhoto } from "./lib/commons-match.mjs";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const value = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const STATE = (value("state") ?? "").toUpperCase();
const ALL_STATES = flag("all-states");
const LIMIT = Number(value("limit") ?? 0) || Infinity;
const DRY_RUN = flag("dry-run");
const PAUSE_MS = Number(value("pause") ?? 350);
const THUMB_PX = 1200;
const MIN_PX = 640;
const BUCKET = "market-images";

const UA =
  "HarvestLocalBot/1.0 (https://harvestlocal.app; farmers market directory; hello@harvestlocal.app)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/**
 * Commons files whose text matches the market's name, with the licence metadata needed to judge
 * them. One request per market; the API is free and asks only for a real user agent.
 */
export async function searchCommons(name) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&generator=search" +
    `&gsrsearch=${encodeURIComponent(name)}&gsrnamespace=6&gsrlimit=8` +
    "&prop=imageinfo|coordinates&iiprop=url|size|extmetadata&format=json&origin=*";
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return Object.values(body?.query?.pages ?? {}).map((p) => {
    const info = p.imageinfo?.[0] ?? {};
    const meta = info.extmetadata ?? {};
    return {
      title: p.title,
      url: info.url ?? null,
      descriptionUrl: info.descriptionurl ?? null,
      width: info.width ?? 0,
      height: info.height ?? 0,
      licence: meta.LicenseShortName?.value ?? null,
      author: cleanAuthor(meta.Artist?.value),
      // Commons holds coordinates for many photographs, and they are the strongest evidence that a
      // one-word title match is really this market and not one in Norfolk.
      lat: p.coordinates?.[0]?.lat ?? null,
      lng: p.coordinates?.[0]?.lon ?? null,
    };
  });
}

async function thumbnail(bytes) {
  const { default: sharp } = await import("sharp");
  const meta = await sharp(bytes).metadata();
  if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < MIN_PX) return null;
  return sharp(bytes)
    .rotate()
    .resize(THUMB_PX, THUMB_PX, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

async function main() {
  const e = env();
  const base = e.NEXT_PUBLIC_SUPABASE_URL;
  const h = {
    apikey: e.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  if (!ALL_STATES && !/^[A-Z]{2}$/.test(STATE)) throw new Error("Pass --state XX or --all-states");

  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(base, e.SUPABASE_SERVICE_ROLE_KEY);

  // Only markets with no picture at all. A market's own image, or a person's, outranks this.
  const query =
    `${base}/rest/v1/markets?select=id,slug,name,state,city,lng,lat&image_url=is.null` +
    (ALL_STATES ? "" : `&state=eq.${STATE}`) +
    "&order=state,name";
  const markets = (await (await fetch(query, { headers: h })).json()).slice(0, LIMIT);
  if (!Array.isArray(markets) || markets.length === 0) {
    console.log("Nothing to do — every market here already has a picture.");
    return;
  }
  console.log(`${markets.length} markets with no picture${DRY_RUN ? " (dry run)" : ""}.\n`);

  let found = 0;
  let none = 0;
  for (const m of markets) {
    let result;
    try {
      result = pickCommonsPhoto(m, await searchCommons(m.name), MIN_PX);
    } catch (err) {
      console.log(`  ?  ${m.name} — search failed: ${err.message}`);
      await sleep(PAUSE_MS);
      continue;
    }

    if (!result.photo) {
      none++;
      await sleep(PAUSE_MS);
      continue;
    }

    const p = result.photo;
    console.log(
      `  ✓  ${m.name} (${m.state})\n       ${p.title.replace("File:", "")}` +
        `  [${p.licence}] by ${p.author} — ${p.how}`,
    );
    found++;
    if (DRY_RUN) {
      await sleep(PAUSE_MS);
      continue;
    }

    try {
      const img = await fetch(p.url, { headers: { "user-agent": UA } });
      if (!img.ok) throw new Error(`image HTTP ${img.status}`);
      const thumb = await thumbnail(Buffer.from(await img.arrayBuffer()));
      if (!thumb) throw new Error("too small once decoded");

      const path = `${m.state.toLowerCase()}/${m.slug}.jpg`;
      const { error } = await db.storage
        .from(BUCKET)
        .upload(path, thumb, { contentType: "image/jpeg", upsert: true });
      if (error) throw new Error(`upload failed: ${error.message}`);

      const v = createHash("sha1").update(thumb).digest("hex").slice(0, 10);
      const { data } = db.storage.from(BUCKET).getPublicUrl(path);
      await fetch(`${base}/rest/v1/markets?id=eq.${m.id}`, {
        method: "PATCH",
        headers: { ...h, Prefer: "return=minimal" },
        body: JSON.stringify({
          image_path: path,
          image_url: `${data.publicUrl}?v=${v}`,
          image_source: "commons",
          image_source_url: p.descriptionUrl,
          image_credit: p.author,
          image_license: p.licence,
        }),
      });
    } catch (err) {
      console.log(`       ! not stored: ${err.message}`);
      found--;
      none++;
    }
    await sleep(PAUSE_MS);
  }

  console.log(`\n${found} pictures found, ${none} markets left without one.${DRY_RUN ? " Nothing written." : ""}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
