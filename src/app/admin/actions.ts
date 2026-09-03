"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { cents, formatUsd, toDecimalString } from "@/lib/money";

export async function updateReportAction(formData: FormData): Promise<void> {
  const { user } = await requireRole("admin");

  const parsed = z
    .object({
      reportId: z.string().uuid(),
      status: z.enum(["open", "investigating", "resolved", "refunded"]),
      resolutionNote: z.string().trim().max(2000).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { reportId, status, resolutionNote } = parsed.data;

  const terminal = status === "resolved" || status === "refunded";
  const supabase = await createClient();
  await supabase
    .from("reports")
    .update({
      status,
      resolution_note: resolutionNote || null,
      resolved_by: terminal ? user.id : null,
      resolved_at: terminal ? new Date().toISOString() : null,
    })
    .eq("id", reportId);

  revalidatePath("/admin");
}

export interface RefundState {
  error?: string;
  ok?: boolean;
}

/**
 * Full refund of an order's destination charge. `reverse_transfer` pulls the money back from the
 * seller (merchant of record). Stripe processes it; the `charge.refunded` webhook unwinds the
 * order and notifies the parties — this action never touches order state (CLAUDE.md rule 2).
 */
export async function issueRefundAction(
  _prev: RefundState,
  formData: FormData,
): Promise<RefundState> {
  const { user } = await requireRole("admin");

  const parsed = z
    .object({
      orderId: z.string().uuid(),
      reportId: z.string().uuid().optional(),
      note: z.string().trim().max(2000).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  const { orderId, reportId, note } = parsed.data;

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, status, total, stripe_payment_intent_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { error: "Order not found." };
  if (!order.stripe_payment_intent_id) return { error: "This order has no captured payment." };

  const { data: existing } = await admin
    .from("refunds")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing) return { error: "This order has already been refunded." };

  let refund: { id: string; amount: number };
  try {
    const r = await stripe.refunds.create(
      { payment_intent: order.stripe_payment_intent_id, reverse_transfer: true },
      { idempotencyKey: `refund:${orderId}` },
    );
    refund = { id: r.id, amount: r.amount };
  } catch (err) {
    console.error("[admin] stripe.refunds.create failed:", err);
    return { error: err instanceof Error ? err.message : "Stripe refused the refund." };
  }

  await admin.from("refunds").upsert(
    {
      order_id: orderId,
      report_id: reportId ?? null,
      stripe_refund_id: refund.id,
      amount: toDecimalString(cents(refund.amount)),
      reason: note || null,
      initiated_by: user.id,
    },
    { onConflict: "order_id" },
  );

  if (reportId) {
    await admin
      .from("reports")
      .update({
        status: "refunded",
        resolution_note: note || `Refunded ${formatUsd(cents(refund.amount))}.`,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", reportId);
  }

  revalidatePath("/admin");
  return { ok: true };
}
