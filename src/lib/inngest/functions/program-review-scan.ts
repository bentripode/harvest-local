import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueNotificationForEach } from "@/lib/notifications/queue";

/**
 * Flag state programs nobody has checked lately.
 *
 * These rows decide whether a seller may list food at all, what they may sell, and what their
 * label must say — and they were seeded from a public summary of the law, not the statutes. Laws
 * change: the source's Washington entry still describes mail delivery as "temporarily allowed
 * during the pandemic". Data that stale is worse than an obvious gap, because it looks settled.
 *
 * So once a week this counts what has never been verified and what was verified over a year ago,
 * and tells the admins. It changes nothing on its own — the fix is a human re-reading the state's
 * rules and saving the row.
 */

const REVIEW_INTERVAL_DAYS = 365;
const DAY_MS = 86_400_000;

export const programReviewScan = inngest.createFunction(
  {
    id: "program-review-scan",
    name: "State program review scan",
    triggers: [{ cron: "0 9 * * 1" }], // Monday morning, so it lands in a working week
  },
  async ({ step }) => {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - REVIEW_INTERVAL_DAYS * DAY_MS).toISOString();

    const stale = await step.run("find-stale-programs", async () => {
      const { data, error } = await admin
        .from("state_food_programs")
        .select("id, state_code, name, verified_at")
        .or(`verified_at.is.null,verified_at.lt.${cutoff}`);
      if (error) throw new Error(error.message);
      return data ?? [];
    });

    const neverVerified = stale.filter((p) => !p.verified_at).length;
    const overdue = stale.length - neverVerified;

    if (stale.length === 0) return { stale: 0, neverVerified: 0, overdue: 0, notified: 0 };

    const admins = await step.run("load-admins", async () => {
      const { data, error } = await admin.from("profiles").select("id").eq("role", "admin");
      if (error) throw new Error(error.message);
      return (data ?? []).map((a) => a.id);
    });

    if (admins.length === 0) {
      // Nothing to do but say so: a deployment with no admin has nobody to act on this.
      console.warn("[program-review-scan] no admins to notify;", stale.length, "programs stale");
      return { stale: stale.length, neverVerified, overdue, notified: 0 };
    }

    await step.run("notify-admins", () =>
      queueNotificationForEach(admin, admins, {
        template: "program_review_due",
        payload: {
          stale: stale.length,
          never_verified: neverVerified,
          overdue,
          states: [...new Set(stale.map((p) => p.state_code))].sort().join(", "),
        },
      }),
    );

    return { stale: stale.length, neverVerified, overdue, notified: admins.length };
  },
);
