import "server-only";

import { addCents, cents, type Cents, toCents } from "@/lib/money";
import type { Product } from "@/lib/db/types";

/**
 * Server-side re-pricing of a cart. The client sends only `{ productId, quantity }` pairs — every
 * price, and the subtotal, is computed HERE from live product rows. Client-supplied money is never
 * trusted (CLAUDE.md rule 3).
 */

export const MAX_LINE_QUANTITY = 99;

export interface CartRequestItem {
  productId: string;
  quantity: number;
}

/** A product row plus the resolved tax code / category name for the order-item snapshot. */
export type PricableProduct = Pick<
  Product,
  "id" | "title" | "price" | "status" | "seller_id" | "quantity_available" | "tax_code"
> & {
  category_tax_code: string | null;
  category_name: string | null;
};

export interface PricedLine {
  productId: string;
  title: string;
  unitPrice: Cents;
  quantity: number;
  lineTotal: Cents;
  taxCode: string | null;
  categorySnapshot: string | null;
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
      | "insufficient_stock",
  ) {
    super(message);
    this.name = "CartError";
  }
}

export function priceCart(
  requested: CartRequestItem[],
  products: PricableProduct[],
  sellerId: string,
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

    const quantity = Math.floor(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      throw new CartError(`Choose a quantity between 1 and ${MAX_LINE_QUANTITY}.`, "bad_quantity");
    }
    if (product.quantity_available != null && quantity > product.quantity_available) {
      throw new CartError(
        `Only ${product.quantity_available} of "${product.title}" left.`,
        "insufficient_stock",
      );
    }

    const unitPrice = toCents(product.price);
    lines.push({
      productId: product.id,
      title: product.title,
      unitPrice,
      quantity,
      lineTotal: cents(unitPrice * quantity),
      taxCode: product.tax_code ?? product.category_tax_code,
      categorySnapshot: product.category_name,
    });
  }

  return { lines, subtotal: addCents(...lines.map((l) => l.lineTotal)) };
}
