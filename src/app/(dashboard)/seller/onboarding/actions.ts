"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { stripe } from "@/lib/stripe/client";
import {
  stripeConfig,
  connectAccountCreateParams,
  connectAccountLinkParams,
} from "@/lib/stripe/config";
import { env } from "@/lib/env";

export interface FormState {
  error?: string;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA",
  "RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
] as const;

const storefrontSchema = z.object({
  businessName: z.string().min(2, "Business name is required.").max(120),
  storefrontSlug: z
    .string()
    .min(3, "Handle must be at least 3 characters.")
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only."),
  homeState: z.enum(US_STATES, { message: "Select your state." }),
  bio: z.string().max(600).optional().or(z.literal("")),
});

/** Step 1 — create the storefront record. */
export async function createStorefrontAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireRole("seller");
  const parsed = storefrontSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const { businessName, storefrontSlug, homeState, bio } = parsed.data;

  const supabase = await createClient();

  const { data: slugTaken } = await supabase
    .from("seller_profiles")
    .select("id")
    .eq("storefront_slug", storefrontSlug)
    .maybeSingle();
  if (slugTaken) return { error: "That storefront handle is taken." };

  const { error } = await supabase.from("seller_profiles").insert({
    profile_id: user.id,
    business_name: businessName,
    storefront_slug: storefrontSlug,
    home_state: homeState,
    bio: bio || null,
  });
  if (error) {
    return { error: error.message.includes("duplicate") ? "You already have a storefront." : error.message };
  }

  // Snapshot the seller's selling state onto the profile too (used for buyer geofencing later).
  await createAdminClient()
    .from("profiles")
    .update({ home_state: homeState })
    .eq("id", user.id);

  redirect("/seller/onboarding");
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  if (host) {
    return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
  }
  return h.get("origin") ?? env.NEXT_PUBLIC_SITE_URL;
}

/**
 * Step 2 — Stripe Connect onboarding (hosted KYC).
 *
 * Uses the **Accounts v2** API (`/v2/core/accounts`). The connected account is created with the
 * `recipient` + `merchant` configurations so the seller can receive destination-charge transfers
 * AND act as merchant of record for sales tax (charged `on_behalf_of` in Phase 2). Capability
 * status lands via the `account.updated` webhook — never trust this redirect. See
 * `connectAccountCreateParams` in `src/lib/stripe/config.ts`.
 */
export async function startConnectOnboardingAction(): Promise<void> {
  const { user } = await requireRole("seller");
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("*")
    .eq("profile_id", user.id)
    .single();
  if (!seller) redirect("/seller/onboarding");

  let accountId = seller.stripe_account_id;

  if (!accountId) {
    const account = await stripe.v2.core.accounts.create(
      connectAccountCreateParams({
        email: user.email,
        displayName: seller.business_name,
        sellerProfileId: seller.id,
      }),
      { idempotencyKey: `connect-account:${seller.id}` },
    );
    accountId = account.id;

    // stripe_account_id is a platform-protected column — written with the service role only,
    // after we've verified this user owns the storefront.
    await admin
      .from("seller_profiles")
      .update({ stripe_account_id: accountId })
      .eq("id", seller.id);
  }

  const link = await stripe.v2.core.accountLinks.create(
    connectAccountLinkParams(accountId, await origin()),
  );

  redirect(link.url);
}

/** Step 3 — start the $20/mo subscription with a 90-day trial (card deferred). */
export async function startSubscriptionAction(): Promise<void> {
  const { user } = await requireRole("seller");
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("*")
    .eq("profile_id", user.id)
    .single();
  if (!seller) redirect("/seller/onboarding");

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("seller_id", seller.id)
    .maybeSingle();
  if (existing && ["trialing", "active", "past_due"].includes(existing.status)) {
    redirect("/seller/onboarding");
  }

  // Reuse an existing customer for this seller if one exists.
  const found = await stripe.customers.search({
    query: `metadata['seller_profile_id']:'${seller.id}'`,
  });
  const customer =
    found.data[0] ??
    (await stripe.customers.create(
      {
        email: user.email,
        name: seller.business_name,
        metadata: { seller_profile_id: seller.id, profile_id: user.id },
      },
      { idempotencyKey: `customer:${seller.id}` },
    ));

  const base = await origin();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    line_items: [{ price: stripeConfig.subscriptionPriceId, quantity: 1 }],
    payment_method_collection: "if_required",
    subscription_data: {
      trial_period_days: stripeConfig.sellerTrialDays,
      trial_settings: { end_behavior: { missing_payment_method: "pause" } },
      metadata: { seller_profile_id: seller.id },
    },
    success_url: `${base}/seller/onboarding?subscription=done`,
    cancel_url: `${base}/seller/onboarding?subscription=cancelled`,
  });

  if (!session.url) redirect("/seller/onboarding?subscription=error");
  redirect(session.url);
}
