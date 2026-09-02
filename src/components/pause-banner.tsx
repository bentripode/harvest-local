import Link from "next/link";

import { stateName } from "@/lib/geo/state";
import type { SellerProfile } from "@/lib/db/types";

/**
 * Shown across the seller dashboard whenever the storefront is paused. Onboarding pauses are
 * handled by the onboarding flow itself, so this only speaks to the compliance ones.
 */
export function PauseBanner({ seller }: { seller: SellerProfile | null }) {
  if (!seller?.is_paused) return null;

  const reason = seller.pause_reason;
  if (reason !== "revenue_cap" && reason !== "license_expired" && reason !== "admin") return null;

  const copy = {
    revenue_cap: {
      title: `Your storefront is paused — ${stateName(seller.home_state)} cottage-food sales cap reached`,
      body: "You've hit the annual gross-sales limit for your state. Your storefront is hidden and can't take orders. It reopens at the start of next year, or sooner if an admin adjusts your limit.",
    },
    license_expired: {
      title: "Your storefront is paused — a required license has expired",
      body: "Renew the license and upload the new document; an admin will re-verify it and reinstate your storefront.",
    },
    admin: {
      title: "Your storefront is paused by an administrator",
      body: "Contact support for details.",
    },
  }[reason];

  return (
    <div className="border-b border-destructive/30 bg-destructive/5">
      <div className="text-destructive mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-2.5 text-sm">
        <span>
          <strong>{copy.title}.</strong> {copy.body}
        </span>
        <Link href="/seller/compliance" className="shrink-0 font-medium underline">
          Compliance
        </Link>
      </div>
    </div>
  );
}
