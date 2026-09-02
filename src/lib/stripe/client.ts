import "server-only";

import Stripe from "stripe";

import { env } from "@/lib/env";

/**
 * Server-side Stripe SDK instance. The publishable key is used only in the browser (Stripe.js).
 *
 * Every write we make passes an `idempotencyKey` derived from a stable local id so Stripe retries
 * and our retries never double-apply. See ARCHITECTURE.md §3.4.
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-08-26.dahlia",
  appInfo: { name: "Harvest Local", url: env.NEXT_PUBLIC_SITE_URL },
  typescript: true,
});
