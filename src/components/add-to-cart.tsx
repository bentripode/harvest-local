"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";
import { toCents, formatUsd } from "@/lib/money";
import { resolveSaleUnit, type VariantLike } from "@/lib/orders/sale-unit";

interface Props {
  seller: { sellerId: string; sellerSlug: string; sellerName: string };
  product: { id: string; title: string; price: string; quantityAvailable: number | null };
  /** Empty for a listing sold as one thing. */
  variants?: VariantLike[];
}

/**
 * Add to basket, with the option picker where the listing has one.
 *
 * The price and stock shown here come from `resolveSaleUnit`, the same resolver the server prices
 * with — so the number under the picker and the number on the order cannot disagree. It is still
 * only a display: `startCheckoutAction` re-resolves and re-prices from live rows (rule 3).
 */
export function AddToCart({ seller, product, variants = [] }: Props) {
  const active = variants.filter((v) => v.is_active);
  const [variantId, setVariantId] = useState<string>(active.length === 1 ? active[0].id : "");
  const [qty, setQty] = useState(1);

  const { addItem } = useCart();

  const resolved = resolveSaleUnit(
    { id: product.id, title: product.title, price: product.price, quantity_available: product.quantityAvailable },
    variants,
    variantId || null,
  );
  const unit = resolved.ok ? resolved.unit : null;

  const stock = unit?.stock ?? null;
  const max = stock ?? 99;
  const soldOut = active.length === 0 && variants.length > 0 ? true : stock != null && stock <= 0;

  function add() {
    if (!unit) return;
    const result = addItem(seller, {
      productId: unit.productId,
      variantId: unit.variantId,
      variantName: unit.variantName,
      title: unit.displayTitle,
      unitPrice: unit.unitPrice,
      quantity: qty,
    });
    if (result.replaced) {
      toast.info("Started a new basket", {
        description: "Your basket can only hold items from one seller at a time.",
      });
    } else {
      toast.success(`Added ${qty} × ${unit.displayTitle}`);
    }
    setQty(1);
  }

  if (soldOut) return <p className="text-muted-foreground text-sm">Sold out</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.length > 1 ? (
        <select
          value={variantId}
          onChange={(e) => {
            setVariantId(e.target.value);
            setQty(1);
          }}
          aria-label="Option"
          className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">Choose…</option>
          {active.map((v) => (
            <option key={v.id} value={v.id} disabled={v.quantity_available === 0}>
              {v.name} — {formatUsd(toCents(v.price))}
              {v.quantity_available === 0 ? " (sold out)" : ""}
            </option>
          ))}
        </select>
      ) : null}

      <div className="flex items-center rounded-md border">
        <button
          type="button"
          className="px-2 py-1 text-sm disabled:opacity-40"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          disabled={qty <= 1}
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="w-8 text-center text-sm tabular-nums">{qty}</span>
        <button
          type="button"
          className="px-2 py-1 text-sm disabled:opacity-40"
          onClick={() => setQty((q) => Math.min(max, q + 1))}
          disabled={qty >= max}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      <Button type="button" size="sm" onClick={add} disabled={!unit}>
        Add to basket
      </Button>
    </div>
  );
}
