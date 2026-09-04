import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { activeKeyId, encryptionConfigured } from "@/lib/crypto/secret-box";

/**
 * Rotation progress for the tax-ID encryption key.
 *
 * Retiring an old key is only safe once nothing is still encrypted under it, and the point of
 * `seller_licenses.tax_id_key_id` is that this is countable without decrypting anything. Uses the
 * service-role client — callers MUST be behind `requireRole("admin")` (the /admin layout is), and
 * the column is not granted to client roles at all.
 */

export interface TaxIdKeyUsage {
  keyId: number | null;
  count: number;
  /** True for the key new uploads are written with. */
  active: boolean;
}

export interface TaxIdKeyStatus {
  configured: boolean;
  activeKeyId: number | null;
  usage: TaxIdKeyUsage[];
  /** Rows not yet on the active key — `tax-id-rekey` still has work to do. */
  stale: number;
  total: number;
}

export async function getTaxIdKeyStatus(): Promise<TaxIdKeyStatus> {
  const configured = encryptionConfigured();
  const active = configured ? activeKeyId() : null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("seller_licenses")
    .select("tax_id_key_id")
    .not("tax_id_encrypted", "is", null)
    .is("purged_at", null);

  const counts = new Map<number | null, number>();
  for (const row of data ?? []) {
    const id = row.tax_id_key_id ?? null;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const usage = [...counts.entries()]
    .map(([keyId, count]) => ({ keyId, count, active: keyId != null && keyId === active }))
    .sort((a, b) => (b.keyId ?? 0) - (a.keyId ?? 0));

  return {
    configured,
    activeKeyId: active,
    usage,
    stale: usage.filter((u) => !u.active).reduce((n, u) => n + u.count, 0),
    total: data?.length ?? 0,
  };
}
