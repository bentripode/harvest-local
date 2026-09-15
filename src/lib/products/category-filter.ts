/**
 * Narrowing /shop to one top-level category (`?category=<slug>`). Pure, so the page and the tests
 * agree on what a link means.
 *
 * Only top-level categories are offered. `products.category_id` always holds one, so the filter is
 * a single equality; subcategories stay a detail of the listing rather than a second level of
 * navigation for a marketplace that is thin in most states.
 *
 * The filter narrows WHICH of the state's sellers are shown and never widens the set: the sellers
 * still come from `nearby_sellers(state)`, so rule 1's discovery layer is untouched by it.
 */

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
}

/** Top-level categories in display order (sort_order, then name, the order `getCategories` reads). */
export function topLevelCategories<T extends CategoryOption>(categories: T[]): T[] {
  return categories
    .filter((c) => c.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/**
 * The category a `?category=` value names, or null for none. An unknown or repeated value is null
 * rather than an error: an old link should still land on a useful page, and a page showing
 * everything is not claiming anything the heading doesn't also say.
 */
export function resolveCategory<T extends CategoryOption>(
  raw: string | string[] | undefined,
  topLevel: T[],
): T | null {
  if (typeof raw !== "string" || raw === "") return null;
  return topLevel.find((c) => c.slug === raw) ?? null;
}

/** A /shop link that keeps the other half of the page state. `list` and no category are defaults. */
export function shopHref({
  view,
  category,
}: {
  view: "list" | "map";
  category: string | null;
}): string {
  const params = new URLSearchParams();
  if (view === "map") params.set("view", "map");
  if (category) params.set("category", category);
  const qs = params.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

/** The empty-state sentence for a filter that matched nobody, in a state that does have sellers. */
export function emptyCategorySentence(categoryName: string, stateName: string): string {
  return `Nobody in ${stateName} is listing ${categoryName.toLowerCase()} right now.`;
}
