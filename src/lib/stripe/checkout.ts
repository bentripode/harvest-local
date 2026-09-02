import "server-only";

import type Stripe from "stripe";

import type { PricedLine } from "@/lib/orders/pricing";

/**
 * Pure builder for the buyer checkout — a Stripe-hosted Checkout Session that creates a
 * **destination charge** with the connected seller account as **merchant of record**:
 *
 *   - `payment_intent_data.transfer_data.destination` → funds flow platform → seller
 *   - `payment_intent_data.on_behalf_of`             → seller is the settlement merchant, so
 *   - `automatic_tax.liability = { type: 'account' }` → Stripe Tax settles against the seller's
 *                                                       registrations (cottage-food law)
 *
 * No `application_fee_amount` — platform revenue is the seller subscription. Add it here later
 * if that changes. See ARCHITECTURE.md §1.5 and docs.stripe.com/connect/destination-charges.
 */

const ALPHA = "abcdefghijklmnopqrstuvwxyz";

function integrationSuffix(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

export interface CheckoutSessionInput {
  orderId: string;
  lines: PricedLine[];
  sellerAccountId: string;
  siteUrl: string;
  customerEmail?: string;
}

export function buildCheckoutSessionParams(
  input: CheckoutSessionInput,
): Stripe.Checkout.SessionCreateParams {
  const { orderId, lines, sellerAccountId, siteUrl, customerEmail } = input;

  return {
    mode: "payment",
    line_items: lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: "usd",
        unit_amount: line.unitPrice,
        tax_behavior: "exclusive",
        product_data: {
          name: line.title,
          ...(line.taxCode ? { tax_code: line.taxCode } : {}),
          metadata: { product_id: line.productId },
        },
      },
    })),
    payment_intent_data: {
      on_behalf_of: sellerAccountId,
      transfer_data: { destination: sellerAccountId },
      metadata: { order_id: orderId },
    },
    automatic_tax: {
      enabled: true,
      liability: { type: "account", account: sellerAccountId },
    },
    customer_creation: "if_required",
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    client_reference_id: orderId,
    metadata: { order_id: orderId },
    integration_identifier: `harvest-checkout-${integrationSuffix()}`,
    // Stripe requires ≥ 30 min in the future; give buyers an hour.
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    success_url: `${siteUrl}/orders/${orderId}?checkout=success`,
    cancel_url: `${siteUrl}/orders/${orderId}?checkout=cancelled`,
  };
}
