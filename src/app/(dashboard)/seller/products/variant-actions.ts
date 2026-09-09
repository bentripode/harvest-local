"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Managing the options a listing sells in.
 *
 * The whole set is submitted and replaced together rather than reconciled row by row. A partial
 * reconcile can leave a listing with a deleted option still buyable or a price half-applied, and
 * this is the money path — "all of it or none of it" is the property worth having.
 *
 * Writes run under the seller's own session: "variants: seller writes own" is the gate, so a seller
 * cannot touch another's rows even by guessing a product id.
 */

export interface VariantFormState {
  error?: string;
  ok?: boolean;
}

const NET_WEIGHT_UNITS = ["oz", "lb", "g", "kg", "fl_oz", "ml", "count"] as const;

const variantSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, "Every option needs a name.").max(60),
    price: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "Prices look like 12.50."),
    quantityAvailable: z.string().trim().optional(),
    netWeightValue: z.string().trim().optional(),
    netWeightUnit: z.enum(NET_WEIGHT_UNITS).optional().or(z.literal("")),
    sku: z.string().trim().max(60).optional(),
    isActive: z.boolean(),
  })
  // Same pairing rule the products table enforces: a number without a unit is not a net weight.
  .refine((v) => !v.netWeightValue || !!v.netWeightUnit, {
    message: "A net weight needs a unit.",
    path: ["netWeightUnit"],
  })
  .refine((v) => !v.netWeightUnit || !!v.netWeightValue, {
    message: "A unit needs a net weight.",
    path: ["netWeightValue"],
  });

const payloadSchema = z.object({
  productId: z.string().uuid(),
  variants: z.array(variantSchema).max(50),
});

export async function saveVariantsAction(
  _prev: VariantFormState,
  formData: FormData,
): Promise<VariantFormState> {
  const { user } = await requireRole("seller");

  const raw = formData.get("payload");
  if (typeof raw !== "string") return { error: "Something went wrong reading the form." };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { error: "Something went wrong reading the form." };
  }

  const parsed = payloadSchema.safeParse(parsedJson);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the options." };
  const { productId, variants } = parsed.data;

  const names = variants.map((v) => v.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) {
    return { error: "Two options have the same name." };
  }
  if (variants.length > 0 && !variants.some((v) => v.isActive)) {
    return { error: "At least one option has to be available to buy." };
  }

  const supabase = await createClient();

  // Ownership is RLS's job, but check it here too so a wrong id reads as "not found" rather than
  // as a silent no-op that looks like success.
  const { data: product } = await supabase
    .from("products")
    .select("id, seller:seller_profiles!inner(profile_id)")
    .eq("id", productId)
    .maybeSingle();
  const owner = (product?.seller as { profile_id: string } | null)?.profile_id;
  if (!product || owner !== user.id) return { error: "We couldn't find that product." };

  const { data: existing } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);
  const existingIds = new Set((existing ?? []).map((v) => v.id));
  const keptIds = new Set(variants.map((v) => v.id).filter(Boolean) as string[]);

  const rows = variants.map((v, i) => ({
    id: v.id,
    product_id: productId,
    name: v.name,
    price: v.price,
    quantity_available: v.quantityAvailable ? Number(v.quantityAvailable) : null,
    net_weight_value: v.netWeightValue || null,
    net_weight_unit: v.netWeightUnit || null,
    sku: v.sku || null,
    sort_order: i,
    is_active: v.isActive,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("product_variants")
      .upsert(rows, { onConflict: "id", defaultToNull: false });
    if (error) return { error: friendly(error.message) };
  }

  // Delete last: `product_variants_guard_last_active` refuses to remove the final buyable option
  // on a listed product, and the replacements are already in by this point.
  const removed = [...existingIds].filter((id) => !keptIds.has(id));
  if (removed.length > 0) {
    const { error } = await supabase.from("product_variants").delete().in("id", removed);
    if (error) return { error: friendly(error.message) };
  }

  revalidatePath(`/seller/products/${productId}`);
  revalidatePath("/seller/products");
  return { ok: true };
}

function friendly(message: string): string {
  if (/product_variants_name_ux/.test(message)) return "Two options have the same name.";
  if (/at least one variant/.test(message)) {
    return "A listed product needs at least one option buyers can choose. Unlist it first, or keep one available.";
  }
  return message;
}
