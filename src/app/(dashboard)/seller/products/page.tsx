import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getSellerContext } from "@/lib/auth";
import { formatUsd, toCents } from "@/lib/money";
import type { Product } from "@/lib/db/types";
import { deleteProductAction, setProductStatusAction } from "./actions";

export default async function ProductsPage() {
  const { profile, seller, onboardingComplete } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
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

      {!products?.length ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          No products yet.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {products.map((product) => (
            <ProductRow key={product.id} product={product as Product} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  const cover = product.images?.[0];
  return (
    <li className="flex items-center gap-4 p-4">
      <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-md border">
        {cover ? (
          <Image src={cover.url} alt="" fill className="object-cover" sizes="56px" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{product.title}</p>
        <p className="text-muted-foreground text-sm">
          {formatUsd(toCents(product.price))}
          {product.quantity_available != null ? ` · ${product.quantity_available} available` : ""}
        </p>
      </div>
      <Badge variant={product.status === "active" ? "default" : "secondary"}>{product.status}</Badge>
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/seller/products/${product.id}`}>Edit</Link>
        </Button>
        <form action={setProductStatusAction}>
          <input type="hidden" name="productId" value={product.id} />
          <input
            type="hidden"
            name="status"
            value={product.status === "active" ? "draft" : "active"}
          />
          <Button variant="ghost" size="sm" type="submit">
            {product.status === "active" ? "Unpublish" : "Publish"}
          </Button>
        </form>
        <form action={deleteProductAction}>
          <input type="hidden" name="productId" value={product.id} />
          <Button variant="ghost" size="sm" type="submit" className="text-destructive">
            Delete
          </Button>
        </form>
      </div>
    </li>
  );
}
