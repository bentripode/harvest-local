import { redirect } from "next/navigation";

import { ProductForm } from "@/components/product-form";
import { getSellerContext } from "@/lib/auth";
import { getCategories, getTags } from "@/lib/catalog";

export default async function NewProductPage() {
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const [categories, tags] = await Promise.all([getCategories(), getTags()]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
      <ProductForm sellerId={seller.id} categories={categories} tags={tags} />
    </div>
  );
}
