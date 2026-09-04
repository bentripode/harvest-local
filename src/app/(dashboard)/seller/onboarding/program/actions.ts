"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface ProgramChoiceState {
  error?: string;
  ok?: boolean;
}

/**
 * Record which cottage-food program the seller operates under.
 *
 * This is what turns both food gates from "is it possible anywhere in your state" into "does your
 * programme allow it". Written through the request client — RLS scopes it to the seller's own
 * storefront, and `seller_profiles_guard_food_program` refuses a program from another state.
 */
export async function chooseFoodProgramAction(
  _prev: ProgramChoiceState,
  formData: FormData,
): Promise<ProgramChoiceState> {
  const { user } = await requireRole("seller");

  const parsed = z
    .object({ programId: z.string().uuid("Choose a program.") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose a program." };

  const supabase = await createClient();
  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!seller) return { error: "Set up your storefront first." };

  const { error } = await supabase
    .from("seller_profiles")
    .update({ food_program_id: parsed.data.programId })
    .eq("id", seller.id);
  if (error) {
    console.error("[onboarding] food program choice failed:", error);
    return { error: "Could not save that choice." };
  }

  revalidatePath("/seller/onboarding/program");
  revalidatePath("/seller/compliance");
  revalidatePath("/seller/products");
  return { ok: true };
}
