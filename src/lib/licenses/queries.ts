import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { documentSpec, formatLast4 } from "@/lib/licenses/requirements";
import type { LicenseStatus, LicenseType } from "@/lib/db/types";

/**
 * The admin license-review queue. Uses the service-role client — callers MUST be behind
 * `requireRole("admin")` (the /admin layout is), same contract as `src/lib/admin/analytics.ts`.
 *
 * Service role rather than the request client on purpose: `seller_profiles` RLS is "public read
 * live" (`is_paused = false or profile_id = auth.uid()`), and a storefront paused for
 * `license_expired` is precisely the one an admin needs to see in this queue.
 */

export interface AdminLicense {
  id: string;
  sellerId: string;
  businessName: string;
  storefrontSlug: string;
  sellerIsPaused: boolean;
  sellerPauseReason: string | null;
  licenseType: LicenseType;
  /** Already masked when the type is sensitive (a tax ID) — safe to render as-is. */
  licenseNumber: string | null;
  /** Null for a tax ID, which has no issuing state we record. */
  issuingState: string | null;
  issuedDate: string | null;
  /** Null for a tax ID — an SSN or EIN does not expire. */
  expirationDate: string | null;
  hasDocument: boolean;
  status: LicenseStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/** Every license on file, pending first, then newest-submitted. */
export async function getLicenseQueue(): Promise<AdminLicense[]> {
  const admin = createAdminClient();

  const { data: licenses } = await admin
    .from("seller_licenses")
    .select(
      "id, seller_id, license_type, license_number, tax_id_last4, issuing_state, issued_date, expiration_date, document_path, verification_status, review_note, reviewed_at, created_at",
    )
    .order("created_at", { ascending: false });
  if (!licenses || licenses.length === 0) return [];

  const sellerIds = [...new Set(licenses.map((l) => l.seller_id))];
  const { data: sellers } = await admin
    .from("seller_profiles")
    .select("id, business_name, storefront_slug, is_paused, pause_reason")
    .in("id", sellerIds);
  const sellerById = new Map((sellers ?? []).map((s) => [s.id, s]));

  return licenses.map((l) => {
    const seller = sellerById.get(l.seller_id);
    return {
      id: l.id,
      sellerId: l.seller_id,
      businessName: seller?.business_name ?? "Unknown storefront",
      storefrontSlug: seller?.storefront_slug ?? "",
      sellerIsPaused: seller?.is_paused ?? false,
      sellerPauseReason: seller?.pause_reason ?? null,
      licenseType: l.license_type,
      // An SSN never reaches the browser in full — it isn't even readable from this query, since
      // `tax_id_encrypted` is revoked at the column level. The reviewer reads the real number off
      // the document and checks these 4 digits against it.
      licenseNumber: documentSpec(l.license_type)?.numberSensitive
        ? formatLast4(l.tax_id_last4)
        : l.license_number,
      issuingState: l.issuing_state,
      issuedDate: l.issued_date,
      expirationDate: l.expiration_date,
      // The path itself never leaves the server — the document is reached only through
      // `/admin/licenses/<id>/document`, which mints a short-lived signed URL.
      hasDocument: !!l.document_path,
      status: l.verification_status,
      reviewNote: l.review_note,
      reviewedAt: l.reviewed_at,
      createdAt: l.created_at,
    };
  });
}

/** How many licenses are waiting on a decision — drives the badge on the admin nav. */
export async function getPendingLicenseCount(): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("seller_licenses")
    .select("id", { count: "exact", head: true })
    .eq("verification_status", "pending");
  return count ?? 0;
}
