/**
 * Pure helpers for `scripts/market-websites.mjs`: what a market's own web page says about it.
 *
 * Split out so they can be tested, because every one of them is a place to guess, and the rule for
 * this data is the one in 20260908220000_markets.sql — a market someone might drive to is not a
 * thing to guess at. So each helper recognises or refuses: a picture the page explicitly offers,
 * hours the page publishes as schema.org data, a robots.txt read the way RFC 9309 says. Anything
 * ambiguous comes back empty.
 */

// --- HTML ------------------------------------------------------------------

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
    const c = code.toLowerCase();
    if (c.startsWith("#x")) return String.fromCodePoint(parseInt(c.slice(2), 16));
    if (c.startsWith("#")) return String.fromCodePoint(parseInt(c.slice(1), 10));
    return ENTITIES[c] ?? m;
  });
}

/** Every `<meta>` tag as a lower-cased attribute map. Attribute order varies from site to site. */
export function metaTags(html) {
  const tags = [];
  for (const [, attrs] of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const map = {};
    for (const [, name, , v1, v2, v3] of attrs.matchAll(
      /([a-z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi,
    )) {
      map[name.toLowerCase()] = decodeEntities(v1 ?? v2 ?? v3 ?? "").trim();
    }
    tags.push(map);
  }
  return tags;
}

/** Every JSON-LD block that parses, flattened: arrays and `@graph` unrolled into single nodes. */
export function jsonLdNodes(html) {
  const nodes = [];
  const visit = (v) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") {
      nodes.push(v);
      if (v["@graph"]) visit(v["@graph"]);
    }
  };
  for (const [, body] of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      visit(JSON.parse(body.trim()));
    } catch {
      // A malformed block is skipped, not repaired.
    }
  }
  return nodes;
}

const typesOf = (node) => [node["@type"]].flat().filter((t) => typeof t === "string");

function absolute(raw, base) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const url = new URL(raw.trim(), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * The picture a page offers to represent itself: og:image, then twitter:image, then the image or
 * logo of the page's own organisation / place in JSON-LD. Never an arbitrary `<img>` from the body
 * — that could be a sponsor's logo or a stock photo, and we would be presenting it as the market.
 */
export function previewImage(html, pageUrl) {
  const metas = metaTags(html);
  const meta = (key) =>
    metas.find((m) => (m.property ?? m.name ?? "").toLowerCase() === key && m.content)?.content;

  const fromMeta =
    meta("og:image:secure_url") ?? meta("og:image") ?? meta("og:image:url") ?? meta("twitter:image");
  const resolved = absolute(fromMeta, pageUrl);
  if (resolved) return resolved;

  for (const node of jsonLdNodes(html)) {
    const types = typesOf(node);
    if (!types.some((t) => /Organization|LocalBusiness|Place|Store|Market/i.test(t))) continue;
    for (const key of ["image", "logo"]) {
      const v = node[key];
      const candidate = typeof v === "string" ? v : Array.isArray(v) ? v[0] : v?.url;
      const url = absolute(typeof candidate === "string" ? candidate : null, pageUrl);
      if (url) return url;
    }
  }
  return null;
}

// --- opening hours -----------------------------------------------------------

const DAY_INDEX = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6,
};
// openingHours strings range over Mo..Su in this order, so "Fr-Mo" wraps through the weekend.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

function dayOf(raw) {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/^https?:\/\/schema\.org\//i, "").toLowerCase();
  return DAY_INDEX[name] ?? null;
}

/** "8:00", "08:00", "08:00:00" → "08:00", or null. */
function hhmm(raw) {
  const m = typeof raw === "string" ? raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/) : null;
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

const slot = (dayOfWeek, opens, closes) =>
  opens && closes && closes > opens ? { dayOfWeek, opens, closes } : null;

/** One openingHoursSpecification object → slots, or null if any part of it will not read. */
function fromSpecification(spec, today) {
  if (!spec || typeof spec !== "object") return null;
  if (typeof spec.validThrough === "string" && spec.validThrough.slice(0, 10) < today) return [];
  const days = [spec.dayOfWeek].flat().map(dayOf);
  if (days.length === 0 || days.some((d) => d === null)) return null;
  const opens = hhmm(spec.opens);
  const closes = hhmm(spec.closes);
  const slots = days.map((d) => slot(d, opens, closes));
  return slots.some((s) => s === null) ? null : slots;
}

/** One openingHours string ("Mo-Fr 09:00-17:00", "Sa 08:00-12:00,14:00-16:00") → slots, or null. */
function fromOpeningHoursString(raw) {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^([A-Za-z,\s-]+?)\s+(\d{1,2}:\d{2}-\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}-\d{1,2}:\d{2})*)$/);
  if (!m) return null;

  const days = [];
  for (const part of m[1].split(",").map((p) => p.trim()).filter(Boolean)) {
    const [a, b] = part.split("-").map((p) => DAY_INDEX[p.trim().toLowerCase()]);
    if (a === undefined || (part.includes("-") && b === undefined)) return null;
    if (b === undefined) days.push(a);
    else {
      let i = WEEK.indexOf(a);
      for (let n = 0; n < 7; n++, i = (i + 1) % 7) {
        days.push(WEEK[i]);
        if (WEEK[i] === b) break;
      }
    }
  }

  const slots = [];
  for (const span of m[2].split(",")) {
    const [o, c] = span.trim().split("-").map(hhmm);
    for (const d of days) {
      const s = slot(d, o, c);
      if (!s) return null;
      slots.push(s);
    }
  }
  return slots;
}

/**
 * The weekly schedule a page publishes as schema.org data, or null.
 *
 * Refuses rather than guesses, in each of these cases: any entry that will not parse (one bad line
 * poisons the set — a half-read schedule reads as the whole one); an Event node (its times are the
 * event's, not the market's); and more than one node with hours, because an association's site
 * that lists three markets gives no way to know which schedule is this market's.
 */
export function openingHours(html, today = new Date().toISOString().slice(0, 10)) {
  const sets = [];
  for (const node of jsonLdNodes(html)) {
    if (typesOf(node).some((t) => /Event/i.test(t))) continue;
    const specs = node.openingHoursSpecification;
    const strings = node.openingHours;
    if (specs === undefined && strings === undefined) continue;

    const slots = [];
    for (const spec of [specs ?? []].flat()) {
      const read = fromSpecification(spec, today);
      if (read === null) return null;
      slots.push(...read);
    }
    for (const str of [strings ?? []].flat()) {
      const read = fromOpeningHoursString(str);
      if (read === null) return null;
      slots.push(...read);
    }
    if (slots.length > 0) sets.push(slots);
  }

  if (sets.length !== 1) return null;
  const seen = new Set();
  return sets[0]
    .filter((s) => {
      const key = `${s.dayOfWeek}|${s.opens}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.opens.localeCompare(b.opens));
}

// --- robots.txt (RFC 9309) ---------------------------------------------------

/** The rules that apply to `agent`: its own group if one names it, else the `*` group. */
export function robotsRules(text, agent) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === "allow" || key === "disallow")) {
        current.rules.push({ allow: key === "allow", path: value });
      }
    }
  }
  // The product token alone ("HarvestLocalBot" of "HarvestLocalBot/1.0 (+url)"), matched exactly:
  // a substring match would read a group for "bot" as addressed to us.
  const token = agent.split(/[/\s]/)[0].toLowerCase();
  const own = groups.filter((g) => g.agents.includes(token));
  const chosen = own.length > 0 ? own : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules);
}

function ruleMatches(rulePath, path) {
  if (rulePath === "") return false;
  const anchored = rulePath.endsWith("$");
  const body = (anchored ? rulePath.slice(0, -1) : rulePath)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

/** Longest matching rule wins; on a tie, allow wins; no match means allowed. */
export function robotsAllows(rules, path) {
  let best = null;
  for (const rule of rules) {
    if (!ruleMatches(rule.path, path)) continue;
    const len = rule.path.replace(/\$$/, "").length;
    if (!best || len > best.len || (len === best.len && rule.allow)) best = { len, allow: rule.allow };
  }
  return best ? best.allow : true;
}

// --- which sites we visit ----------------------------------------------------

/**
 * Hosts we do not scan: social platforms require a login, forbid automated access in their terms,
 * and serve their own branding as the preview image, which is not a picture of the market.
 */
const SOCIAL = /(^|\.)(facebook|fb|instagram|twitter|x|tiktok|linkedin|youtube|pinterest|yelp|linktr)\.(com|ee|me)$/i;

export function isSocialHost(hostname) {
  return SOCIAL.test(hostname);
}

/** Same rules as `safeWebsiteUrl` in src/lib/markets/directory.ts: http(s) only, bare host → http. */
export function siteUrl(raw) {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `http://${s.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withScheme);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname.includes(".")) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}
