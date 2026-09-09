"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Open or close your own storefront.
 *
 * The decision itself belongs to `set_seller_vacation()`, which records the intent and then
 * re-derives `is_paused` through `sync_seller_license_pause()`. So this action cannot lift a
 * compliance pause however it is called: a seller ending a holiday with a lapsed licence stays
 * closed, for a different reason, and is told which.
 */

export interface VacationState {
  error?: string;
  reason?: string | null;
  ok?: boolean;
}

/** What a seller is told when they reopen and find they are still shut. */
const REASON_COPY: Record<string, string> = {
  license_unverified:
    "Your storefront is still closed: we don't have a verified document for every licence your state requires.",
  license_expired: "Your storefront is still closed: one of your licences has expired.",
  revenue_cap:
    "Your storefront is still closed: you've reached your programme's sales cap for the year. Only an admin can lift that.",
  onboarding_incomplete:
    "Your storefront is still closed: your payment setup or subscription isn't finished.",
  admin: "Your storefront is still closed by an administrator. Get in touch and we'll explain.",
};

export async function setVacationAction(
  _prev: VacationState,
  formData: FormData,
): Promise<VacationState> {
  const { user } = await requireRole("seller");

  const on = z.enum(["true", "false"]).safeParse(formData.get("on"));
  if (!on.success) return { error: "We couldn't change that." };

  const supabase = await createClient();
  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!seller) return { error: "Set up your storefront first." };

  const { data: reason, error } = await supabase.rpc("set_seller_vacation", {
    p_seller_id: seller.id,
    p_on: on.data === "true",
  });
  if (error) return { error: error.message };

  const effective = (reason as string | null) ?? null;

  revalidatePath("/seller/settings");
  revalidatePath("/seller");

  // Reopening but still shut for a reason of ours: say which, rather than leaving them to notice
  // the switch didn't take.
  if (on.data === "false" && effective && effective !== "vacation") {
    return { ok: true, reason: effective, error: REASON_COPY[effective] ?? undefined };
  }

  return { ok: true, reason: effective };
}
