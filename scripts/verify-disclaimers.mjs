/**
 * Check every stored quoted-law string against the document it cites.
 *
 * `state_label_rules.disclaimer_text` and `.placard_text` are the only columns whose contents get
 * PRINTED ONTO FOOD without anybody reviewing them again. A tidied comma, a dropped full stop or a
 * swapped word therefore ships as law. Two were found by accident before this existed — Colorado's
 * "may also contain common food allergies" for the statute's "may also process common food
 * allergens", and a run of programmes carrying a sibling programme's sentence — which is a bad way
 * to find them.
 *
 * Method: fetch each row's own `source_url`, reduce both sides to letters and digits, locate the
 * stored string in the source on that basis, then pull the SOURCE's own characters back out of that
 * span. So a hit says the sentence is really there, and a near-miss shows exactly which characters
 * differ — which is the part that matters, because punctuation in a quoted disclaimer is substance
 * rather than style.
 *
 * Straight vs curly quotes and hyphen vs dash are normalised away: those are the typesetter's
 * choice, not the legislature's. Nothing else is.
 *
 * Verdicts:
 *   EXACT      the stored string appears verbatim in the cited document
 *   DIFFERS    the same words appear, with different characters — read the diff
 *   NOT FOUND  the document does not contain it. Either the citation is wrong, the source is a
 *              summary rather than the law, or the provision has moved
 *   HTTP nnn   the host refused us (findlaw and a few others do)
 *   UNREADABLE fetched, but nothing came out — usually a client-rendered page
 *
 * A NOT FOUND is not proof of an error, and an EXACT against a compilation is not proof of
 * correctness — it only proves the compilation and our copy agree. The verdict narrows where to
 * look; it does not replace reading the law.
 *
 * Usage: node scripts/verify-disclaimers.mjs [--json <out.json>]
 * Needs SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL (read from .env.local if present).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
const { createClient } = require("@supabase/supabase-js");

// Fetched documents are cached outside the repo: they are other people's copyright, some are
// megabytes, and none of them belong in git.
const CACHE = join(tmpdir(), "harvest-disclaimer-sources");
if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

function curl(url) {
  try {
    return execFileSync("curl", ["-sL", "--max-time", "70", "-A", UA, url], {
      maxBuffer: 200 * 1024 * 1024,
      encoding: "buffer",
    });
  } catch {
    return null;
  }
}

async function body(url) {
  const key = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const meta = join(CACHE, `${key}.meta`);
  const bin = join(CACHE, `${key}.bin`);
  if (existsSync(meta) && existsSync(bin)) {
    return { buf: readFileSync(bin), status: Number(readFileSync(meta, "utf8")) };
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/pdf,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(60000),
    });
    let buf = Buffer.from(await res.arrayBuffer());
    let status = res.status;
    if (status !== 200 || buf.length < 400) {
      // Several statute hosts refuse node's fetch and hand curl the document without complaint.
      const c = curl(url);
      if (c && c.length > 400) {
        buf = c;
        status = 200;
      }
    }
    // Never cache a failure — it would make the next run look settled when nothing was read.
    if (status === 200) {
      writeFileSync(bin, buf);
      writeFileSync(meta, String(status));
    }
    return { buf, status };
  } catch (e) {
    const c = curl(url);
    if (c && c.length > 400) {
      writeFileSync(bin, c);
      writeFileSync(meta, "200");
      return { buf: c, status: 200 };
    }
    return { buf: null, status: 0, err: String(e).slice(0, 90) };
  }
}

async function toText(buf) {
  if (!buf || buf.length === 0) return "";
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") {
    try {
      const doc = await pdfjs.getDocument({
        data: new Uint8Array(buf),
        disableFontFace: true,
        useSystemFonts: false,
        verbosity: 0,
      }).promise;
      let out = "";
      for (let n = 1; n <= doc.numPages; n++) {
        const c = await (await doc.getPage(n)).getTextContent();
        for (const it of c.items) if (it.str !== undefined) out += it.str + (it.hasEOL ? " " : "");
        out += "\n";
      }
      return out;
    } catch {
      return "";
    }
  }
  return buf
    .toString("utf8")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8217;|&#8216;|&rsquo;|&lsquo;|&#39;/g, "'")
    .replace(/&[a-z]+;|&#\d+;/gi, " ");
}

/** Letters and digits only, with a map back to the original offsets. */
function fuzzy(text) {
  let f = "";
  const map = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i].toLowerCase();
    if ((c >= "a" && c <= "z") || (c >= "0" && c <= "9")) {
      f += c;
      map.push(i);
    }
  }
  return { f, map };
}

const collapse = (s) => s.replace(/\s+/g, " ").trim();
const glyphs = (x) =>
  x.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[‐-―]/g, "-");

const { data, error } = await db
  .from("state_label_rules")
  .select(
    "disclaimer_text, placard_text, source_url, state_food_programs!inner(state_code, ordinal, name)",
  );
if (error) throw error;

const jobs = [];
for (const r of data) {
  const p = r.state_food_programs;
  const id = `${p.state_code}:${p.ordinal}`;
  if (r.disclaimer_text)
    jobs.push({ id, name: p.name, field: "disclaimer", text: r.disclaimer_text, url: r.source_url });
  if (r.placard_text)
    jobs.push({ id, name: p.name, field: "placard", text: r.placard_text, url: r.source_url });
}
jobs.sort((a, b) => a.id.localeCompare(b.id) || a.field.localeCompare(b.field));

const results = [];
for (const j of jobs) {
  const { buf, status, err } = await body(j.url);
  const text = await toText(buf);
  const stored = collapse(j.text);

  if (!text || text.length < 400) {
    results.push({
      ...j,
      stored,
      verdict: status === 200 || status === 0 ? "UNREADABLE" : `HTTP ${status}`,
      note: err ?? `${text.length} chars`,
    });
    continue;
  }

  const flat = collapse(text);
  if (flat.includes(stored) || glyphs(flat).includes(glyphs(stored))) {
    results.push({ ...j, stored, verdict: "EXACT" });
    continue;
  }

  const src = fuzzy(text);
  const want = fuzzy(j.text);
  const at = src.f.indexOf(want.f);
  if (at < 0) {
    results.push({ ...j, stored, verdict: "NOT FOUND", note: `source ${text.length} chars` });
    continue;
  }
  const start = src.map[at];
  const end = src.map[at + want.f.length - 1] + 1;
  results.push({
    ...j,
    stored,
    verdict: "DIFFERS",
    found: collapse(text.slice(start, Math.min(text.length, end + 3))),
  });
}

const order = { DIFFERS: 0, "NOT FOUND": 1, UNREADABLE: 2, EXACT: 9 };
results.sort(
  (a, b) => (order[a.verdict] ?? 5) - (order[b.verdict] ?? 5) || a.id.localeCompare(b.id),
);

const tally = {};
for (const r of results) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
console.log("=== tally ===");
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(v).padStart(3)}  ${k}`);

console.log("\n=== detail (worst first) ===");
for (const r of results) {
  if (r.verdict === "EXACT") continue;
  console.log(`\n${r.id} ${r.field}  [${r.verdict}]  ${r.name}`);
  console.log(`   url    : ${r.url}`);
  if (r.verdict === "DIFFERS") {
    console.log(`   stored : ${r.stored}`);
    console.log(`   source : ${r.found}`);
  } else {
    if (r.note) console.log(`   note   : ${r.note}`);
    console.log(`   stored : ${r.stored.slice(0, 170)}`);
  }
}

console.log("\n=== exact ===");
console.log(
  results
    .filter((r) => r.verdict === "EXACT")
    .map((r) => `${r.id}/${r.field}`)
    .join("  "),
);

const jsonAt = process.argv.indexOf("--json");
if (jsonAt > -1 && process.argv[jsonAt + 1]) {
  writeFileSync(process.argv[jsonAt + 1], JSON.stringify(results, null, 1));
  console.log(`\nwrote ${process.argv[jsonAt + 1]}`);
}
