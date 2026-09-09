import "server-only";

import { addCents, cents, type Cents } from "@/lib/money";
import { resolveSaleUnit, SALE_UNIT_ERROR_COPY, type VariantLike } from "@/lib/orders/sale-unit";
import {
  describeDropGate,
  dropSnapshot,
  gateByDrops,
  unitsLeft,
  type DropLike,
} from "@/lib/orders/drops";
import type { Product } from "@/lib/db/types";

/**
 * Server-side re-pricing of a cart. The client sends only `{ productId, variantId?, quantity }` —
 * every price, and the subtotal, is computed HERE from live rows. Client-supplied money is never
 * trusted (CLAUDE.md rule 3).
 *
 * Which unit a line sells is resolved by `resolveSaleUnit`, so a product with variants and one
 * without go through the same code and there is still one answer to "what does this cost".
 */

export const MAX_LINE_QUANTITY = 99;

export interface CartRequestItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

/** A product row plus its variants and the resolved tax code / category for the item snapshot. */
export type PricableProduct = Pick<
  Product,
  "id" | "title" | "price" | "status" | "seller_id" | "quantity_available" | "tax_code"
> & {
  category_tax_code: string | null;
  category_name: string | null;
  variants: VariantLike[];
  /** Every batch for this listing. Empty for a listing that sells the ordinary open-ended way. */
  drops: DropLike[];
};

export interface PricedLine {
  productId: string;
  variantId: string | null;
  variantName: string | null;
  title: string;
  unitPrice: Cents;
  quantity: number;
  lineTotal: Cents;
  taxCode: string | null;
  categorySnapshot: string | null;
  /** The batch this line joins, and the collection date frozen onto the order item. */
  dropId: string | null;
  dropSnapshot: string | null;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotal: Cents;
}

export class CartError extends Error {
  constructor(
    message: string,
    readonly code:
      | "empty"
      | "unknown_product"
      | "wrong_seller"
      | "inactive"
      | "bad_quantity"
      | "insufficient_stock"
      | "variant"
      | "drop_closed",
  ) {
    super(message);
    this.name = "CartError";
  }
}

export function priceCart(
  requested: CartRequestItem[],
  products: PricableProduct[],
  sellerId: string,
  now: Date = new Date(),
): PricedCart {
  if (requested.length === 0) throw new CartError("Your basket is empty.", "empty");

  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: PricedLine[] = [];

  for (const item of requested) {
    const product = byId.get(item.productId);
    if (!product) {
      throw new CartError("A product in your basket is no longer available.", "unknown_product");
    }
    if (product.seller_id !== sellerId) {
      throw new CartError("Everything in one order must come from the same seller.", "wrong_seller");
    }
    if (product.status !== "active") {
      throw new CartError(`"${product.title}" is no longer for sale.`, "inactive");
    }

    // A listing with a batch sells only through it, and only while its window is open. Checked
    // before the price is resolved, so a closed batch is refused rather than quietly priced.
    const gate = gateByDrops(product.drops ?? [], now);
    if (gate.sellsByDrop && !gate.orderable) {
      const why = describeDropGate(gate, now);
      throw new CartError(
        `"${product.title}" isn't taking orders right now.${why ? ` ${why}` : ""}`,
        "drop_closed",
      );
    }

    const resolved = resolveSaleUnit(product, product.variants ?? [], item.variantId);
    if (!resolved.ok) {
      throw new CartError(
        `"${product.title}" ${SALE_UNIT_ERROR_COPY[resolved.error]}`,
        "variant",
      );
    }
    const unit = resolved.unit;

    const quantity = Math.floor(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      throw new CartError(`Choose a quantity between 1 and ${MAX_LINE_QUANTITY}.`, "bad_quantity");
    }
    if (unit.stock != null && quantity > unit.stock) {
      throw new CartError(
        `Only ${unit.stock} of "${unit.displayTitle}" left.`,
        "insufficient_stock",
      );
    }

    // The cap composes with the shelf rather than replacing it: whichever is smaller wins, because
    // both are real limits and the smaller one is the one that under-sells. This is advisory — the
    // binding refusal is `claim_drop_units` under its row lock, which is what settles a race.
    const drop = gate.orderable;
    if (drop && quantity > unitsLeft(drop)) {
      throw new CartError(`Only ${unitsLeft(drop)} left in "${drop.name}".`, "insufficient_stock");
    }

    lines.push({
      productId: unit.productId,
      variantId: unit.variantId,
      variantName: unit.variantName,
      title: unit.displayTitle,
      unitPrice: unit.unitPrice,
      quantity,
      lineTotal: cents(unit.unitPrice * quantity),
      taxCode: product.tax_code ?? product.category_tax_code,
      categorySnapshot: product.category_name,
      dropId: drop?.id ?? null,
      dropSnapshot: drop ? dropSnapshot(drop) : null,
    });
  }

  return { lines, subtotal: addCents(...lines.map((l) => l.lineTotal)) };
}
