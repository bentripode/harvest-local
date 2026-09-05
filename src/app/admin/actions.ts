"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { cents, formatUsd, toCents, toDecimalString } from "@/lib/money";
import { daysUntil } from "@/lib/compliance";
import { queueNotification } from "@/lib/notifications/queue";

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

export interface LicenseReviewState {
  error?: string;
  ok?: boolean;
}

/**
 * Verify or reject a seller's license document.
 *
 * `verification_status` and the review columns are platform-only at the data layer
 * (`seller_licenses_guard_status`), and `is_platform_context()` reads `current_user` — an admin
 * over PostgREST is `authenticated`, so the "licenses: admin all" RLS policy alone is not enough to
 * write them. This goes through the service-role client, which is allowed here because
 * `requireRole("admin")` runs first (CLAUDE.md: never on user-supplied ids *without* an explicit
 * authz check).
 *
 * Verifying is what puts a license in front of `license-expiry-scan`, which only scans
 * `verified` rows — so it is also what arms the T-30/7/1 reminders and the auto-pause at expiry.
 */
export async function reviewLicenseAction(
  _prev: LicenseReviewState,
  formData: FormData,
): Promise<LicenseReviewState> {
  const { user } = await requireRole("admin");

  const parsed = z
    .object({
      licenseId: z.string().uuid(),
      status: z.enum(["verified", "rejected"]),
      note: z.string().trim().max(2000).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  const { licenseId, status, note } = parsed.data;

  // A rejection the seller can't act on is worse than none — they only see this note.
  if (status === "rejected" && !note) {
    return { error: "Say why it was rejected — the seller sees this note." };
  }

  const admin = createAdminClient();

  const { data: license } = await admin
    .from("seller_licenses")
    .select("id, seller_id, license_type, expiration_date, document_path, verification_status")
    .eq("id", licenseId)
    .maybeSingle();
  if (!license) return { error: "License not found." };

  // Verifying a licence with nothing attached would record that an admin examined a document that
  // does not exist — and the storefront gate and label generator both trust that record. The DB
  // constraint is NOT VALID so rows predating it slip through; this is the guard that catches them.
  if (status === "verified" && !license.document_path) {
    return {
      error: "There's no document attached to this licence, so there's nothing to check. Ask the seller to upload one.",
    };
  }

  // Verifying an already-lapsed document would arm the expiry scan to immediately re-expire it and
  // pause the storefront. Reject it (or wait for the renewal) instead.
  if (status === "verified" && license.expiration_date && daysUntil(license.expiration_date) < 0) {
    return {
      error: `This document expired on ${license.expiration_date} — ask the seller to upload a current one.`,
    };
  }

  const { error } = await admin
    .from("seller_licenses")
    .update({
      verification_status: status,
      review_note: note || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", licenseId);
  if (error) {
    console.error("[admin] license review update failed:", error);
    return { error: "Could not save the decision." };
  }

  // The decision is the gate on the storefront: verifying lifts a license pause, and withdrawing a
  // verification re-applies one. The SQL function owns the precedence rules (it never lifts a
  // revenue_cap or admin pause) and hands back the resulting reason so the seller can be told.
  const { data: pauseReason, error: syncError } = await admin.rpc("sync_seller_license_pause", {
    p_seller_id: license.seller_id,
  });
  if (syncError) console.error("[admin] sync_seller_license_pause failed:", syncError);

  const { data: seller } = await admin
    .from("seller_profiles")
    .select("profile_id")
    .eq("id", license.seller_id)
    .maybeSingle();
  if (seller) {
    await queueNotification(admin, {
      userId: seller.profile_id,
      template: status === "verified" ? "license_verified" : "license_rejected",
      payload: {
        license_id: license.id,
        license_type: license.license_type,
        expiration_date: license.expiration_date,
        note: note || null,
        // Drives the "your storefront is live / is paused" half of the copy.
        storefront_paused: pauseReason != null,
      },
    }).catch((err) => console.error("[admin] license review notification failed:", err));
  }

  revalidatePath("/admin/licenses");
  revalidatePath("/seller/compliance");
  return { ok: true };
}

export interface StateRuleState {
  error?: string;
  ok?: boolean;
}

/**
 * Save one state's cottage-food rules.
 *
 * Saving **is** the verification act: it stamps `verified_at` / `verified_by`, so the admin is
 * asserting these are the state's real rules, not the seeded $50,000 placeholder. That matters
 * because `record_order_revenue` pauses a storefront the moment its yearly gross crosses this cap.
 *
 * Written through the request client — RLS ("cottage rules: admin write") is the gate, and there is
 * no guard trigger on this table, so there's no reason to reach for the service role.
 */
export async function saveStateRuleAction(
  _prev: StateRuleState,
  formData: FormData,
): Promise<StateRuleState> {
  const { user } = await requireRole("admin");

  const parsed = z
    .object({
      stateCode: z.string().length(2).regex(/^[A-Z]{2}$/),
      // Blank means "no cap in this state", which is a real answer — not the same as unverified.
      revenueCap: z
        .string()
        .trim()
        .max(20)
        .optional()
        .transform((v) => (v ? v : null)),
      requiresLicense: z.coerce.boolean().optional(),
      notes: z.string().trim().max(2000).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  const { stateCode, revenueCap, requiresLicense, notes } = parsed.data;

  let cap: string | null = null;
  if (revenueCap != null) {
    const n = Number(revenueCap);
    if (!Number.isFinite(n) || n < 0) return { error: "Enter a cap in dollars, or leave it blank." };
    cap = toDecimalString(cents(Math.round(n * 100)));
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("state_cottage_food_rules")
    .update({
      revenue_cap: cap,
      requires_license: !!requiresLicense,
      notes: notes || null,
      verified_at: new Date().toISOString(),
      verified_by: user.id,
      updated_by: user.id,
    })
    .eq("state_code", stateCode);
  if (error) {
    console.error("[admin] state rule save failed:", error);
    return { error: "Could not save this state." };
  }

  revalidatePath("/admin/states");
  revalidatePath("/seller/compliance");
  return { ok: true };
}
