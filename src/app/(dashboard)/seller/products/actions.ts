"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { toCents, toDecimalString } from "@/lib/money";
import { describeFoodSalesBlock } from "@/lib/compliance/food-sales";
import { describeCategoryBlock } from "@/lib/compliance/categories";
import {
  describeMissingLabelFields,
  isNetWeightUnit,
  missingLabelFields,
  parseAllergens,
  parseIngredients,
} from "@/lib/products/labeling";
import type { ProductImage } from "@/lib/db/types";

export interface ProductFormState {
  error?: string;
}

const imageSchema = z.object({
  path: z.string().min(1),
  url: z.string().url(),
  alt: z.string().optional(),
});

const productSchema = z.object({
  title: z.string().min(2, "Give the product a title.").max(140),
  description: z.string().max(4000).optional().or(z.literal("")),
  price: z
    .string()
    .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, "Enter a valid price."),
  categoryId: z.string().uuid("Choose a category."),
  subcategoryId: z.string().uuid().optional().or(z.literal("")),
  quantityAvailable: z
    .string()
    .optional()
    .refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 0), "Quantity must be a whole number."),
  status: z.enum(["draft", "active"]),
  tagIds: z.array(z.string().uuid()).default([]),
  images: z.array(imageSchema).default([]),
  // Label fields. Optional until the label generator can require them in exchange for something.
  ingredients: z.string().max(8000).optional().or(z.literal("")),
  netWeightValue: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || (Number.isFinite(Number(v)) && Number(v) > 0), "Enter a net weight above zero."),
  netWeightUnit: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isNetWeightUnit(v), "Choose a unit."),
  allergens: z.array(z.string()).default([]),
});

async function getSellerId(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_profiles")
    .select("id")
    .eq("profile_id", userId)
    .single();
  if (!data) redirect("/seller/onboarding");
  return data.id;
}

function parse(formData: FormData) {
  return productSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    price: formData.get("price"),
    categoryId: formData.get("categoryId"),
    subcategoryId: formData.get("subcategoryId") ?? "",
    quantityAvailable: formData.get("quantityAvailable") ?? "",
    status: formData.get("status"),
    tagIds: formData.getAll("tagIds").map(String),
    images: JSON.parse((formData.get("images") as string) || "[]"),
    ingredients: formData.get("ingredients") ?? "",
    netWeightValue: formData.get("netWeightValue") ?? "",
    netWeightUnit: formData.get("netWeightUnit") ?? "",
    allergens: formData.getAll("allergens").map(String),
  });
}


/** The three label fields, shaped the same way whichever action is writing them. */
function labelFields(d: {
  ingredients?: string;
  netWeightValue?: string;
  netWeightUnit?: string;
  allergens: string[];
}) {
  const hasWeight = !!d.netWeightValue && !!d.netWeightUnit;
  return {
    ingredients: parseIngredients(d.ingredients ?? ""),
    net_weight_value: hasWeight ? d.netWeightValue! : null,
    net_weight_unit: hasWeight ? d.netWeightUnit! : null,
    allergens: parseAllergens(d.allergens),
  };
}

/**
 * The label gate, checked here so the seller reads a sentence rather than a constraint violation.
 * `products_guard_label_fields` enforces it regardless — this is the friendly half.
 *
 * Food-ness comes from the catalogue, so it needs a read; a non-food listing short-circuits with no
 * requirement at all.
 */
async function labelFieldsBlock(d: {
  categoryId: string;
  subcategoryId?: string;
  status: string;
  ingredients?: string;
  netWeightValue?: string;
  netWeightUnit?: string;
}): Promise<string | null> {
  if (d.status === "draft") return null;

  const supabase = await createClient();
  const ids = [d.categoryId, d.subcategoryId].filter(Boolean) as string[];
  const { data: categories } = await supabase
    .from("categories")
    .select("requires_food_permit")
    .in("id", ids);

  return describeMissingLabelFields(
    missingLabelFields({
      isFoodCategory: (categories ?? []).some((c) => c.requires_food_permit),
      status: d.status,
      ingredients: parseIngredients(d.ingredients ?? ""),
      netWeightValue: d.netWeightValue,
      netWeightUnit: d.netWeightUnit,
    }),
  );
}

/**
 * The state gate, checked here so the seller reads a sentence rather than a constraint violation.
 * `products_guard_online_food_sales` enforces it regardless — this is the friendly half.
 */
async function foodSalesBlock(sellerId: string, categoryId: string): Promise<string | null> {
  // Two separate rules: whether the state permits online food sales at all, and whether it permits
  // this kind of food. Either can refuse, and they have different explanations.
  return (
    (await describeFoodSalesBlock(sellerId, categoryId)) ??
    (await describeCategoryBlock(sellerId, categoryId))
  );
}

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const { user } = await requireRole("seller");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const sellerId = await getSellerId(user.id);
  const d = parsed.data;

  const blocked = (await foodSalesBlock(sellerId, d.categoryId)) ?? (await labelFieldsBlock(d));
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      seller_id: sellerId,
      title: d.title,
      description: d.description || null,
      price: toDecimalString(toCents(d.price)),
      category_id: d.categoryId,
      subcategory_id: d.subcategoryId || null,
      quantity_available: d.quantityAvailable ? Number(d.quantityAvailable) : null,
      status: d.status,
      images: d.images as ProductImage[],
      ...labelFields(d),
    })
    .select("id")
    .single();
  if (error || !product) return { error: error?.message ?? "Could not create product." };

  await syncTags(supabase, product.id, d.tagIds);

  revalidatePath("/seller/products");
  redirect("/seller/products");
}

export async function updateProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const { user } = await requireRole("seller");
  const productId = z.string().uuid().safeParse(formData.get("productId"));
  if (!productId.success) return { error: "Missing product." };

  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const sellerId = await getSellerId(user.id);
  const d = parsed.data;

  const blocked = (await foodSalesBlock(sellerId, d.categoryId)) ?? (await labelFieldsBlock(d));
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      title: d.title,
      description: d.description || null,
      price: toDecimalString(toCents(d.price)),
      category_id: d.categoryId,
      subcategory_id: d.subcategoryId || null,
      quantity_available: d.quantityAvailable ? Number(d.quantityAvailable) : null,
      status: d.status,
      images: d.images as ProductImage[],
      ...labelFields(d),
    })
    .eq("id", productId.data)
    .eq("seller_id", sellerId); // defense in depth on top of RLS
  if (error) return { error: error.message };

  await syncTags(supabase, productId.data, d.tagIds);

  revalidatePath("/seller/products");
  redirect("/seller/products");
}

/**
 * Both list actions are plain `void` form actions with nowhere to render a returned error, so a
 * refusal used to be indistinguishable from success: the seller clicked, the page reloaded, and
 * nothing had changed. Now the reason rides back on `?error=` and the list renders it.
 */
function backToProducts(message?: string): never {
  revalidatePath("/seller/products");
  redirect(message ? `/seller/products?error=${encodeURIComponent(message)}` : "/seller/products");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const { user } = await requireRole("seller");
  const productId = z.string().uuid().parse(formData.get("productId"));
  const sellerId = await getSellerId(user.id);
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("seller_id", sellerId);

  // 23503: order_items.product_id is ON DELETE RESTRICT, on purpose — a sold product cannot be
  // deleted out from under the orders that cite it. Archiving is the disposition that exists.
  if (error?.code === "23503") {
    backToProducts(
      "This product has been ordered, so it can't be deleted — the orders that reference it would " +
        "lose what was bought. Set it to Archived instead: it comes off your storefront for good " +
        "and the order history stays intact.",
    );
  }
  if (error) backToProducts(error.message);
  backToProducts();
}

export async function setProductStatusAction(formData: FormData): Promise<void> {
  const { user } = await requireRole("seller");
  const productId = z.string().uuid().parse(formData.get("productId"));
  const status = z.enum(["draft", "active", "archived", "sold_out"]).parse(formData.get("status"));
  const sellerId = await getSellerId(user.id);
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({ status })
    .eq("id", productId)
    .eq("seller_id", sellerId);

  // Publishing from the list skips the form, so this is where the label guard is met. The trigger's
  // message is already written for the seller; the hint says what to do about it.
  if (error) backToProducts(error.hint ? `${error.message}. ${error.hint}` : error.message);
  backToProducts();
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

async function syncTags(supabase: ServerSupabase, productId: string, tagIds: string[]) {
  await supabase.from("product_tags").delete().eq("product_id", productId);
  if (tagIds.length > 0) {
    await supabase
      .from("product_tags")
      .insert(tagIds.map((tag_id) => ({ product_id: productId, tag_id })));
  }
}
