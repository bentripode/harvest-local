import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeKeyId, encryptionConfigured, rekeySecret } from "@/lib/crypto/secret-box";

/**
 * Move stored tax IDs onto the current encryption key.
 *
 * Rotating is: generate a key, add it to `TAX_ID_ENCRYPTION_KEYS` with a higher id than any
 * existing entry, deploy. From then on new uploads use it, and this job sweeps the rest — daily, or
 * immediately if you send `harvest/taxid.rekey.requested`. When it reports `remaining: 0` the old
 * key is no longer needed by anything and can be dropped from the list.
 *
 * Re-encryption means the plaintext is briefly in memory again, which is exactly the thing worth
 * recording, so every row rekeyed writes a `rekeyed` row to `tax_id_audit`.
 *
 * Rows are handled one at a time and each is committed as it goes: a failure halfway leaves the
 * rows already done on the new key and the rest on the old one, both of which still decrypt as long
 * as the old key stays in the list. That is the whole reason retiring a key is a separate,
 * deliberate step.
 */

const BATCH = 100;

export const taxIdRekey = inngest.createFunction(
  {
    id: "tax-id-rekey",
    name: "Tax ID re-encryption",
    triggers: [{ cron: "30 3 * * *" }, { event: "harvest/taxid.rekey.requested" }],
  },
  async ({ step }) => {
    if (!encryptionConfigured()) {
      // Nothing to do, and nothing alarming: a deployment with no key holds no tax IDs.
      return { skipped: "no encryption key configured" };
    }

    const active = activeKeyId();
    const admin = createAdminClient();

    const stale = await step.run("find-stale-rows", async () => {
      const { data, error } = await admin
        .from("seller_licenses")
        .select("id, seller_id, tax_id_encrypted, tax_id_key_id")
        .not("tax_id_encrypted", "is", null)
        .is("purged_at", null)
        .neq("tax_id_key_id", active)
        .limit(BATCH);
      if (error) throw new Error(error.message);
      return data ?? [];
    });

    if (stale.length === 0) return { activeKeyId: active, rekeyed: 0, remaining: 0 };

    let rekeyed = 0;
    let failed = 0;

    for (const row of stale) {
      if (!row.tax_id_encrypted) continue;

      try {
        await step.run(`rekey-${row.id}`, async () => {
          const next = rekeySecret(row.tax_id_encrypted!);
          // Already current — the column disagreed with the ciphertext. Fix the column.
          const update = next
            ? { tax_id_encrypted: next.ciphertext, tax_id_key_id: next.keyId }
            : { tax_id_key_id: active };

          const { error } = await admin
            .from("seller_licenses")
            .update(update)
            .eq("id", row.id)
            // Guard against a concurrent purge landing between the read and the write.
            .is("purged_at", null);
          if (error) throw new Error(error.message);

          if (next) {
            const { error: auditError } = await admin.from("tax_id_audit").insert({
              license_id: row.id,
              seller_id: row.seller_id,
              action: "rekeyed",
              actor_id: null, // the schedule, not a person
              note: `Re-encrypted from key ${row.tax_id_key_id ?? "unknown"} to key ${next.keyId}.`,
            });
            if (auditError) console.error("[tax-id-rekey] audit insert failed:", auditError);
          }
        });
        rekeyed++;
      } catch (err) {
        // One unreadable row (its key was retired too early) must not stall the rest.
        failed++;
        console.error(`[tax-id-rekey] row ${row.id} failed:`, err);
      }
    }

    const remaining = await step.run("count-remaining", async () => {
      const { count, error } = await admin
        .from("seller_licenses")
        .select("id", { count: "exact", head: true })
        .not("tax_id_encrypted", "is", null)
        .is("purged_at", null)
        .neq("tax_id_key_id", active);
      if (error) throw new Error(error.message);
      return count ?? 0;
    });

    return { activeKeyId: active, rekeyed, failed, remaining };
  },
);
