"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { promoCodeSchema } from "@/lib/referrals/codes";

export interface PromoCodeFormState {
  error?: string;
  ok?: boolean;
}

async function sellerId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_profiles")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function createPromoCodeAction(
  _prev: PromoCodeFormState,
  formData: FormData,
): Promise<PromoCodeFormState> {
  const { user } = await requireRole("seller");

  const parsed = promoCodeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid code." };

  const id = await sellerId(user.id);
  if (!id) return { error: "Set up your storefront first." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("promo_codes")
    .insert({ seller_id: id, code: parsed.data });

  if (error) {
    return {
      error: /duplicate key|unique/i.test(error.message)
        ? "That code is already taken."
        : error.message,
    };
  }

  revalidatePath("/seller/referrals");
  return { ok: true };
}

export async function togglePromoCodeAction(formData: FormData): Promise<void> {
  const { user } = await requireRole("seller");
  const parsed = z
    .object({ id: z.string().uuid(), active: z.enum(["true", "false"]) })
    .safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return;

  const id = await sellerId(user.id);
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("promo_codes")
    .update({ is_active: parsed.data.active === "true" })
    .eq("id", parsed.data.id)
    .eq("seller_id", id);

  revalidatePath("/seller/referrals");
}
