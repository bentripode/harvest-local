import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueNotification, queueNotificationForEach } from "@/lib/notifications/queue";

/**
 * Act on a change to compliance reference data.
 *
 * `log_compliance_change` records what an admin altered; this works out who it lands on and does
 * something about it. Split that way on purpose: unpublishing inside the trigger would make one
 * admin's form submission synchronously rewrite other people's catalogues, inside their
 * transaction, with no notification path and no easy undo.
 *
 * Three severities, three behaviours:
 *
 *   `blocking`      an axis or online_orders moved TO banned. Live listings that now fail the
 *                   publish guards are moved to `draft` — the same thing the original migrations'
 *                   backfills did, and for the same reason: it stops the violation without
 *                   destroying the seller's work. Each affected seller is told which listing and
 *                   why.
 *   `unblocking`    one moved AWAY from banned. Nothing is republished — that is the seller's
 *                   decision about their own shop, not ours — but they are told, because nobody
 *                   watches a draft and Hawaii's sellers had no way to know their ban had been
 *                   lifted.
 *   `label`         the label rule changed. Listings stay up; sellers are told their labels are
 *                   stale, and the publish gate catches the rest on their next edit.
 *
 * `informational` changes (caps, thresholds, licence flags) are marked processed and nothing else:
 * they are real, but there is no listing to act on and the revenue milestones already cover the
 * ones that reach a seller.
 */
export const complianceChangeSweep = inngest.createFunction(
  {
    id: "compliance-change-sweep",
    name: "Compliance change sweep",
    retries: 3,
    triggers: [
      { event: "harvest/compliance.changed" },
      // Backstop: a migration writes log rows too, and nothing emits an event for those.
      { cron: "*/15 * * * *" },
    ],
  },
  async ({ step }) => {
    const admin = createAdminClient();

    const pending = await step.run("load-unprocessed", async () => {
      const { data, error } = await admin
        .from("compliance_change_log")
        .select("id, program_id, state_code, program_name, severity, changes")
        .is("processed_at", null)
        .order("changed_at")
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    });

    if (pending.length === 0) return { processed: 0, unpublished: 0, notified: 0 };

    let unpublished = 0;
    let notified = 0;

    for (const entry of pending) {
      const outcome = await step.run(`sweep-${entry.id}`, async () => {
        if (entry.severity === "informational") {
          return { unpublished: 0, sellersNotified: 0 };
        }

        const { data: impact } = await admin.rpc("compliance_change_impact", {
          p_program_id: entry.program_id,
        });
        const rows = impact ?? [];

        if (entry.severity === "blocking") {
          // Draft, never delete. The listing may become lawful again — this pass moved rows in both
          // directions — and a seller who loses their work to our data correction is owed better.
          const productIds = rows.map((r) => r.product_id);
          if (productIds.length > 0) {
            await admin.from("products").update({ status: "draft" }).in("id", productIds);
          }

          const bySeller = new Map<string, { profileId: string; titles: string[]; reason: string }>();
          for (const r of rows) {
            const seen = bySeller.get(r.seller_id);
            if (seen) seen.titles.push(r.product_title);
            else
              bySeller.set(r.seller_id, {
                profileId: r.profile_id,
                titles: [r.product_title],
                reason: r.reason,
              });
          }

          for (const [sellerId, info] of bySeller) {
            await queueNotification(admin, {
              userId: info.profileId,
              template: "compliance_rule_blocked_listings",
              payload: {
                seller_id: sellerId,
                state: entry.state_code,
                program_name: entry.program_name,
                reason: info.reason,
                titles: info.titles,
                count: info.titles.length,
              },
            });
          }
          return { unpublished: productIds.length, sellersNotified: bySeller.size };
        }

        // `unblocking` and `label` touch no listing. They go to every seller on the programme,
        // which is a different set from `impact` — the whole point of an unblocking notice is to
        // reach the seller whose listings are currently parked and therefore not "affected".
        const { data: sellers } = await admin
          .from("seller_profiles")
          .select("id, profile_id, food_program_id, home_state")
          .eq("home_state", entry.state_code);

        const recipients = (sellers ?? [])
          .filter((s) => s.food_program_id === entry.program_id || s.food_program_id === null)
          .map((s) => s.profile_id);

        if (recipients.length > 0) {
          await queueNotificationForEach(admin, recipients, {
            template:
              entry.severity === "unblocking"
                ? "compliance_rule_relaxed"
                : "compliance_label_changed",
            payload: {
              state: entry.state_code,
              program_name: entry.program_name,
              columns: (entry.changes as { column: string }[]).map((c) => c.column),
            },
          });
        }
        return { unpublished: 0, sellersNotified: new Set(recipients).size };
      });

      unpublished += outcome.unpublished;
      notified += outcome.sellersNotified;

      await step.run(`mark-${entry.id}`, async () => {
        await admin
          .from("compliance_change_log")
          .update({ processed_at: new Date().toISOString(), outcome })
          .eq("id", entry.id);
        return true;
      });
    }

    return { processed: pending.length, unpublished, notified };
  },
);
