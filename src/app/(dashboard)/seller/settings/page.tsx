import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeliverySettingsForm } from "@/components/delivery-settings-form";
import { getSellerContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export const metadata = { title: "Settings — Harvest Local" };

export default async function SellerSettingsPage() {
  const { profile, seller, onboardingComplete } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");
  if (!onboardingComplete) redirect("/seller/onboarding");

  const supabase = await createClient();
  const { data: pickup } = seller.pickup_address_id
    ? await supabase
        .from("addresses")
        .select("line1, line2, city, state, postal_code")
        .eq("id", seller.pickup_address_id)
        .maybeSingle()
    : { data: null };

  const mapboxConfigured = !!(env.MAPBOX_TOKEN || env.NEXT_PUBLIC_MAPBOX_TOKEN);

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Your pickup address and local-delivery options.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Pickup &amp; delivery</CardTitle>
        </CardHeader>
        <CardContent>
          {!mapboxConfigured ? (
            <p className="mb-4 rounded-md border bg-amber-50 p-3 text-sm text-amber-900">
              Saving needs a Mapbox token (<code>MAPBOX_TOKEN</code>) — we geocode your pickup
              address to compute delivery distances. Add one to use this page.
            </p>
          ) : null}
          <DeliverySettingsForm
            homeState={seller.home_state}
            initial={{
              line1: pickup?.line1 ?? "",
              line2: pickup?.line2 ?? "",
              city: pickup?.city ?? "",
              postal: pickup?.postal_code ?? "",
              deliveryEnabled: seller.delivery_enabled,
              radiusMiles: seller.delivery_radius_miles ?? 10,
              baseFee: Number(seller.delivery_base_fee ?? 0),
              perMileFee: Number(seller.delivery_per_mile_fee ?? 0),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
