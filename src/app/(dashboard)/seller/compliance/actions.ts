"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { US_STATES } from "@/lib/geo/state";

export interface LicenseFormState {
  error?: string;
  ok?: boolean;
}

const schema = z.object({
  licenseType: z.enum(["cottage_food", "food_handler", "business_license", "id", "other"]),
  licenseNumber: z.string().max(120).optional().or(z.literal("")),
  issuingState: z.enum(US_STATES),
  issuedDate: z.string().optional().or(z.literal("")),
  expirationDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid expiry date."),
  documentPath: z.string().max(400).optional().or(z.literal("")),
});

async function sellerId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_profiles")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function addLicenseAction(
  _prev: LicenseFormState,
  formData: FormData,
): Promise<LicenseFormState> {
  const { user } = await requireRole("seller");

  const parsed = schema.safeParse({
    licenseType: formData.get("licenseType"),
    licenseNumber: formData.get("licenseNumber") ?? "",
    issuingState: formData.get("issuingState"),
    issuedDate: formData.get("issuedDate") ?? "",
    expirationDate: formData.get("expirationDate"),
    documentPath: formData.get("documentPath") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const id = await sellerId(user.id);
  if (!id) return { error: "Set up your storefront first." };

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("seller_licenses").insert({
    seller_id: id,
    license_type: d.licenseType,
    license_number: d.licenseNumber || null,
    issuing_state: d.issuingState,
    issued_date: d.issuedDate || null,
    expiration_date: d.expirationDate,
    document_path: d.documentPath || null,
    // verification_status stays 'pending' — an admin verifies it (Phase 5).
  });
  if (error) return { error: error.message };

  revalidatePath("/seller/compliance");
  return { ok: true };
}

export async function markNotificationsReadAction(): Promise<void> {
  await requireRole("seller");
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read");
  revalidatePath("/seller/compliance");
  revalidatePath("/seller", "layout");
}
