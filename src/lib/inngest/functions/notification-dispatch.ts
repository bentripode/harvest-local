import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderEmail } from "@/lib/notifications/templates";
import { sendEmail } from "@/lib/notifications/send";

type Admin = ReturnType<typeof createAdminClient>;

const MAX_ATTEMPTS = 5;
const BATCH = 50;

interface QueueRow {
  id: string;
  user_id: string;
  channel: string;
  template: string;
  payload: unknown;
  attempt_count: number;
}

/**
 * Delivers `queued` notifications on real channels (email today; sms deferred). Runs on the
 * `harvest/notification.queued` nudge for immediacy and on a 2-minute cron as the backstop.
 *
 * Each row is claimed with an optimistic `attempt_count` bump so overlapping runs don't both
 * process it; the Resend send is also keyed on the row id, so a re-send after a mid-run crash is
 * deduped downstream too. A row that keeps failing is abandoned (`status = 'failed'`) past
 * MAX_ATTEMPTS with the last error recorded.
 */
export const notificationDispatch = inngest.createFunction(
  {
    id: "notification-dispatch",
    name: "Notification dispatch",
    concurrency: { limit: 1 },
    triggers: [{ event: "harvest/notification.queued" }, { cron: "*/2 * * * *" }],
  },
  async ({ step }) => {
    const admin = createAdminClient();

    const rows = await step.run("load-queue", async () => {
      const { data, error } = await admin
        .from("notifications")
        .select("id, user_id, channel, template, payload, attempt_count")
        .eq("status", "queued")
        .neq("channel", "in_app")
        .lt("attempt_count", MAX_ATTEMPTS)
        .order("created_at", { ascending: true })
        .limit(BATCH);
      if (error) throw new Error(error.message);
      return (data ?? []) as QueueRow[];
    });

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      const outcome = await step.run(`deliver-${row.id}`, () => deliverRow(admin, row));
      if (outcome === "sent") sent++;
      else if (outcome === "failed") failed++;
    }

    return { considered: rows.length, sent, failed };
  },
);

async function deliverRow(admin: Admin, row: QueueRow): Promise<"sent" | "failed" | "retry" | "skipped"> {
  // Optimistic claim: only the run that moves attempt_count from N to N+1 owns this attempt.
  const { data: claimed } = await admin
    .from("notifications")
    .update({ attempt_count: row.attempt_count + 1 })
    .eq("id", row.id)
    .eq("status", "queued")
    .eq("attempt_count", row.attempt_count)
    .select("id");
  if (!claimed || claimed.length === 0) return "skipped";

  const attempt = row.attempt_count + 1;

  try {
    await deliver(admin, row);
    await admin
      .from("notifications")
      .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
      .eq("id", row.id);
    return "sent";
  } catch (err) {
    const message = err instanceof Error ? err.message : "delivery error";
    const dead = attempt >= MAX_ATTEMPTS;
    await admin
      .from("notifications")
      .update({ status: dead ? "failed" : "queued", error: message })
      .eq("id", row.id);
    return dead ? "failed" : "retry";
  }
}

async function deliver(admin: Admin, row: QueueRow): Promise<void> {
  const payload = (row.payload ?? {}) as Record<string, unknown>;

  if (row.channel === "email") {
    const { data, error } = await admin.auth.admin.getUserById(row.user_id);
    if (error) throw new Error(error.message);
    const to = data.user?.email;
    if (!to) throw new Error("recipient has no email address");

    const email = renderEmail(row.template, payload);
    if (!email) throw new Error(`no email template for "${row.template}"`);

    await sendEmail({ to, idempotencyKey: row.id, ...email });
    return;
  }

  if (row.channel === "sms") {
    throw new Error("sms delivery is not configured yet");
  }

  throw new Error(`unknown notification channel "${row.channel}"`);
}
