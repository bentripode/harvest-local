import { formatUsd, toCents, type Cents, type Money } from "@/lib/money";
import { formatAllergens, formatNetWeight } from "@/lib/products/labeling";
import { gateByDrops, describeDrop, describeDropGate, type DropLike } from "@/lib/orders/drops";
import type { VariantLike } from "@/lib/orders/sale-unit";

/**
 * What a product card says — one answer, shared by the marketplace gallery, the storefront and the
 * quick view.
 *
 * The reason this is a module and not three bits of JSX: `/shop` was rendering
 * `formatUsd(toCents(p.price))` on every card, including listings that sell through variants. That
 * column is not the one a seller with options has been maintaining — `resolveSaleUnit` says so in as
 * many words and never falls back to it — so the gallery was advertising a price the storefront
 * would then contradict. A buyer who clicks a $6.00 card and lands on a $9.00 listing has been
 * misled by us, not by the seller.
 *
 * Everything here is derived from the same rows the server prices from. It is still only a display:
 * `priceCart` re-resolves and re-prices at checkout (CLAUDE.md rule 3).
 */

export interface CardProduct {
  id: string;
  title: string;
  /** `products.price` — used ONLY when the listing has no variants. */
  price: Money;
  quantityAvailable: number | null;
  netWeightValue?: Money | null;
  netWeightUnit?: string | null;
  allergens?: string[] | null;
  images?: { url: string; alt?: string }[] | null;
  variants?: VariantLike[];
  drops?: DropLike[];
}

export interface CardFacts {
  /** "$8.50", or "from $6.00" where the buyer has a genuine choice of price. */
  priceLabel: string;
  /** The cheapest buyable price in cents, for sorting. Null when nothing is buyable. */
  fromCents: Cents | null;
  hasOptions: boolean;
  /** One line about what's left: a batch, a stock count, or nothing. */
  availability: string | null;
  /** True when the batch line is the availability — the card should lead with it. */
  availabilityIsBatch: boolean;
  soldOut: boolean;
  /** False when nothing can be added to a basket right now, for any reason. */
  orderable: boolean;
  netWeight: string | null;
  allergens: string | null;
}

/**
 * The stock behind a whole listing.
 *
 * With options, a card cannot know which one the buyer will pick, so it reports the total across the
 * buyable ones — and any single option with no limit makes the listing unlimited. Summing is the
 * only honest answer to "how many of this can I get"; showing one option's count would be a number
 * about something the buyer hasn't chosen yet.
 */
export function listingStock(product: CardProduct): number | null {
  const variants = product.variants ?? [];
  if (variants.length === 0) return product.quantityAvailable;

  const active = variants.filter((v) => v.is_active);
  if (active.length === 0) return 0;
  if (active.some((v) => v.quantity_available == null)) return null;
  return active.reduce((sum, v) => sum + (v.quantity_available ?? 0), 0);
}

export function describeCard(product: CardProduct, now: Date = new Date()): CardFacts {
  const variants = product.variants ?? [];
  const active = variants.filter((v) => v.is_active);
  const gate = gateByDrops(product.drops ?? [], now);

  // ---- price ------------------------------------------------------------
  // A listing with options prices from its options, never from `products.price`. "from" only when
  // the buyer actually has a choice to make — a single option is resolved for them, so quoting a
  // range there would invent an ambiguity that isn't on the page.
  const activePrices = active.map((v) => toCents(v.price));
  let fromCents: Cents | null;
  let priceLabel: string;

  if (variants.length === 0) {
    fromCents = toCents(product.price);
    priceLabel = formatUsd(fromCents);
  } else if (activePrices.length === 0) {
    fromCents = null;
    priceLabel = "Unavailable";
  } else {
    fromCents = Math.min(...activePrices) as Cents;
    const spread = Math.max(...activePrices) !== fromCents;
    priceLabel = spread ? `from ${formatUsd(fromCents)}` : formatUsd(fromCents);
  }

  // ---- what's left ------------------------------------------------------
  const stock = listingStock(product);
  const shelfSoldOut = stock != null && stock <= 0;

  let availability: string | null = null;
  let availabilityIsBatch = false;
  let orderable = !shelfSoldOut && fromCents != null;

  if (gate.sellsByDrop) {
    availabilityIsBatch = true;
    if (gate.orderable) {
      availability = describeDrop(gate.orderable, now);
    } else {
      // Sold out, not open yet, or between batches — `describeDropGate` says which.
      availability = describeDropGate(gate, now);
      orderable = false;
    }
  } else if (shelfSoldOut) {
    availability = "Sold out";
  } else if (stock != null) {
    availability = `${stock} available`;
  }

  return {
    priceLabel,
    fromCents,
    hasOptions: active.length > 1,
    availability,
    availabilityIsBatch,
    soldOut: !orderable,
    orderable,
    // No metric equivalent here. That is a LABEL requirement (CT, NC, TN) and it is carried by
    // `renderLabel` and the pre-sale disclosure, which are the surfaces those states legislate. On a
    // browse card "24 oz (680 g)" is a second number competing with the price for the same glance.
    netWeight: formatNetWeight(product.netWeightValue ?? null, product.netWeightUnit ?? null, {
      metric: false,
    }),
    allergens: formatAllergens(product.allergens ?? []) || null,
  };
}
