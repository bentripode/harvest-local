import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getSellerContext } from "@/lib/auth";
import { formatUsd, toCents } from "@/lib/money";
import type { Product } from "@/lib/db/types";
import { FoodSalesNotice } from "@/components/food-sales-notice";
import { getFoodSalesStatus } from "@/lib/compliance/food-sales";
import { DisclosureGapNotice } from "@/components/disclosure-gap-notice";
import { getProductDisclosures } from "@/lib/labels/disclosure";
import { deleteProductAction, setProductStatusAction } from "./actions";

export default async function ProductsPage({
  searchParams,
}: {
  // Next 16: searchParams is async.
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { profile, seller, onboardingComplete } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const supabase = await createClient();
  const [{ data: products }, foodSales, { data: foodCategories }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false }),
    getFoodSalesStatus(seller.id),
    supabase.from("categories").select("id").eq("requires_food_permit", true),
  ]);
  // Only food needs a label, so only food gets the button.
  const foodCategoryIds = new Set((foodCategories ?? []).map((c) => c.id));

  // What a buyer in a predisclosure state has to be shown before ordering, and whether we can show
  // it. Only live listings are disclosed, so only live listings can have a gap.
  const live = (products ?? []).filter((p) => p.status === "active" || p.status === "sold_out");
  const disclosures = await getProductDisclosures(live.map((p) => p.id));
  const titles = new Map(live.map((p) => [p.id, p.title]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl">Products</h1>
          <p className="text-muted-foreground text-sm">
            {onboardingComplete
              ? "Active products appear on your storefront."
              : "You can draft products now; they go live once onboarding is complete."}
          </p>
        </div>
        <Button asChild>
          <Link href="/seller/products/new">New product</Link>
        </Button>
      </div>

      <FoodSalesNotice status={foodSales} />

      <DisclosureGapNotice disclosures={disclosures} titles={titles} />

      {error ? (
        <p className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
          {error}
        </p>
      ) : null}

      {!products?.length ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          No products yet.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {products.map((product) => (
            <ProductRow
              key={product.id}
              product={product as Product}
              isFood={foodCategoryIds.has(product.category_id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One listing in the seller's catalogue.
 *
 * The row used to put a thumbnail, the title, the price, a status badge and FOUR controls — Edit,
 * Label, Publish/Unpublish and Delete — on a single non-wrapping flex line. Below about 900px the
 * title column collapsed to nothing and every button wrapped onto two lines of its own.
 *
 * Now it is a two-part block: the listing on top, its controls underneath. Delete is separated from
 * the rest and pushed to the far end, because it is the one action here with no undo and it was
 * sitting a thumb's width from "Unpublish".
 */
function ProductRow({ product, isFood }: { product: Product; isFood: boolean }) {
  const cover = product.images?.[0];
  const live = product.status === "active";

  return (
    <li className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-lg border">
          {cover ? (
            <Image src={cover.url} alt="" fill className="object-cover" sizes="56px" />
          ) : (
            <span
              aria-hidden
              className="text-muted-foreground/50 font-heading absolute inset-0 flex items-center justify-center text-xl"
            >
              {product.title.trim().charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{product.title}</p>
          <p className="text-muted-foreground text-sm tabular-nums">
            {formatUsd(toCents(product.price))}
            {product.quantity_available != null ? ` · ${product.quantity_available} available` : ""}
          </p>
        </div>
        <Badge variant={live ? "default" : "secondary"}>{product.status}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/seller/products/${product.id}`}>Edit</Link>
        </Button>
        {isFood ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/seller/products/${product.id}/label`}>Label</Link>
          </Button>
        ) : null}
        <form action={setProductStatusAction}>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="status" value={live ? "draft" : "active"} />
          <Button variant="ghost" size="sm" type="submit">
            {live ? "Unpublish" : "Publish"}
          </Button>
        </form>
        <form action={deleteProductAction} className="ml-auto">
          <input type="hidden" name="productId" value={product.id} />
          <Button variant="ghost" size="sm" type="submit" className="text-destructive">
            Delete
          </Button>
        </form>
      </div>
    </li>
  );
}
