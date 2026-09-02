import { type NextRequest, NextResponse } from "next/server";

/**
 * Stripe redirects here when the seller finishes (or leaves) Express onboarding.
 *
 * We deliberately do NOT read or write account state here. The `account.updated` webhook is the
 * single source of truth for `connect_charges_enabled` / `connect_details_submitted`. This route
 * only navigates the user back.
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/seller/onboarding?connect=return", request.url));
}
