import { toCents, type Cents, type Money } from "@/lib/money";

/**
 * What is actually being sold on one line — the single place a price and a stock level come from.
 *
 * A product either has variants or it doesn't (see 20260908260000). That is two shapes in the
 * database and it must not become two pricing paths in the code: CLAUDE.md rule 3 is about there
 * being one server-side answer to "what does this cost", and the way that rule dies is by having a
 * second branch that computes it slightly differently. So both shapes resolve HERE, once, and every
 * caller — the cart, the re-price, checkout, the storefront — reads the result.
 */

export interface VariantLike {
  id: string;
  name: string;
  price: Money;
  quantity_available: number | null;
  is_active: boolean;
  net_weight_value?: Money | null;
  net_weight_unit?: string | null;
}

export interface ProductLike {
  id: string;
  title: string;
  price: Money;
  quantity_available: number | null;
}

export interface SaleUnit {
  productId: string;
  /** Null for a product that sells without variants. */
  variantId: string | null;
  /** The variant's name, frozen onto the order item. Null when there is no variant. */
  variantName: string | null;
  /** What the buyer sees on the line: "Sourdough" or "Sourdough — Half loaf". */
  displayTitle: string;
  unitPrice: Cents;
  /** Null means unlimited. */
  stock: number | null;
}

export type SaleUnitError =
  | "no_variants_available"
  | "variant_not_found"
  | "variant_required";

/**
 * Resolve the sale unit for a product, given the variant the buyer chose (if any).
 *
 * Rules, in order:
 *   - no variants at all → the product itself is the unit, exactly as before variants existed;
 *   - variants exist → one must be chosen, and it must be an active one. A product that sells
 *     through variants never falls back to `products.price`, because that column is not what the
 *     seller has been maintaining.
 *
 * The single-variant convenience — resolving without an explicit choice when there is only one — is
 * deliberate: it lets a seller use a variant purely to carry a net weight without forcing a
 * pointless dropdown on the buyer.
 */
export function resolveSaleUnit(
  product: ProductLike,
  variants: VariantLike[],
  variantId?: string | null,
): { ok: true; unit: SaleUnit } | { ok: false; error: SaleUnitError } {
  const active = variants.filter((v) => v.is_active);

  if (variants.length === 0) {
    return {
      ok: true,
      unit: {
        productId: product.id,
        variantId: null,
        variantName: null,
        displayTitle: product.title,
        unitPrice: toCents(product.price),
        stock: product.quantity_available,
      },
    };
  }

  if (active.length === 0) return { ok: false, error: "no_variants_available" };

  let chosen: VariantLike | undefined;
  if (variantId) {
    chosen = active.find((v) => v.id === variantId);
    if (!chosen) return { ok: false, error: "variant_not_found" };
  } else if (active.length === 1) {
    chosen = active[0];
  } else {
    return { ok: false, error: "variant_required" };
  }

  return {
    ok: true,
    unit: {
      productId: product.id,
      variantId: chosen.id,
      variantName: chosen.name,
      displayTitle: `${product.title} — ${chosen.name}`,
      unitPrice: toCents(chosen.price),
      stock: chosen.quantity_available,
    },
  };
}

/** The cheapest active variant, for a "from $X" on a card. Null when there are none. */
export function lowestVariantPrice(variants: VariantLike[]): Cents | null {
  const prices = variants.filter((v) => v.is_active).map((v) => toCents(v.price));
  return prices.length > 0 ? (Math.min(...prices) as Cents) : null;
}

/** True when the buyer has a genuine choice to make before adding to a basket. */
export function needsVariantChoice(variants: VariantLike[]): boolean {
  return variants.filter((v) => v.is_active).length > 1;
}

export const SALE_UNIT_ERROR_COPY: Record<SaleUnitError, string> = {
  no_variants_available: "is sold out.",
  variant_not_found: "isn't available in that option.",
  variant_required: "needs an option choosing.",
};
