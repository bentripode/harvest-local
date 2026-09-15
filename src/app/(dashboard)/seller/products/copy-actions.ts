"use server";

import { z } from "zod";

import { getSellerContext, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RATE_LIMITS, tryRateLimit } from "@/lib/rate-limit";
import { generateCopy, isAssistantConfigured, type GenerateResult } from "@/lib/ai/generate";
import { stateName } from "@/lib/geo/state";
import type { CopyKind, CopySource } from "@/lib/ai/prompt";

/**
 * Draft listing copy for a product the caller owns.
 *
 * This action reads and returns. It has **no write path to anything** — applying a draft is the
 * ordinary product form, submitted by the seller after they have read it. That separation is the
 * point: nothing a model writes reaches a buyer without a person putting it there.
 *
 * Rate-limited per seller, which is unusual for a read. Every other read here costs a database
 * round trip; this one costs money at a third party, and a form a seller can hold down is a bill.
 */

const schema = z.object({
  productId: z.string().uuid(),
  kind: z.enum(["description", "social"]),
});

export async function generateListingCopyAction(
  productId: string,
  kind: CopyKind,
): Promise<GenerateResult> {
  const { user } = await requireRole("seller");

  const parsed = schema.safeParse({ productId, kind });
  if (!parsed.success) {
    return { ok: false, reason: "failed", message: "Something went wrong reading the form." };
  }

  // Checked before the paid call rather than after, so a refusal costs nothing.
  if (!isAssistantConfigured()) {
    return {
      ok: false,
      reason: "not_configured",
      message:
        "The writing assistant isn't switched on for this site. Everything else on this page works as normal.",
    };
  }

  const limited = await tryRateLimit(
    `copy:${user.id}`,
    RATE_LIMITS.copyAssistant,
    "ask for a draft",
  );
  if (limited) return { ok: false, reason: "failed", message: limited };

  const { seller } = await getSellerContext();
  if (!seller) {
    return { ok: false, reason: "failed", message: "Finish setting up your storefront first." };
  }

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select(
      "id, title, description, ingredients, allergens, net_weight_value, net_weight_unit, handling_instructions, seller_id, category:categories!products_category_id_fkey(name)",
    )
    .eq("id", parsed.data.productId)
    .eq("seller_id", seller.id)
    .maybeSingle();

  if (!product) {
    return { ok: false, reason: "failed", message: "We couldn't find that listing." };
  }

  const category = product.category as { name: string } | null;

  const source: CopySource = {
    title: product.title,
    categoryName: category?.name ?? null,
    existingDescription: product.description,
    ingredients: (product.ingredients ?? []) as string[],
    allergens: product.allergens ?? [],
    netWeightValue: product.net_weight_value,
    netWeightUnit: product.net_weight_unit,
    handlingInstructions: product.handling_instructions,
    businessName: seller.business_name,
    stateName: stateName(seller.home_state),
    sellerBio: seller.bio,
  };

  return generateCopy(parsed.data.kind, source);
}
