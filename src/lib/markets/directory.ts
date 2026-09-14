/**
 * The market directory's search, view and link helpers. Pure, so the page, the client component
 * and the tests agree.
 *
 * Search runs in the browser over the state's whole list (608 markets at most, in California), so
 * it answers as you type, needs no query language, and puts no user input anywhere near SQL.
 */

export type DirectoryView = "list" | "map";

export function parseView(raw: string | string[] | undefined): DirectoryView {
  return raw === "map" ? "map" : "list";
}

export function parseQuery(raw: string | string[] | undefined): string {
  return typeof raw === "string" ? raw.slice(0, 100) : "";
}

/** Lower-case, accents off, punctuation to spaces: "Café-Market" and "cafe market" are one search. */
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface Searchable {
  name: string;
  city: string | null;
  postalCode: string | null;
  addressText: string | null;
}

/**
 * Every word of the query must appear somewhere in the market's name, city, ZIP or address — so
 * "downtown austin" finds the Austin downtown market and not every market called Downtown.
 * An empty query matches everything.
 */
export function matchesMarket(market: Searchable, query: string): boolean {
  const words = normalize(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(
    [market.name, market.city, market.postalCode, market.addressText].filter(Boolean).join(" "),
  );
  return words.every((w) => haystack.includes(w));
}

export function filterMarkets<T extends Searchable>(markets: T[], query: string): T[] {
  return markets.filter((m) => matchesMarket(m, query));
}

/** The directory URL for a view and query, dropping the defaults so the plain URL stays plain. */
export function directoryHref(
  base: string,
  { view, query }: { view: DirectoryView; query: string },
): string {
  const params = new URLSearchParams();
  if (view === "map") params.set("view", "map");
  if (query.trim()) params.set("q", query.trim());
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * A market's website as a link we are willing to render, or null.
 *
 * The value comes from an outside directory and lands in an `href`, so anything that is not
 * http(s) — `javascript:`, `data:`, a mailto typed into the wrong field — is refused outright.
 * A bare host ("www.example.org"), which the directory often has, is given `http://`: the site
 * upgrades it if it serves https, and guessing https would break the ones that do not.
 */
export function safeWebsiteUrl(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `http://${s.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** "aggielandfarmersmarket.org" — what the link says, so a reader knows where it goes. */
export function websiteLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    const label = host + path;
    return label.length > 40 ? `${label.slice(0, 39)}…` : label;
  } catch {
    return url;
  }
}
