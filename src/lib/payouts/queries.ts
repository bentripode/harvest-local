import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import type { PayoutLike } from "@/lib/payouts/format";

/**
 * Reading the payout ledger.
 *
 * Two different kinds of read, and the difference is the design:
 *
 *   - **The list** comes from our `payouts` mirror. We query it — filter by seller, sort, split into
 *     coming and settled — so it has to be local.
 *   - **What is INSIDE one payout** is read straight through to Stripe. We never query it, so
 *     copying it into a table would buy nothing and cost a second version of the truth that can
 *     drift. Mirror what you must query; ask for the rest.
 */

export interface SellerPayout extends PayoutLike {
  id: string;
}

export async function getSellerPayouts(sellerId: string, limit = 100): Promise<SellerPayout[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payouts")
    .select(
      "id, stripe_payout_id, amount, currency, status, arrival_date, stripe_created_at, failure_code, failure_message, method",
    )
    .eq("seller_id", sellerId)
    .order("arrival_date", { ascending: false, nullsFirst: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    stripePayoutId: row.stripe_payout_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    arrivalDate: row.arrival_date,
    stripeCreatedAt: row.stripe_created_at,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    method: row.method,
  }));
}

export interface PayoutLine {
  id: string;
  /** Stripe's own transaction type: "payment", "refund", "stripe_fee", "adjustment"… */
  type: string;
  /** Gross, as Stripe reports it. Decimal string. */
  amount: string;
  /** What Stripe took on this line. */
  fee: string;
  /** What reached the balance. `amount` minus `fee`, as computed BY STRIPE. */
  net: string;
  /** Stripe's description, shown when we can't match the line to an order of ours. */
  description: string | null;
  /** Our order, where the line could be matched to one. */
  order: { id: string; buyerState: string; createdAt: string } | null;
}

export type PayoutBreakdown =
  | { ok: true; lines: PayoutLine[]; truncated: boolean }
  | { ok: false; reason: "not_found" | "unavailable"; message: string };

const money = (minor: number) => (minor / 100).toFixed(2);

/**
 * What made up one payout, asked of Stripe directly.
 *
 * Authorization is ours: the payout is looked up in our mirror scoped to the caller's seller, and
 * the Stripe call is then made against THAT seller's connected account. A payout id belonging to
 * somebody else simply is not found, and no id from the caller ever reaches Stripe unchecked.
 *
 * Lines we can match to an order say so; lines we cannot show Stripe's own description rather than
 * a guess. A payout contains things that are not orders at all — refunds, adjustments, Stripe's
 * fees — and pretending otherwise is how a ledger stops adding up.
 */
export async function getPayoutBreakdown(
  sellerId: string,
  stripePayoutId: string,
): Promise<PayoutBreakdown> {
  const supabase = await createClient();

  const { data: payout } = await supabase
    .from("payouts")
    .select("stripe_payout_id, seller_id")
    .eq("stripe_payout_id", stripePayoutId)
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (!payout) {
    return { ok: false, reason: "not_found", message: "We couldn't find that payout." };
  }

  // The connected account id is read with the service role: `seller_profiles.stripe_account_id` is
  // not a column a seller session selects, and this is a trusted server path behind an ownership
  // check that has already passed.
  const { data: seller } = await createAdminClient()
    .from("seller_profiles")
    .select("stripe_account_id")
    .eq("id", sellerId)
    .maybeSingle();

  const account = seller?.stripe_account_id;
  if (!account) {
    return { ok: false, reason: "unavailable", message: "This storefront isn't connected to Stripe." };
  }

  let transactions;
  try {
    transactions = await stripe.balanceTransactions.list(
      { payout: stripePayoutId, limit: 100, expand: ["data.source"] },
      { stripeAccount: account },
    );
  } catch (err) {
    console.error("[payouts] balance transaction list failed", stripePayoutId, err);
    return {
      ok: false,
      reason: "unavailable",
      message: "Stripe couldn't give us the breakdown just now. Your Stripe dashboard has it.",
    };
  }

  // Match by payment intent, which is the id our orders carry. A charge's `payment_intent` is on the
  // expanded source; anything else (a refund, a fee, an adjustment) has no order by definition.
  const intents = new Map<string, string>();
  for (const t of transactions.data) {
    const source = t.source as { object?: string; payment_intent?: string | { id: string } } | null;
    if (source?.object === "charge" && source.payment_intent) {
      const pi = typeof source.payment_intent === "string" ? source.payment_intent : source.payment_intent.id;
      intents.set(t.id, pi);
    }
  }

  const orderByIntent = new Map<string, { id: string; buyerState: string; createdAt: string }>();
  if (intents.size > 0) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, stripe_payment_intent_id, buyer_state, created_at")
      .in("stripe_payment_intent_id", [...new Set(intents.values())]);

    for (const o of orders ?? []) {
      if (o.stripe_payment_intent_id) {
        orderByIntent.set(o.stripe_payment_intent_id, {
          id: o.id,
          buyerState: o.buyer_state,
          createdAt: o.created_at,
        });
      }
    }
  }

  const lines: PayoutLine[] = transactions.data
    // The payout's own line is the payout itself — including it would double-count the total.
    .filter((t) => t.type !== "payout")
    .map((t) => {
      const intent = intents.get(t.id);
      return {
        id: t.id,
        type: t.type,
        amount: money(t.amount),
        fee: money(t.fee),
        net: money(t.net),
        description: t.description,
        order: intent ? (orderByIntent.get(intent) ?? null) : null,
      };
    });

  return { ok: true, lines, truncated: transactions.has_more };
}
