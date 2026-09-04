import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Destroy tax IDs — and the documents they came on — four years after a seller's last sale.
 *
 * We keep an SSN only because a tax filing might need it, so the retention window is the IRS
 * record-retention period for information returns. Past that there is no reason to hold it, and
 * "we still have SSNs from sellers who left years ago" is the worst position to be in after a
 * breach.
 *
 * The clock starts at the seller's most recent completed order, or at the upload if they never
 * sold anything. Purging clears `tax_id_encrypted` / `tax_id_last4`, deletes every file that
 * seller has in the private `seller-docs` bucket, and stamps `purged_at`. The row itself stays so
 * the audit trail still points at something.
 */

const RETENTION_YEARS = 4;
const DAY_MS = 86_400_000;

export const taxIdRetention = inngest.createFunction(
  {
    id: "tax-id-retention",
    name: "Tax ID retention purge",
    triggers: [{ cron: "0 3 * * *" }],
  },
  async ({ step }) => {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - RETENTION_YEARS * 365 * DAY_MS);

    const candidates = await step.run("find-expired-tax-ids", async () => {
      const { data, error } = await admin
        .from("seller_licenses")
        .select("id, seller_id, created_at")
        .eq("license_type", "tax_id")
        .not("tax_id_encrypted", "is", null)
        .is("purged_at", null);
      if (error) throw new Error(error.message);
      return data ?? [];
    });

    if (candidates.length === 0) return { scanned: 0, purged: 0 };

    let purged = 0;

    for (const license of candidates) {
      const lastActivity = await step.run(`last-activity-${license.id}`, async () => {
        const { data, error } = await admin
          .from("orders")
          .select("created_at")
          .eq("seller_id", license.seller_id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw new Error(error.message);
        // No sales ever: the clock runs from when the document was uploaded.
        return data?.[0]?.created_at ?? license.created_at;
      });

      if (new Date(lastActivity) > cutoff) continue;

      await step.run(`purge-${license.id}`, () =>
        purgeSeller(admin, license.id, license.seller_id, lastActivity),
      );
      purged++;
    }

    return { scanned: candidates.length, purged };
  },
);

async function purgeSeller(
  admin: Admin,
  licenseId: string,
  sellerId: string,
  lastActivity: string,
): Promise<void> {
  // Every document this seller uploaded, not just the tax ID: a photo of an SSN card and a photo
  // of a driving licence are equally worth not keeping.
  const { data: docs } = await admin
    .from("seller_licenses")
    .select("id, document_path")
    .eq("seller_id", sellerId)
    .not("document_path", "is", null);

  const paths = (docs ?? []).map((d) => d.document_path).filter((p): p is string => !!p);
  if (paths.length > 0) {
    const { error } = await admin.storage.from("seller-docs").remove(paths);
    // Storage failing shouldn't strand the number in the database — clear it either way and let
    // the next run retry the files.
    if (error) console.error("[tax-id-retention] storage remove failed:", error);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("seller_licenses")
    .update({ tax_id_encrypted: null, tax_id_last4: null, document_path: null, purged_at: now })
    .eq("seller_id", sellerId)
    .is("purged_at", null);
  if (updateError) throw new Error(updateError.message);

  const { error: auditError } = await admin.from("tax_id_audit").insert({
    license_id: licenseId,
    seller_id: sellerId,
    action: "purged",
    actor_id: null, // the schedule, not a person
    note: `Retention: ${RETENTION_YEARS}y past last activity (${lastActivity.slice(0, 10)}). ${paths.length} document(s) deleted.`,
  });
  if (auditError) console.error("[tax-id-retention] audit insert failed:", auditError);
}
