"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { toCents, toDecimalString } from "@/lib/money";
import { describeFoodSalesBlock } from "@/lib/compliance/food-sales";
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
  });
}


/**
 * The state gate, checked here so the seller reads a sentence rather than a constraint violation.
 * `products_guard_online_food_sales` enforces it regardless — this is the friendly half.
 */
async function foodSalesBlock(sellerId: string, categoryId: string): Promise<string | null> {
  return describeFoodSalesBlock(sellerId, categoryId);
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

  const blocked = await foodSalesBlock(sellerId, d.categoryId);
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

  const blocked = await foodSalesBlock(sellerId, d.categoryId);
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
    })
    .eq("id", productId.data)
    .eq("seller_id", sellerId); // defense in depth on top of RLS
  if (error) return { error: error.message };

  await syncTags(supabase, productId.data, d.tagIds);

  revalidatePath("/seller/products");
  redirect("/seller/products");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const { user } = await requireRole("seller");
  const productId = z.string().uuid().parse(formData.get("productId"));
  const sellerId = await getSellerId(user.id);
  const supabase = await createClient();

  await supabase.from("products").delete().eq("id", productId).eq("seller_id", sellerId);
  revalidatePath("/seller/products");
}

export async function setProductStatusAction(formData: FormData): Promise<void> {
  const { user } = await requireRole("seller");
  const productId = z.string().uuid().parse(formData.get("productId"));
  const status = z.enum(["draft", "active", "archived", "sold_out"]).parse(formData.get("status"));
  const sellerId = await getSellerId(user.id);
  const supabase = await createClient();

  await supabase
    .from("products")
    .update({ status })
    .eq("id", productId)
    .eq("seller_id", sellerId);
  revalidatePath("/seller/products");
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
