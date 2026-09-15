"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Scheduling a batch — "twenty loaves for Saturday, order by Thursday".
 *
 * Unlike variants, batches are NOT submitted and replaced as a set. A batch that has taken orders
 * is a promise to named people, and a replace-all reconcile would let a stray form submission
 * delete it. Each act is its own call: schedule one, change its cap, call it off.
 *
 * Writes run under the seller's own session — "drops: seller writes own" is the gate, and
 * `product_drops_guard_claims` freezes `units_claimed` even against the owner, so nothing here can
 * move the count. Only `claim_drop_units` / `release_drop_units*` do, through the service role.
 */

export interface DropFormState {
  error?: string;
  ok?: boolean;
}

const createSchema = z
  .object({
    productId: z.string().uuid(),
    name: z.string().trim().min(1, "Give the batch a name buyers will recognise.").max(80),
    // Instants, sent from the browser as ISO — the seller typed a wall-clock time in their own
    // zone and the client converted it. The server never guesses which clock they meant.
    opensAt: z.string().datetime({ offset: true }).optional().or(z.literal("")),
    closesAt: z.string().datetime({ offset: true }),
    fulfillmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a collection date."),
    pickupWindow: z.string().trim().max(120).optional(),
    pickupLocationId: z.string().uuid().optional().or(z.literal("")),
    unitCap: z.coerce
      .number()
      .int("How many can you make? A whole number.")
      .min(1, "A batch has to be at least one.")
      .max(10000),
  })
  .refine((v) => !v.opensAt || new Date(v.closesAt) > new Date(v.opensAt), {
    message: "Orders have to close after they open.",
    path: ["closesAt"],
  });

/** The seller_profile this seller owns, plus a check that the product is theirs. */
async function ownedProduct(productId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, seller_id, title, seller:seller_profiles!inner(profile_id)")
    .eq("id", productId)
    .maybeSingle();

  const owner = (data?.seller as { profile_id: string } | null)?.profile_id;
  if (!data || owner !== userId) return null;
  return { id: data.id, sellerId: data.seller_id, title: data.title };
}

export async function createDropAction(
  _prev: DropFormState,
  formData: FormData,
): Promise<DropFormState> {
  const { user } = await requireRole("seller");

  const parsed = createSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    opensAt: formData.get("opensAt") ?? "",
    closesAt: formData.get("closesAt"),
    fulfillmentDate: formData.get("fulfillmentDate"),
    pickupWindow: formData.get("pickupWindow") ?? undefined,
    pickupLocationId: formData.get("pickupLocationId") ?? "",
    unitCap: formData.get("unitCap"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the batch details." };
  }
  const d = parsed.data;

  const product = await ownedProduct(d.productId, user.id);
  if (!product) return { error: "We couldn't find that listing." };

  const supabase = await createClient();
  const { error } = await supabase.from("product_drops").insert({
    seller_id: product.sellerId,
    product_id: product.id,
    name: d.name,
    opens_at: d.opensAt || null,
    closes_at: d.closesAt,
    fulfillment_date: d.fulfillmentDate,
    pickup_window: d.pickupWindow || null,
    pickup_location_id: d.pickupLocationId || null,
    unit_cap: d.unitCap,
  });
  if (error) return { error: friendly(error.message) };

  revalidatePath(`/seller/products/${d.productId}`);
  revalidatePath("/seller/drops");
  return { ok: true };
}

const capSchema = z.object({
  dropId: z.string().uuid(),
  productId: z.string().uuid(),
  unitCap: z.coerce.number().int().min(1).max(10000),
});

/**
 * Change how many the batch is for.
 *
 * Raising it is the easy case — the seller decided to bake more. Lowering it below what buyers have
 * already ordered is refused by `product_drops_within_cap`, and that refusal is right: those orders
 * exist. The message says so rather than showing a constraint name.
 */
export async function setDropCapAction(
  _prev: DropFormState,
  formData: FormData,
): Promise<DropFormState> {
  const { user } = await requireRole("seller");

  const parsed = capSchema.safeParse({
    dropId: formData.get("dropId"),
    productId: formData.get("productId"),
    unitCap: formData.get("unitCap"),
  });
  if (!parsed.success) return { error: "How many are you making? A whole number." };

  const product = await ownedProduct(parsed.data.productId, user.id);
  if (!product) return { error: "We couldn't find that listing." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_drops")
    .update({ unit_cap: parsed.data.unitCap })
    .eq("id", parsed.data.dropId);
  if (error) return { error: friendly(error.message) };

  revalidatePath(`/seller/products/${parsed.data.productId}`);
  revalidatePath("/seller/drops");
  return { ok: true };
}

const cancelSchema = z.object({
  dropId: z.string().uuid(),
  productId: z.string().uuid(),
});

/**
 * Call a batch off.
 *
 * This stops NEW orders and nothing else. Orders already placed against it stay exactly where they
 * are — cancelling those is a separate, deliberate act on the orders board, because each one is
 * somebody expecting bread on Saturday and refunding them is not a side effect.
 */
export async function cancelDropAction(
  _prev: DropFormState,
  formData: FormData,
): Promise<DropFormState> {
  const { user } = await requireRole("seller");

  const parsed = cancelSchema.safeParse({
    dropId: formData.get("dropId"),
    productId: formData.get("productId"),
  });
  if (!parsed.success) return { error: "Something went wrong reading the form." };

  const product = await ownedProduct(parsed.data.productId, user.id);
  if (!product) return { error: "We couldn't find that listing." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_drops")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", parsed.data.dropId)
    .is("cancelled_at", null);
  if (error) return { error: friendly(error.message) };

  revalidatePath(`/seller/products/${parsed.data.productId}`);
  revalidatePath("/seller/drops");
  return { ok: true };
}

function friendly(message: string): string {
  if (/product_drops_no_overlap/.test(message)) {
    return "This listing already has a batch taking orders over those dates. Two overlapping batches leave no answer to which one an order belongs to.";
  }
  if (/product_drops_within_cap/.test(message)) {
    return "That's fewer than buyers have already ordered. You can raise the number, or cancel the orders you can't fill.";
  }
  if (/units_claimed is maintained by the platform/.test(message)) {
    return "The number claimed is counted from real orders and can't be edited.";
  }
  if (/product_drops_window/.test(message)) return "Orders have to close after they open.";
  return "We couldn't save that batch.";
}
