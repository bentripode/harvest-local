"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { cents, formatUsd, toCents, toDecimalString } from "@/lib/money";

/** Flip the launch gate. `public` opens the marketplace to buyers; `sellers_only` is early access. */
export async function setAccessModeAction(formData: FormData): Promise<void> {
  const { user } = await requireRole("admin");
  const mode = z.enum(["sellers_only", "public"]).safeParse(formData.get("mode"));
  if (!mode.success) return;

  const supabase = await createClient();
  await supabase
    .from("platform_settings")
    .update({ value: { mode: mode.data }, updated_by: user.id })
    .eq("key", "access_mode");

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
}

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
 * Refund an order's destination charge — up to the amount not already refunded. Omit `amount` (or
 * pass the remaining balance) for a "refund the rest"; a smaller `amount` (dollars) is a further
 * partial. `reverse_transfer` pulls the money back from the seller (MoR) proportionally. Stripe
 * processes it; the `charge.refunded` webhook mirrors the refund, notifies the parties, and (once
 * the cumulative refund reaches the total) unwinds the order — this action never touches order
 * state (CLAUDE.md rule 2).
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
      amount: z.coerce.number().positive().optional(),
      note: z.string().trim().max(2000).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  const { orderId, reportId, amount, note } = parsed.data;

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, status, total, stripe_payment_intent_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { error: "Order not found." };
  if (!order.stripe_payment_intent_id) return { error: "This order has no captured payment." };

  const orderTotalCents = toCents(order.total);

  const { data: priorRows } = await admin
    .from("refunds")
    .select("amount")
    .eq("order_id", orderId);
  const alreadyCents = (priorRows ?? []).reduce((n, r) => n + toCents(r.amount), 0);
  const remainingCents = orderTotalCents - alreadyCents;
  if (remainingCents <= 0) return { error: "This order is already fully refunded." };

  let amountCents: number | undefined;
  if (amount != null) {
    amountCents = toCents(amount);
    if (amountCents <= 0) return { error: "Enter a refund amount." };
    if (amountCents > remainingCents) {
      return { error: `Only ${formatUsd(remainingCents)} is left to refund.` };
    }
  }
  const isRest = amountCents == null || amountCents >= remainingCents;

  let refund: { id: string; amount: number };
  try {
    const r = await stripe.refunds.create(
      {
        payment_intent: order.stripe_payment_intent_id,
        reverse_transfer: true,
        ...(isRest ? {} : { amount: amountCents }),
      },
      // Deterministic per cumulative-refunded position: dedupes a double-submit from the same page
      // state, advances once a refund is recorded.
      { idempotencyKey: `refund:${orderId}:${alreadyCents}` },
    );
    refund = { id: r.id, amount: r.amount };
  } catch (err) {
    console.error("[admin] stripe.refunds.create failed:", err);
    return { error: err instanceof Error ? err.message : "Stripe refused the refund." };
  }

  const nowFull = alreadyCents + refund.amount >= orderTotalCents;

  await admin.from("refunds").upsert(
    {
      order_id: orderId,
      report_id: reportId ?? null,
      stripe_refund_id: refund.id,
      amount: toDecimalString(cents(refund.amount)),
      reason: note || null,
      initiated_by: user.id,
    },
    { onConflict: "stripe_refund_id", ignoreDuplicates: true },
  );

  if (reportId) {
    const verb = nowFull ? "Refunded" : "Partially refunded";
    await admin
      .from("reports")
      .update({
        status: "refunded",
        resolution_note: note || `${verb} ${formatUsd(cents(refund.amount))}.`,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", reportId);
  }

  revalidatePath("/admin");
  return { ok: true };
}
