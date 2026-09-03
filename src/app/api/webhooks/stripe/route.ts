import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { env } from "@/lib/env";
import { cents, toDecimalString } from "@/lib/money";
import type { Json, SubscriptionStatus } from "@/lib/db/types";

/**
 * The ONLY place Stripe state is written into our database.
 *
 *  1. Verify the signature against STRIPE_WEBHOOK_SECRET (and the Connect secret if configured).
 *  2. Record the event id in `stripe_events`; a duplicate delivery is a no-op (idempotency).
 *  3. Apply the change with guarded upserts so re-processing is always safe.
 *
 * Never trust a browser redirect for any of this. See CLAUDE.md rule 2.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const secrets = [env.STRIPE_WEBHOOK_SECRET, env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (s): s is string => !!s,
  );

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret);
      break;
    } catch {
      // try the next secret
    }
  }
  if (!event) {
    return NextResponse.json({ error: "signature verification failed" }, { status: 400 });
  }

  const admin = createAdminClient();

  // --- idempotency gate -----------------------------------------------------
  const { error: insertError } = await admin.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    account_id: event.account ?? null,
    payload: event as unknown as Json,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      // Already in the ledger. If a prior delivery finished, this is a true duplicate — no-op.
      // If it was recorded but the handler then failed (no processed_at), let the retry re-run.
      const { data: prior } = await admin
        .from("stripe_events")
        .select("processed_at")
        .eq("id", event.id)
        .maybeSingle();
      if (prior?.processed_at) {
        return NextResponse.json({ received: true, duplicate: true });
      }
    } else {
      return NextResponse.json({ error: "ledger write failed" }, { status: 500 });
    }
  }

  try {
    switch (event.type) {
      case "account.updated":
        // v2 Accounts still emit the v1 `account.updated` snapshot event when their merchant /
        // recipient configuration changes; we use it purely as a trigger and read authoritative
        // capability status from the v2 account itself (see handleAccountUpdated).
        await handleAccountUpdated(admin, (event.data.object as Stripe.Account).id);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await handleSubscription(admin, event.data.object as Stripe.Subscription);
        break;

      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        // The buyer paid (or, for async methods, the payment cleared). This — never the
        // browser success redirect — is what moves an order from pending_payment to new.
        await handleCheckoutCompleted(admin, event.data.object as Stripe.Checkout.Session);
        break;

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        await handleCheckoutFailed(admin, event.data.object as Stripe.Checkout.Session);
        break;

      case "charge.refunded":
        await handleChargeRefunded(admin, event.data.object as Stripe.Charge);
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(admin, event.data.object as Stripe.Dispute);
        break;

      case "invoice.paid":
        await handleInvoicePaid(admin, event.data.object as Stripe.Invoice);
        break;

      default:
        // Acknowledged and recorded, no handler yet.
        break;
    }

    await admin
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq("id", event.id);

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "handler error";
    await admin.from("stripe_events").update({ error: message }).eq("id", event.id);
    // 500 => Stripe retries; the idempotency gate above lets the retry re-run cleanly.
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type Admin = ReturnType<typeof createAdminClient>;

function iso(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

async function handleAccountUpdated(admin: Admin, accountId: string) {
  const { data: seller } = await admin
    .from("seller_profiles")
    .select("id")
    .eq("stripe_account_id", accountId)
    .maybeSingle();
  if (!seller) return;

  // Accounts v2: derive state from the v2 configuration/capabilities, never the deprecated v1
  // `charges_enabled` / `payouts_enabled` / `details_submitted` fields.
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant", "configuration.recipient", "requirements"],
  });

  const merchantStatus =
    account.configuration?.merchant?.capabilities?.card_payments?.status ?? null;
  const transfersStatus =
    account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status ??
    null;
  const nothingCurrentlyDue = !(account.requirements?.entries ?? []).some(
    (e) =>
      e.minimum_deadline.status === "currently_due" || e.minimum_deadline.status === "past_due",
  );

  await admin
    .from("seller_profiles")
    .update({
      // MoR / can be charged on_behalf_of this seller.
      connect_charges_enabled: merchantStatus === "active",
      // Can receive destination-charge transfers from the platform.
      connect_payouts_enabled: transfersStatus === "active",
      // Seller has provided everything Stripe currently requires.
      connect_details_submitted: nothingCurrentlyDue,
    })
    .eq("id", seller.id);

  await reconcileActivation(admin, seller.id);
}

/**
 * Buyer checkout succeeded. All of the finalisation — status `pending_payment -> new`, money from
 * the Checkout Session (`tax_total` / `total` come from Stripe because Stripe Tax is the
 * server-side tax computation), the inventory decrement, and the pending referral for a promo
 * order — happens in ONE guarded, atomic SQL function. That makes a Stripe redelivery safe even
 * after a partially-completed prior attempt: it either no-ops or redoes the whole thing (rule 2).
 */
async function handleCheckoutCompleted(admin: Admin, session: Stripe.Checkout.Session) {
  if (session.payment_status === "unpaid") return; // async method — wait for async_payment_succeeded

  const orderId = session.client_reference_id ?? session.metadata?.order_id ?? null;
  if (!orderId) return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const { error } = await admin.rpc("finalize_paid_order", {
    p_order_id: orderId,
    p_payment_intent_id: paymentIntentId ?? "",
    p_discount_total: toDecimalString(cents(session.total_details?.amount_discount ?? 0)),
    p_tax_total: toDecimalString(cents(session.total_details?.amount_tax ?? 0)),
    p_total: toDecimalString(cents(session.amount_total ?? 0)),
  });
  if (error) throw new Error(`finalize_paid_order: ${error.message}`);
}

/** Checkout was abandoned (session expired) or an async payment failed — release the pending order. */
async function handleCheckoutFailed(admin: Admin, session: Stripe.Checkout.Session) {
  const orderId = session.client_reference_id ?? session.metadata?.order_id ?? null;
  if (!orderId) return;

  await admin
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .eq("status", "pending_payment");
}

/**
 * A paid order's charge was FULLY refunded (partial refunds don't unwind fulfilment) or a dispute
 * was opened. Move the order to a terminal state and — per ARCHITECTURE §3.4 — invalidate any
 * referral it earned: `referral-invalidate` decrements the seller's cycle and flags an admin if a
 * granted reward is now under threshold. Never revokes an already-issued reward coupon.
 * Requires the `charge.refunded` and `charge.dispute.created` events on the webhook endpoint.
 */
async function handleChargeRefunded(admin: Admin, charge: Stripe.Charge) {
  if (charge.amount_refunded < charge.amount) return; // partial refund — leave fulfilment alone
  await unwindOrderForCharge(admin, charge.payment_intent, "cancelled");
}

async function handleDisputeCreated(admin: Admin, dispute: Stripe.Dispute) {
  await unwindOrderForCharge(admin, dispute.payment_intent, "disputed");
}

async function unwindOrderForCharge(
  admin: Admin,
  paymentIntent: string | Stripe.PaymentIntent | null,
  toStatus: "cancelled" | "disputed",
) {
  const pi = typeof paymentIntent === "string" ? paymentIntent : (paymentIntent?.id ?? null);
  if (!pi) return;

  const { data: order } = await admin
    .from("orders")
    .select("id, seller_id, status, promo_code_id")
    .eq("stripe_payment_intent_id", pi)
    .maybeSingle();
  if (!order) return;

  // Guarded transition; on a redelivery the order is already terminal and this no-ops.
  if (order.status !== toStatus && order.status !== "cancelled") {
    await admin
      .from("orders")
      .update({ status: toStatus })
      .eq("id", order.id)
      .eq("status", order.status);
  }

  // Fire regardless of the transition result — invalidate_referral_for_order is idempotent, so a
  // redelivered refund event safely re-confirms an already-invalidated referral.
  if (order.promo_code_id) {
    await inngest
      .send({
        name: "harvest/order.refunded",
        data: { orderId: order.id, sellerId: order.seller_id },
      })
      .catch((err) => console.error("[inngest] harvest/order.refunded send failed:", err));
  }
}

async function handleSubscription(admin: Admin, sub: Stripe.Subscription) {
  let sellerId = sub.metadata?.seller_profile_id;

  if (!sellerId && typeof sub.customer === "string") {
    const customer = await stripe.customers.retrieve(sub.customer);
    if (!("deleted" in customer)) {
      sellerId = customer.metadata?.seller_profile_id;
    }
  }
  if (!sellerId) return;

  const item = sub.items?.data?.[0];
  const periodStart =
    item?.current_period_start ?? (sub as unknown as { current_period_start?: number }).current_period_start;
  const periodEnd =
    item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;

  const row = {
    seller_id: sellerId,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    stripe_price_id: item?.price?.id ?? null,
    status: sub.status as SubscriptionStatus,
    trial_start: iso(sub.trial_start),
    trial_end: iso(sub.trial_end),
    current_period_start: iso(periodStart),
    current_period_end: iso(periodEnd),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  await admin.from("subscriptions").upsert(row, { onConflict: "seller_id" });
  await reconcileActivation(admin, sellerId);

  // Referral cycle tracks the subscription period. Idempotent per (seller, period_start), so this
  // opens the first cycle and rotates it (count resets) whenever the billing period advances (§3.3).
  if (row.current_period_start && row.current_period_end) {
    await admin.rpc("open_referral_cycle", {
      p_seller_id: sellerId,
      p_period_start: row.current_period_start,
      p_period_end: row.current_period_end,
    });
  }
}

/** Belt-and-suspenders cycle reset (§3.3) — fires alongside the renewal `subscription.updated`. */
async function handleInvoicePaid(admin: Admin, invoice: Stripe.Invoice) {
  // The top-level `invoice.subscription` was removed in the API version this project pins; the id
  // now lives under the invoice's parent.
  const sub = invoice.parent?.subscription_details?.subscription ?? null;
  const subId = typeof sub === "string" ? sub : (sub?.id ?? null);
  if (!subId) return;

  const { data: subRow } = await admin
    .from("subscriptions")
    .select("seller_id, current_period_start, current_period_end")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  if (!subRow?.current_period_start || !subRow.current_period_end) return;

  await admin.rpc("open_referral_cycle", {
    p_seller_id: subRow.seller_id,
    p_period_start: subRow.current_period_start,
    p_period_end: subRow.current_period_end,
  });
}

/**
 * A storefront goes live only when Connect KYC is done AND a trialing/active subscription exists.
 * Idempotent: safe to call after any relevant webhook.
 */
async function reconcileActivation(admin: Admin, sellerId: string) {
  const { data: seller } = await admin
    .from("seller_profiles")
    .select("id, connect_charges_enabled, connect_details_submitted, is_paused, pause_reason")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller) return;

  // This function only manages the onboarding pause. A compliance pause
  // (revenue_cap / license_expired / admin) is lifted only by an admin or the yearly
  // revenue reset — never by a subscription webhook.
  if (seller.is_paused && seller.pause_reason && seller.pause_reason !== "onboarding_incomplete") {
    return;
  }

  const { data: sub } = await admin
    .from("subscriptions")
    .select("status")
    .eq("seller_id", sellerId)
    .maybeSingle();

  const subscriptionOk = !!sub && ["trialing", "active"].includes(sub.status);
  const connectOk = seller.connect_charges_enabled && seller.connect_details_submitted;
  const shouldBeLive = subscriptionOk && connectOk;

  await admin
    .from("seller_profiles")
    .update({
      is_paused: !shouldBeLive,
      pause_reason: shouldBeLive ? null : "onboarding_incomplete",
    })
    .eq("id", sellerId)
    // Extra guard against a race with a compliance pause landing between the read and the write.
    .or("pause_reason.is.null,pause_reason.eq.onboarding_incomplete");
}
