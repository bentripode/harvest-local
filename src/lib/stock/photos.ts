import credits from "./credits.json";

/**
 * A stock photo that `scripts/pexels.mjs` downloaded into `public/`, with its size and who took it.
 *
 * Keyed by the served path, so a typo is a type error rather than a broken image. Alt text is NOT
 * carried from here: Pexels' is generic, and the right alt depends on what the photo is doing on
 * the page that uses it. See the stock-photo rule in CLAUDE.md for where these may appear.
 */
export type StockPath = keyof typeof credits;

export function stockPhoto(path: StockPath) {
  const c = credits[path];
  return {
    src: path,
    width: c.width,
    height: c.height,
    avgColor: c.avgColor,
    // Whitespace only — Pexels carries some names with a doubled space ("Graham  Roy").
    author: c.author.replace(/\s+/g, " ").trim(),
    authorUrl: c.authorUrl,
    pexelsUrl: c.pexelsUrl,
  };
}

/**
 * The tile photo for each top-level category, by slug. Categories are admin-editable rows, so one
 * with no entry here is expected, not an error — its tile renders without a picture.
 */
const CATEGORY_PHOTOS: Record<string, StockPath> = {
  produce: "/stock/category-produce.jpg",
  "baked-goods": "/stock/category-baked-goods.jpg",
  "dairy-eggs": "/stock/category-dairy-eggs.jpg",
  "meat-seafood": "/stock/category-meat-seafood.jpg",
  "pantry-preserves": "/stock/category-pantry-preserves.jpg",
  beverages: "/stock/category-beverages.jpg",
  "flowers-plants": "/stock/category-flowers-plants.jpg",
  "crafts-artisan-goods": "/stock/category-crafts-artisan-goods.jpg",
};

export function categoryPhoto(slug: string) {
  const path = CATEGORY_PHOTOS[slug];
  return path ? stockPhoto(path) : null;
}

/** Every stock file with its credit, for /credits. */
export function allStockCredits() {
  return (Object.keys(credits) as StockPath[]).map((path) => ({ path, ...stockPhoto(path) }));
}

/**
 * Generic market photographs, used on a market card when the market has no picture of its own.
 *
 * These are stock: none of them is a photograph of any market in the directory. That is a
 * deliberate exception to the rule that a stock photo never stands in for a named thing — see the
 * market-directory section of CLAUDE.md for the trade and `marketFallbackPhoto` for the picker.
 *
 * Every one was checked at FULL SIZE before it was added, and three candidates were thrown out at
 * that step, having looked fine as thumbnails: a chalkboard reading "Tanaka Farms" (cropped off
 * the top of `market-produce.jpg`, which is why that file is 1400x679 and not 1400x789), a price
 * tag reading "Courtland 99 lb", and a banner reading "Senter's Nursery". A real business's name
 * or a price on a card headed with a DIFFERENT market's name is the specific harm here, and it is
 * invisible in a preview thumbnail. Searches also return a lot of non-US markets — Hong Kong
 * price tags, Dutch crate stencils, Czech flower signs — which read wrong under an American
 * market's name. Anything added here gets the same full-size read.
 */
export const MARKET_FALLBACK_PHOTOS = [
  "/stock/market-produce.jpg",
  "/stock/market-greens.jpg",
  "/stock/market-tomatoes.jpg",
  "/stock/market-vegetables.jpg",
  "/stock/market-preserves.jpg",
  "/stock/market-bread.jpg",
  "/stock/market-pumpkins.jpg",
] as const satisfies readonly StockPath[];
