import { env } from "@/lib/env";

/**
 * Stripe object identifiers and platform constants.
 *
 * - The $20/mo seller subscription Price is created once in the Stripe dashboard (or via a setup
 *   script) and its id lives in STRIPE_SUBSCRIPTION_PRICE_ID.
 * - FREE_MONTH_100 is a reusable Coupon (percent_off: 100, duration: once) applied to a seller's
 *   subscription when they earn the referral reward (Phase 3).
 */
export const stripeConfig = {
  subscriptionPriceId: env.STRIPE_SUBSCRIPTION_PRICE_ID,
  sellerTrialDays: env.STRIPE_SELLER_TRIAL_DAYS,
  freeMonthCouponId: "FREE_MONTH_100",
} as const;

/** Connect onboarding return / refresh URLs. */
export function connectUrls(origin: string) {
  return {
    refreshUrl: `${origin}/api/stripe/connect/refresh`,
    returnUrl: `${origin}/api/stripe/connect/return`,
  };
}

/**
 * Connect account shape for Harvest Local sellers — **Accounts v2** (`/v2/core/accounts`).
 * The v1 `type: 'express'` path is deprecated and rejected for new integrations.
 *
 * Marketplace model: the platform runs checkout (Phase 2 = destination charges), but the connected
 * seller account is the **merchant of record for sales tax**. That combination means we request
 * BOTH v2 configurations:
 *   - `recipient` → `stripe_balance.stripe_transfers`: receive destination-charge transfers.
 *   - `merchant`  → `card_payments`: be MoR on charges made `on_behalf_of` the seller.
 * `dashboard: 'express'` + `application` fee/loss responsibilities per Stripe's marketplace guidance
 * (Express + `losses_collector: 'stripe'` is rejected by the API).
 */
export const CONNECT_ONBOARDING_CONFIGURATIONS = ["recipient", "merchant"] as const;

export function connectAccountCreateParams(params: {
  email?: string;
  displayName: string;
  sellerProfileId: string;
}) {
  return {
    contact_email: params.email,
    display_name: params.displayName,
    dashboard: "express" as const,
    identity: { country: "us" },
    defaults: {
      responsibilities: {
        fees_collector: "application" as const,
        losses_collector: "application" as const,
      },
    },
    configuration: {
      recipient: {
        capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
      },
      merchant: {
        capabilities: { card_payments: { requested: true } },
      },
    },
    metadata: { seller_profile_id: params.sellerProfileId },
  };
}

/** Params for the v2 hosted onboarding link (`stripe.v2.core.accountLinks.create`). */
export function connectAccountLinkParams(accountId: string, origin: string) {
  const { refreshUrl, returnUrl } = connectUrls(origin);
  return {
    account: accountId,
    use_case: {
      type: "account_onboarding" as const,
      account_onboarding: {
        configurations: [...CONNECT_ONBOARDING_CONFIGURATIONS] as Array<"recipient" | "merchant">,
        refresh_url: refreshUrl,
        return_url: returnUrl,
      },
    },
  };
}
