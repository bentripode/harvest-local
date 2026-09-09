import Image from "next/image";

import { ProductQuickView } from "@/components/product-quick-view";
import { describeCard, type CardProduct } from "@/lib/products/card";

/**
 * One product in a gallery.
 *
 * A photo first, and the whole tile is the target. It used to be a bordered card holding a
 * 16:9 image, a title link, a price line, a stock badge, an allergen line and a "Quick view"
 * button — six stacked rows of chrome around one small picture, and on a phone a single card
 * filled most of the screen without showing much.
 *
 * Everything it says still comes from `describeCard`, so the gallery, the storefront and the quick
 * view cannot quote different prices for the same listing — which is exactly what happened before,
 * when `/shop` read `products.price` on listings that sell through options.
 *
 * The title is no longer a link to the storefront. One tile, one action: tapping opens the detail,
 * and the seller's name above the row is how you reach their storefront. Two competing targets
 * inside one small tile is what made the old card need a button of its own.
 */
export function ProductCard({
  product,
  footnote,
}: {
  product: CardProduct;
  /** Distance, or anything else true of this card's context rather than of the product. */
  footnote?: string | null;
}) {
  const facts = describeCard(product);
  const image = product.images?.[0];

  return (
    <ProductQuickView
      productId={product.id}
      className="group focus-visible:ring-ring block w-full rounded-xl text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <div className="bg-muted relative aspect-square overflow-hidden rounded-xl border">
        {image ? (
          <Image
            src={image.url}
            alt=""
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          // No uploader yet, so a missing photo is the common case rather than the exception. An
          // initial on a warm ground reads as deliberate; an empty grey box reads as broken.
          <span
            aria-hidden
            className="text-muted-foreground/50 font-heading absolute inset-0 flex items-center justify-center text-3xl"
          >
            {product.title.trim().charAt(0).toUpperCase()}
          </span>
        )}

        {/* Sold out, closed, or between batches — the one state worth interrupting the photo for. */}
        {!facts.orderable ? (
          <span className="bg-background/90 text-foreground absolute top-2 left-2 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium backdrop-blur-sm">
            {facts.availability ?? "Unavailable"}
          </span>
        ) : null}
      </div>

      <div className="px-0.5 pt-2">
        <p className="truncate text-sm font-medium">{product.title}</p>
        <p className="text-muted-foreground flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <span className="text-foreground tabular-nums">{facts.priceLabel}</span>
          {facts.netWeight ? <span>{facts.netWeight}</span> : null}
          {footnote ? <span>{footnote}</span> : null}
        </p>

        {/* A batch is the proposition — how many are left and when they're collected — so it stays
            on the tile where a plain stock count doesn't. */}
        {facts.orderable && facts.availabilityIsBatch && facts.availability ? (
          <p className="text-primary pt-0.5 text-xs font-medium">{facts.availability}</p>
        ) : null}

        {/* Buyer-safety fact. It belongs on the shelf, not only in the detail, so it survives the
            trim that took the rest of the card's text away. */}
        {facts.allergens ? (
          <p className="text-muted-foreground truncate pt-0.5 text-xs">
            Contains {facts.allergens}
          </p>
        ) : null}
      </div>
    </ProductQuickView>
  );
}

/** The shape `/shop` and the storefront both hand in. */
export type { CardProduct };
