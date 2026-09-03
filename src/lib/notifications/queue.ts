import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { inngest } from "@/lib/inngest/client";
import type { Database, Json } from "@/lib/db/types";

/**
 * Queue a notification for a user. Fans one template out to every channel (default: in-app + email)
 * as separate `notifications` rows, then nudges `notification-dispatch` for the non-in-app ones.
 * `in_app` rows are read straight from the DB by the compliance panel; the dispatcher ignores them.
 */

type Admin = SupabaseClient<Database>;

export type NotificationChannel = "in_app" | "email" | "sms";

export interface QueueNotificationInput {
  userId: string;
  template: string;
  payload: Json;
  channels?: NotificationChannel[];
  /** Treat a unique-index collision (e.g. the license-milestone dedupe) as a no-op, not an error. */
  tolerateDuplicate?: boolean;
}

const DEFAULT_CHANNELS: NotificationChannel[] = ["in_app", "email"];

export async function queueNotification(
  admin: Admin,
  input: QueueNotificationInput,
): Promise<boolean> {
  const channels = input.channels ?? DEFAULT_CHANNELS;

  const { error } = await admin.from("notifications").insert(
    channels.map((channel) => ({
      user_id: input.userId,
      channel,
      template: input.template,
      payload: input.payload,
    })),
  );

  if (error) {
    if (input.tolerateDuplicate && /duplicate key|unique constraint/i.test(error.message)) {
      return false;
    }
    throw new Error(error.message);
  }

  if (channels.some((c) => c !== "in_app")) {
    await inngest
      .send({ name: "harvest/notification.queued", data: {} })
      .catch((err) => console.error("[inngest] notification.queued send failed:", err));
  }

  return true;
}

/** Same template, many recipients (e.g. seller + admins). */
export async function queueNotificationForEach(
  admin: Admin,
  userIds: string[],
  input: Omit<QueueNotificationInput, "userId">,
): Promise<void> {
  for (const userId of [...new Set(userIds)]) {
    await queueNotification(admin, { ...input, userId });
  }
}
