import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueNotification } from "@/lib/notifications/queue";
import {
  nextDue,
  reminderDue,
  type ObligationRule,
} from "@/lib/compliance/obligations";

/**
 * Daily scan of the recurring duties that are not documents.
 *
 * `license-expiry-scan` covers anything with an `expiration_date` on a licence row. This covers the
 * rest — Vermont's annual exemption filing and its annual training, Washington's biennial permit,
 * Utah's annual microenterprise permit — none of which has a document behind it, and none of which
 * anything in the app knew about.
 *
 * Reminders at 30, 10 and 1 days out. `seller_obligation_notices` records each one sent, so a
 * seller is told once rather than every morning for a month, and a scan that misses a day still
 * catches up rather than skipping a band silently.
 */
export const obligationReminders = inngest.createFunction(
  {
    id: "obligation-reminders",
    name: "Recurring obligation reminders",
    triggers: [{ cron: "30 8 * * *" }],
  },
  async ({ step }) => {
    const admin = createAdminClient();

    const work = await step.run("load-sellers-and-obligations", async () => {
      // Only sellers who have chosen a programme. Without a choice we do not know which of a
      // state's routes they are on — Utah runs three and Vermont four, with different duties — and
      // guessing would produce a deadline that is not theirs.
      const { data: sellers, error } = await admin
        .from("seller_profiles")
        .select("id, profile_id, home_state, food_program_id, created_at")
        .not("food_program_id", "is", null);
      if (error) throw new Error(error.message);
      if (!sellers?.length) return { sellers: [], obligations: [] };

      const programIds = [...new Set(sellers.map((s) => s.food_program_id))];
      const { data: obligations } = await admin
        .from("program_obligations")
        .select(
          "id, program_id, kind, label, detail, citation, source_url, schedule, due_month, due_day, interval_months",
        )
        .in("program_id", programIds as string[]);

      return { sellers, obligations: obligations ?? [] };
    });

    if (work.obligations.length === 0) return { checked: 0, sent: 0 };

    const today = new Date().toISOString().slice(0, 10);
    let sent = 0;
    let checked = 0;

    for (const seller of work.sellers) {
      const mine = work.obligations.filter((o) => o.program_id === seller.food_program_id);
      if (mine.length === 0) continue;

      for (const row of mine) {
        checked += 1;

        const rule: ObligationRule = {
          id: row.id,
          kind: row.kind,
          label: row.label,
          detail: row.detail,
          citation: row.citation,
          sourceUrl: row.source_url,
          schedule: row.schedule as ObligationRule["schedule"],
          dueMonth: row.due_month,
          dueDay: row.due_day,
          intervalMonths: row.interval_months,
        };

        const state = await step.run(`state-${seller.id}-${row.id}`, async () => {
          const [{ data: completions }, { data: notices }] = await Promise.all([
            admin
              .from("seller_obligation_completions")
              .select("period_key, completed_at")
              .eq("seller_id", seller.id)
              .eq("obligation_id", row.id)
              .order("completed_at", { ascending: false })
              .limit(1),
            admin
              .from("seller_obligation_notices")
              .select("period_key, days_out")
              .eq("seller_id", seller.id)
              .eq("obligation_id", row.id),
          ]);
          return { completions: completions ?? [], notices: notices ?? [] };
        });

        const lastCompleted = state.completions[0]?.completed_at?.slice(0, 10) ?? null;
        const occurrence = nextDue(
          rule,
          today,
          lastCompleted,
          seller.created_at.slice(0, 10),
        );
        if (!occurrence) continue;

        const alreadySent = state.notices
          .filter((n) => n.period_key === occurrence.periodKey)
          .map((n) => n.days_out);

        const band = reminderDue(occurrence.daysOut, alreadySent);
        if (!band) continue;

        await step.run(`notify-${seller.id}-${row.id}-${band}`, async () => {
          // Claim the reminder first. If the insert conflicts, a concurrent run already sent it and
          // this one must not send a duplicate.
          const { error: claimError } = await admin.from("seller_obligation_notices").insert({
            seller_id: seller.id,
            obligation_id: row.id,
            period_key: occurrence.periodKey,
            days_out: band,
          });
          if (claimError) return { sent: false };

          await queueNotification(admin, {
            userId: seller.profile_id,
            template: "obligation_due",
            payload: {
              seller_id: seller.id,
              state: seller.home_state,
              label: rule.label,
              detail: rule.detail,
              citation: rule.citation,
              source_url: rule.sourceUrl,
              due_date: occurrence.dueDate,
              days_out: occurrence.daysOut,
            },
          });
          return { sent: true };
        });
        sent += 1;
      }
    }

    return { checked, sent };
  },
);
