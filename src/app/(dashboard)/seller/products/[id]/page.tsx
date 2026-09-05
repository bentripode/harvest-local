import { notFound, redirect } from "next/navigation";

import { ProductForm, type ProductFormValues } from "@/components/product-form";
import { getCategoryPermissions } from "@/lib/compliance/categories";
import { ingredientsToText } from "@/lib/products/labeling";
import { createClient } from "@/lib/supabase/server";
import { getSellerContext } from "@/lib/auth";
import { getCategories, getTags } from "@/lib/catalog";
import type { Product } from "@/lib/db/types";

export default async function EditProductPage({ params }: PageProps<"/seller/products/[id]">) {
  const { id } = await params;
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const supabase = await createClient();
  const [{ data: product }, { data: productTags }, categories, tags, categoryPermissions] =
    await Promise.all([
    supabase.from("products").select("*").eq("id", id).eq("seller_id", seller.id).maybeSingle(),
    supabase.from("product_tags").select("tag_id").eq("product_id", id),
    getCategories(),
    getTags(),
    getCategoryPermissions(seller.id),
  ]);

  if (!product) notFound();
  const p = product as Product;

  const initial: ProductFormValues = {
    id: p.id,
    title: p.title,
    description: p.description ?? "",
    price: p.price.toString(),
    categoryId: p.category_id,
    subcategoryId: p.subcategory_id ?? "",
    quantityAvailable: p.quantity_available?.toString() ?? "",
    status: p.status === "active" ? "active" : "draft",
    tagIds: (productTags ?? []).map((t) => t.tag_id),
    images: p.images ?? [],
    ingredients: ingredientsToText(p.ingredients ?? []),
    netWeightValue: p.net_weight_value ?? "",
    netWeightUnit: p.net_weight_unit ?? "",
    allergens: p.allergens ?? [],
    allergensConfirmed: p.allergens_confirmed_at != null,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit product</h1>
      <ProductForm sellerId={seller.id} categories={categories} tags={tags} initial={initial}   categoryPermissions={categoryPermissions}
      />
    </div>
  );
}
