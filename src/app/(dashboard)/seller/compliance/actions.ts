"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { US_STATES } from "@/lib/geo/state";
import { documentSpec } from "@/lib/licenses/requirements";

export interface LicenseFormState {
  error?: string;
  ok?: boolean;
}

const schema = z.object({
  licenseType: z.enum([
    "cottage_food",
    "food_handler",
    "business_license",
    "id",
    "tax_id",
    "other",
  ]),
  licenseNumber: z.string().max(120).optional().or(z.literal("")),
  issuingState: z.enum(US_STATES).optional().or(z.literal("")),
  issuedDate: z.string().optional().or(z.literal("")),
  expirationDate: z.string().optional().or(z.literal("")),
  documentPath: z.string().max(400),
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

/**
 * Upload one seller document. The file itself is already in the private `seller-docs` bucket — the
 * browser puts it there under the seller's own folder (storage RLS) and posts the object key here.
 *
 * Requirements vary by type (`src/lib/licenses/requirements.ts`): a Tax ID has no expiry but must
 * carry its number, an ID and a permit need an expiry and issuing state. The DB holds the same
 * rules as CHECK constraints; this returns a readable message instead of a constraint violation.
 */
export async function addLicenseAction(
  _prev: LicenseFormState,
  formData: FormData,
): Promise<LicenseFormState> {
  const { user } = await requireRole("seller");

  const parsed = schema.safeParse({
    licenseType: formData.get("licenseType"),
    licenseNumber: formData.get("licenseNumber") ?? "",
    issuingState: formData.get("issuingState") ?? "",
    issuedDate: formData.get("issuedDate") ?? "",
    expirationDate: formData.get("expirationDate") ?? "",
    documentPath: formData.get("documentPath") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const d = parsed.data;
  const spec = documentSpec(d.licenseType);

  if (!d.documentPath) return { error: "Attach a photo or PDF of the document." };
  if (spec?.needsExpiry && !d.expirationDate) return { error: "Enter the document's expiry date." };
  if (d.expirationDate && Number.isNaN(Date.parse(d.expirationDate))) {
    return { error: "Enter a valid expiry date." };
  }
  if (spec?.needsState && !d.issuingState) return { error: "Choose the issuing state." };
  if (spec?.numberRequired && !d.licenseNumber) {
    return { error: `Enter your ${spec.numberLabel}.` };
  }

  const id = await sellerId(user.id);
  if (!id) return { error: "Set up your storefront first." };

  const supabase = await createClient();
  const { error } = await supabase.from("seller_licenses").insert({
    seller_id: id,
    license_type: d.licenseType,
    license_number: d.licenseNumber || null,
    // Null only for a tax ID; every other type validated one above.
    issuing_state: d.issuingState || null,
    issued_date: d.issuedDate || null,
    expiration_date: d.expirationDate || null,
    document_path: d.documentPath,
    // verification_status stays 'pending' — an admin verifies it at /admin/licenses.
  });
  if (error) return { error: error.message };

  // Re-uploading after a rejection shouldn't leave the storefront live on a stale verification, and
  // a first upload shouldn't wait for the admin to notice: keep the gate in step either way.
  // Service role because the gate writes `seller_profiles.is_paused`, which sellers may not touch.
  await createAdminClient()
    .rpc("sync_seller_license_pause", { p_seller_id: id })
    .then(({ error: syncError }) => {
      if (syncError) console.error("[compliance] sync_seller_license_pause failed:", syncError);
    });

  revalidatePath("/seller/compliance");
  revalidatePath("/seller", "layout");
  return { ok: true };
}

export async function markNotificationsReadAction(): Promise<void> {
  await requireRole("seller");
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read");
  revalidatePath("/seller/compliance");
  revalidatePath("/seller", "layout");
}
