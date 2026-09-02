"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";
import { toCents } from "@/lib/money";

interface Props {
  seller: { sellerId: string; sellerSlug: string; sellerName: string };
  product: { id: string; title: string; price: string; quantityAvailable: number | null };
}

export function AddToCart({ seller, product }: Props) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);

  const max = product.quantityAvailable ?? 99;
  const soldOut = product.quantityAvailable != null && product.quantityAvailable <= 0;

  function add() {
    const result = addItem(seller, {
      productId: product.id,
      title: product.title,
      unitPrice: toCents(product.price),
      quantity: qty,
    });
    if (result.replaced) {
      toast.info("Started a new basket", {
        description: "Your basket can only hold items from one seller at a time.",
      });
    } else {
      toast.success(`Added ${qty} × ${product.title}`);
    }
    setQty(1);
  }

  if (soldOut) {
    return <p className="text-muted-foreground text-sm">Sold out</p>;
  }

  return (
    <div className="flex items-center gap-2">
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
      <Button type="button" size="sm" onClick={add}>
        Add to basket
      </Button>
    </div>
  );
}
