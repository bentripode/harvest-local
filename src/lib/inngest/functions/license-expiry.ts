import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueNotification } from "@/lib/notifications/queue";
import type { Json } from "@/lib/db/types";

type Admin = ReturnType<typeof createAdminClient>;

/** Reminder windows, ascending. A seller gets one in-app reminder per window it enters. */
const MILESTONES = [1, 7, 30] as const;

const DAY_MS = 86_400_000;

/**
 * Daily scan of *verified* seller licenses. Reminders at T-30 / T-7 / T-1 days (deduped by the
 * partial unique index on `notifications`); at expiry, `expire_seller_license` flips the license
 * to `expired` and pauses the storefront in SQL, and we queue the notice.
 */
export const licenseExpiryScan = inngest.createFunction(
  {
    id: "license-expiry-scan",
    name: "License expiry scan",
    triggers: [{ cron: "0 8 * * *" }],
  },
  async ({ step }) => {
    const admin = createAdminClient();

    const licenses = await step.run("load-verified-licenses", async () => {
      const { data, error } = await admin
        .from("seller_licenses")
        .select("id, seller_id, license_type, expiration_date")
        .eq("verification_status", "verified");
      if (error) throw new Error(error.message);
      return data ?? [];
    });

    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    let reminders = 0;
    let expired = 0;

    for (const lic of licenses) {
      const daysLeft = Math.round(
        (new Date(`${lic.expiration_date}T00:00:00Z`).getTime() - startOfToday.getTime()) / DAY_MS,
      );

      if (daysLeft <= 0) {
        const didExpire = await step.run(`expire-${lic.id}`, async () => {
          const { data, error } = await admin.rpc("expire_seller_license", { p_license_id: lic.id });
          if (error) throw new Error(error.message);
          return data === true;
        });
        if (didExpire) {
          expired++;
          await step.run(`notify-expired-${lic.id}`, () =>
            queue(admin, lic.seller_id, "license_expired", {
              license_id: lic.id,
              license_type: lic.license_type,
              expiration_date: lic.expiration_date,
            }),
          );
        }
        continue;
      }

      const milestone = MILESTONES.find((m) => daysLeft <= m);
      if (milestone == null) continue;

      const sent = await step.run(`remind-${lic.id}-${milestone}`, () =>
        queue(
          admin,
          lic.seller_id,
          "license_expiring",
          {
            license_id: lic.id,
            milestone: String(milestone),
            license_type: lic.license_type,
            expiration_date: lic.expiration_date,
            days_left: daysLeft,
          },
          true,
        ),
      );
      if (sent) reminders++;
    }

    return { scanned: licenses.length, reminders, expired };
  },
);

/** Queue one notification (in-app + email) for a seller. Returns false when it was a deduped no-op. */
async function queue(
  admin: Admin,
  sellerId: string,
  template: string,
  payload: Json,
  tolerateDuplicate = false,
): Promise<boolean> {
  const { data: seller } = await admin
    .from("seller_profiles")
    .select("profile_id")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller) return false;

  return queueNotification(admin, {
    userId: seller.profile_id,
    template,
    payload,
    tolerateDuplicate,
  });
}
