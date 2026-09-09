import Image from "next/image";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductQuickView } from "@/components/product-quick-view";
import { describeCard, type CardProduct } from "@/lib/products/card";

/**
 * One product in a gallery.
 *
 * Everything it says comes from `describeCard`, so the gallery, the storefront and the quick view
 * cannot quote different prices for the same listing — which is exactly what happened before, when
 * `/shop` read `products.price` on listings that sell through options.
 *
 * The card is not a link wrapping the whole tile. A tile containing its own button can't be nested
 * in an anchor without producing invalid markup and a confusing tab order, and "open the detail"
 * and "go to the storefront" are genuinely two different intents. The title is the link; quick view
 * is the button.
 */
export function ProductCard({
  product,
  sellerSlug,
  footnote,
}: {
  product: CardProduct;
  sellerSlug: string;
  /** Distance, or anything else true of this card's context rather than of the product. */
  footnote?: string | null;
}) {
  const facts = describeCard(product);

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-2 pt-5">
        <Link
          href={`/s/${sellerSlug}`}
          className="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <div className="bg-muted relative aspect-video overflow-hidden rounded-md border">
            {product.images?.[0] ? (
              <Image
                src={product.images[0].url}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 33vw"
              />
            ) : null}
          </div>
        </Link>

        <div className="flex-1 space-y-1">
          <Link href={`/s/${sellerSlug}`} className="text-sm font-medium hover:underline">
            {product.title}
          </Link>

          <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
            <span>{facts.priceLabel}</span>
            {facts.netWeight ? (
              <span className="text-muted-foreground font-normal">{facts.netWeight}</span>
            ) : null}
            {footnote ? (
              <span className="text-muted-foreground font-normal">{footnote}</span>
            ) : null}
          </p>

          {/* A batch line is the proposition, so it gets a badge. A plain stock count is a detail. */}
          {facts.availability ? (
            facts.availabilityIsBatch || !facts.orderable ? (
              <Badge variant={facts.orderable ? "secondary" : "outline"} className="font-normal">
                {facts.availability}
              </Badge>
            ) : (
              <p className="text-muted-foreground text-xs">{facts.availability}</p>
            )
          ) : null}

          {/* Buyer-safety fact — it belongs on the shelf, not only in the detail. */}
          {facts.allergens ? (
            <p className="text-muted-foreground text-xs">
              <span className="font-medium">Contains:</span> {facts.allergens}
            </p>
          ) : null}
        </div>

        <div className="pt-1">
          <ProductQuickView productId={product.id} />
        </div>
      </CardContent>
    </Card>
  );
}

/** The shape `/shop` and the storefront both hand in. */
export type { CardProduct };
