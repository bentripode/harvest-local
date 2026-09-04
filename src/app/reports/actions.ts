"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueNotificationForEach } from "@/lib/notifications/queue";
import { REPORT_REASONS } from "@/lib/reports/reasons";
import { RATE_LIMITS, tryRateLimit } from "@/lib/rate-limit";

export interface ReportFormState {
  error?: string;
  ok?: boolean;
}

const schema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum(Object.keys(REPORT_REASONS) as [string, ...string[]]),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function submitReportAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const { user } = await requireUser("/orders");

  const limited = await tryRateLimit(`report:${user.id}`, RATE_LIMITS.report, "file reports");
  if (limited) return { error: limited };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Pick a reason." };
  const { orderId, reason, description } = parsed.data;

  const supabase = await createClient();
  const { data: report, error } = await supabase
    .from("reports")
    .insert({ order_id: orderId, reporter_id: user.id, reason, description: description || null })
    .select("id")
    .single();

  if (error || !report) {
    if (/duplicate key|unique/i.test(error?.message ?? "")) {
      return { error: "You've already reported this order." };
    }
    if (/party to the order|unpaid order/i.test(error?.message ?? "")) {
      return { error: "You can't report this order." };
    }
    return { error: error?.message ?? "Could not file the report." };
  }

  // Notify admins (in-app + email). No admin accounts → no-op, like the other admin fan-outs.
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("seller:seller_profiles!orders_seller_id_fkey(business_name)")
    .eq("id", orderId)
    .maybeSingle();
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
  if (admins?.length) {
    await queueNotificationForEach(
      admin,
      admins.map((a) => a.id),
      {
        template: "report_filed",
        payload: {
          report_id: report.id,
          order_id: orderId,
          reason,
          business_name:
            (order?.seller as { business_name?: string } | null)?.business_name ?? "a seller",
        },
      },
    );
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/seller/orders/${orderId}`);
  return { ok: true };
}
