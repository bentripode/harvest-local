import { notFound, redirect } from "next/navigation";

import { ProductForm, type ProductFormValues } from "@/components/product-form";
import { VariantsManager, type EditableVariant } from "@/components/variants-manager";
import { DropsManager } from "@/components/drops-manager";
import { DROP_SELECT, toDrops, type DropRow } from "@/lib/orders/drop-queries";
import { formatUsd, toCents } from "@/lib/money";
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
  const [
    { data: product },
    { data: productTags },
    { data: variants },
    { data: drops },
    categories,
    tags,
    categoryPermissions,
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).eq("seller_id", seller.id).maybeSingle(),
    supabase.from("product_tags").select("tag_id").eq("product_id", id),
    supabase
      .from("product_variants")
      .select("id, name, price, quantity_available, net_weight_value, net_weight_unit, sku, is_active")
      .eq("product_id", id)
      .order("sort_order"),
    supabase
      .from("product_drops")
      .select(DROP_SELECT)
      .eq("product_id", id)
      .order("closes_at", { ascending: false }),
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
    handlingInstructions: p.handling_instructions ?? "",
    allergens: p.allergens ?? [],
    allergensConfirmed: p.allergens_confirmed_at != null,
  };

  const editableVariants: EditableVariant[] = (variants ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    price: v.price.toString(),
    quantityAvailable: v.quantity_available?.toString() ?? "",
    netWeightValue: v.net_weight_value?.toString() ?? "",
    netWeightUnit: v.net_weight_unit ?? "",
    sku: v.sku ?? "",
    isActive: v.is_active,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit product</h1>
      <ProductForm sellerId={seller.id} categories={categories} tags={tags} initial={initial}   categoryPermissions={categoryPermissions}
      />

      <section className="rounded-lg border p-5">
        <VariantsManager
          productId={p.id}
          productPrice={formatUsd(toCents(p.price))}
          initial={editableVariants}
        />
      </section>

      <section className="rounded-lg border p-5">
        <DropsManager productId={p.id} drops={toDrops(drops as DropRow[] | null)} />
      </section>
    </div>
  );
}
