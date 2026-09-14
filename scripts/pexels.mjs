/**
 * Search Pexels and download photos / videos into `public/`, recording who made each one.
 *
 * Pexels (https://www.pexels.com/license/) is free to use without attribution, but its API
 * guidelines ask that photographers be credited where possible — so every file this writes gets
 * an entry in `src/lib/stock/credits.json`, keyed by the path the page serves it at, carrying the
 * author, their profile and the Pexels page. A credit line is then a lookup, not an archaeology
 * project.
 *
 * Usage:
 *
 *   node scripts/pexels.mjs search "sourdough loaf" [--orientation landscape|portrait|square]
 *                          [--size large|medium|small] [--color <name|hex>] [--per-page 10]
 *                          [--page 1] [--preview <dir>] [--json]
 *   node scripts/pexels.mjs search-videos "farmers market" [same flags, minus --color]
 *   node scripts/pexels.mjs photo <id> --out public/stock/home-hero.jpg [--width 2000] [--force]
 *   node scripts/pexels.mjs video <id> --out public/stock/market.mp4 [--max-width 1920] [--force]
 *
 * `--preview <dir>` saves a small thumbnail of every result there, so a candidate can be looked
 * at before it is chosen. `photo` fetches a compressed JPEG at `--width` (default 2000, never
 * wider than the original); next/image resizes from there. `video` takes the widest MP4 not over
 * `--max-width` and saves Pexels' poster frame beside it as `<name>.jpg`.
 *
 * Needs PEXELS_API_KEY (read from .env.local if present) — free at https://www.pexels.com/api/.
 * The app itself never calls Pexels: this is a build-time tool, which is why the key is not in
 * `src/lib/env.ts`.
 *
 * What it deliberately does NOT do:
 *
 *   - Overwrite a file without `--force`. Anything under `public/` may already be on a page.
 *   - Hotlink. Files are copied into `public/`, so a photo cannot vanish or change underneath a
 *     page because a photographer removed it from Pexels.
 *   - Write alt text for you. Pexels' `alt` is recorded as a starting point; it is often generic
 *     and sometimes wrong, and the right alt depends on what the photo is doing on the page.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

const API = "https://api.pexels.com";
const CREDITS = "src/lib/stock/credits.json";

// --- env -------------------------------------------------------------------

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i < 1 || line.trimStart().startsWith("#")) continue;
    env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

// --- args ------------------------------------------------------------------

const [command, ...rest] = process.argv.slice(2);
const positional = [];
const flags = {};
for (let i = 0; i < rest.length; i++) {
  const arg = rest[i];
  if (!arg.startsWith("--")) {
    positional.push(arg);
    continue;
  }
  const next = rest[i + 1];
  if (next === undefined || next.startsWith("--")) flags[arg.slice(2)] = true;
  else {
    flags[arg.slice(2)] = next;
    i++;
  }
}

function die(message) {
  console.error(message);
  process.exit(1);
}

// --- http ------------------------------------------------------------------

let quota = null;

async function api(path, params = {}) {
  const key = env.PEXELS_API_KEY;
  if (!key) {
    die("PEXELS_API_KEY is not set. Get a free key at https://www.pexels.com/api/ and add it to .env.local.");
  }
  const url = new URL(path, API);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== true) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { Authorization: key } });
  quota = res.headers.get("x-ratelimit-remaining") ?? quota;
  if (res.status === 401 || res.status === 403) die(`Pexels rejected the API key (HTTP ${res.status}).`);
  if (res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    die(`Pexels rate limit reached${reset ? `; it resets ${new Date(reset * 1000).toISOString()}` : ""}.`);
  }
  if (res.status === 404) die(`Pexels has nothing at ${url.pathname}.`);
  if (!res.ok) die(`Pexels returned HTTP ${res.status} for ${url.pathname}: ${await res.text()}`);
  return res.json();
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) die(`Download failed (HTTP ${res.status}): ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  return bytes.length;
}

// --- output paths + credits -----------------------------------------------

/** The URL path a file under public/ is served at, or a refusal if it is not under public/. */
function publicPathFor(out, allowed) {
  if (typeof out !== "string") die("--out <path under public/> is required.");
  const rel = relative(resolve("public"), resolve(out));
  if (rel.startsWith("..") || rel === "" || isAbsolute(rel)) {
    die(`--out must be inside public/ so the page can serve it (got ${out}).`);
  }
  if (!allowed.includes(extname(out).toLowerCase())) {
    die(`--out must end in ${allowed.join(" or ")} (got ${out}).`);
  }
  if (existsSync(out) && !flags.force) die(`${out} already exists; pass --force to replace it.`);
  return "/" + rel.split(sep).join("/");
}

function recordCredit(publicPath, entry) {
  const credits = existsSync(CREDITS) ? JSON.parse(readFileSync(CREDITS, "utf8")) : {};
  credits[publicPath] = entry;
  const sorted = Object.fromEntries(Object.entries(credits).sort(([a], [b]) => a.localeCompare(b)));
  mkdirSync(dirname(CREDITS), { recursive: true });
  writeFileSync(CREDITS, JSON.stringify(sorted, null, 2) + "\n");
}

/** Real pixel size of what was written, via sharp (a Next dependency) when it is installed. */
async function measure(file, fallback) {
  try {
    const { default: sharp } = await import("sharp");
    const { width, height } = await sharp(file).metadata();
    if (width && height) return { width, height };
  } catch {
    // sharp is optional; the computed size is right unless Pexels ignored the width parameter.
  }
  return fallback;
}

const today = () => new Date().toISOString().slice(0, 10);
const kb = (n) => `${Math.round(n / 1024)} KB`;
const orientationOf = (w, h) => (w > h * 1.1 ? "landscape" : h > w * 1.1 ? "portrait" : "square");

// --- commands --------------------------------------------------------------

async function searchPhotos() {
  const query = positional.join(" ");
  if (!query) die('Usage: node scripts/pexels.mjs search "<query>" [flags]');
  const data = await api("/v1/search", {
    query,
    orientation: flags.orientation,
    size: flags.size,
    color: flags.color,
    per_page: flags["per-page"] ?? 10,
    page: flags.page ?? 1,
  });
  if (flags.json) return console.log(JSON.stringify(data, null, 2));

  console.log(`${data.total_results} results for "${query}" (page ${data.page})\n`);
  for (const [i, p] of data.photos.entries()) {
    console.log(`#${i + 1}  photo ${p.id}  ${p.width}×${p.height} ${orientationOf(p.width, p.height)}  by ${p.photographer}`);
    if (p.alt) console.log(`    "${p.alt}"`);
    console.log(`    ${p.url}`);
    if (typeof flags.preview === "string") {
      const file = join(flags.preview, `${p.id}.jpg`);
      await download(p.src.medium, file);
      console.log(`    preview: ${file}`);
    }
  }
}

async function searchVideos() {
  const query = positional.join(" ");
  if (!query) die('Usage: node scripts/pexels.mjs search-videos "<query>" [flags]');
  const data = await api("/v1/videos/search", {
    query,
    orientation: flags.orientation,
    size: flags.size,
    per_page: flags["per-page"] ?? 10,
    page: flags.page ?? 1,
  });
  if (flags.json) return console.log(JSON.stringify(data, null, 2));

  console.log(`${data.total_results} results for "${query}" (page ${data.page})\n`);
  for (const [i, v] of data.videos.entries()) {
    const widths = [...new Set(v.video_files.filter((f) => f.width).map((f) => f.width))].sort((a, b) => a - b);
    console.log(`#${i + 1}  video ${v.id}  ${v.width}×${v.height}  ${v.duration}s  by ${v.user.name}`);
    console.log(`    files at widths ${widths.join(", ")}`);
    console.log(`    ${v.url}`);
    if (typeof flags.preview === "string") {
      const file = join(flags.preview, `video-${v.id}.jpg`);
      await download(v.image, file);
      console.log(`    preview: ${file}`);
    }
  }
}

async function getPhoto() {
  const id = positional[0];
  if (!/^\d+$/.test(id ?? "")) die("Usage: node scripts/pexels.mjs photo <id> --out public/…/name.jpg");
  const publicPath = publicPathFor(flags.out, [".jpg", ".jpeg"]);
  const photo = await api(`/v1/photos/${id}`);

  const width = Math.min(Number(flags.width ?? 2000), photo.width);
  const src = new URL(photo.src.original);
  src.searchParams.set("auto", "compress");
  src.searchParams.set("cs", "tinysrgb");
  src.searchParams.set("w", String(width));

  const bytes = await download(src.toString(), flags.out);
  const size = await measure(flags.out, { width, height: Math.round((width * photo.height) / photo.width) });
  recordCredit(publicPath, {
    kind: "photo",
    pexelsId: photo.id,
    pexelsUrl: photo.url,
    author: photo.photographer,
    authorUrl: photo.photographer_url,
    alt: photo.alt || null,
    ...size,
    avgColor: photo.avg_color,
    downloaded: today(),
  });
  console.log(`${flags.out}  ${size.width}×${size.height}  ${kb(bytes)}  — Photo by ${photo.photographer} on Pexels`);
}

async function getVideo() {
  const id = positional[0];
  if (!/^\d+$/.test(id ?? "")) die("Usage: node scripts/pexels.mjs video <id> --out public/…/name.mp4");
  const publicPath = publicPathFor(flags.out, [".mp4"]);
  const video = await api(`/v1/videos/videos/${id}`);

  const maxWidth = Number(flags["max-width"] ?? 1920);
  const mp4s = video.video_files.filter((f) => f.file_type === "video/mp4" && f.width).sort((a, b) => b.width - a.width);
  if (mp4s.length === 0) die(`Video ${id} has no MP4 rendition.`);
  const file = mp4s.find((f) => f.width <= maxWidth) ?? mp4s[mp4s.length - 1];

  const bytes = await download(file.link, flags.out);
  const posterOut = flags.out.slice(0, -extname(flags.out).length) + ".jpg";
  await download(video.image, posterOut);
  recordCredit(publicPath, {
    kind: "video",
    pexelsId: video.id,
    pexelsUrl: video.url,
    author: video.user.name,
    authorUrl: video.user.url,
    alt: null,
    width: file.width,
    height: file.height,
    duration: video.duration,
    poster: publicPath.slice(0, -extname(publicPath).length) + ".jpg",
    downloaded: today(),
  });
  console.log(`${flags.out}  ${file.width}×${file.height}  ${video.duration}s  ${kb(bytes)}  — Video by ${video.user.name} on Pexels`);
  console.log(`${posterOut}  (poster frame)`);
  if (bytes > 5 * 1024 * 1024) console.warn("Over 5 MB — consider --max-width 1280; this ships to every visitor.");
}

const commands = { search: searchPhotos, "search-videos": searchVideos, photo: getPhoto, video: getVideo };
if (!commands[command]) {
  die("Commands: search | search-videos | photo | video. See the header of scripts/pexels.mjs.");
}
await commands[command]();
// Pexels reports -1 when it is not metering the key, which is not a number worth printing.
if (Number(quota) >= 0) console.error(`\n(${quota} Pexels requests left this month)`);
