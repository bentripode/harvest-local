import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { connectAccountLinkParams } from "@/lib/stripe/config";

/**
 * Account links expire. Stripe sends the seller here when a link is stale — we mint a fresh one
 * (Accounts v2 hosted onboarding) and bounce them straight back into onboarding.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("stripe_account_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!seller?.stripe_account_id) {
    return NextResponse.redirect(new URL("/seller/onboarding", request.url));
  }

  const link = await stripe.v2.core.accountLinks.create(
    connectAccountLinkParams(seller.stripe_account_id, new URL(request.url).origin),
  );

  return NextResponse.redirect(link.url);
}
