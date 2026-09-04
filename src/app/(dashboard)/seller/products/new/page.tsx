import { redirect } from "next/navigation";

import { ProductForm } from "@/components/product-form";
import { getCategoryPermissions } from "@/lib/compliance/categories";
import { getSellerContext } from "@/lib/auth";
import { getCategories, getTags } from "@/lib/catalog";

export default async function NewProductPage() {
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const [categories, tags, categoryPermissions] = await Promise.all([
    getCategories(),
    getTags(),
    getCategoryPermissions(seller.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
      <ProductForm
        sellerId={seller.id}
        categories={categories}
        tags={tags}
        categoryPermissions={categoryPermissions}
      />
    </div>
  );
}
