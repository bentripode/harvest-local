import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeliverySettingsForm } from "@/components/delivery-settings-form";
import { PickupLocationsManager } from "@/components/pickup-locations-manager";
import { VacationToggle } from "@/components/vacation-toggle";
import {
  ComplianceBlockNotice,
  ComplianceCautionNotice,
} from "@/components/compliance-block-notice";
import { NotificationPrefsForm } from "@/components/notification-prefs-form";
import { HomemadeStatementForm } from "@/components/homemade-statement-form";
import { MailingAddressForm } from "@/components/mailing-address-form";
import { ContactPhoneForm } from "@/components/contact-phone-form";
import { ProducerIdNumberForm } from "@/components/producer-id-number-form";
import { PreparationCountyForm } from "@/components/preparation-county-form";
import { getSellerContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getSellerLabelNeeds } from "@/lib/labels/queries";
import { getDeliveryPermission } from "@/lib/compliance/delivery";
import { getMarketsForSeller, getSellerPickupLocations } from "@/lib/orders/pickup";
import {
  CATEGORY_META,
  SUPPRESSIBLE_CATEGORIES,
  type SuppressibleCategory,
} from "@/lib/notifications/categories";

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

  // Only shown where the seller's state prescribes a disclosure by substance and leaves the wording
  // to them (LA, MO, MT, NE). Everywhere else the statement is quoted statute and not theirs to write.
  const [
    {
      statementPrompt,
      needsMailingAddress,
      needsPhone,
      phoneRequired,
      needsIdNumber,
      needsPreparationCounty,
      mailingAddressIsAlternative,
    },
    deliveryPermission,
    pickupLocations,
    stateMarkets,
  ] = await Promise.all([
    getSellerLabelNeeds(seller.id),
    getDeliveryPermission(seller.id),
    getSellerPickupLocations(seller.id),
    getMarketsForSeller(seller.home_state),
  ]);

  // Suppressible categories relevant to a seller (admins additionally see the admin-queue toggle).
  const emailCategories = SUPPRESSIBLE_CATEGORIES.filter((c: SuppressibleCategory) => {
    const { audience } = CATEGORY_META[c];
    return (
      audience === "seller" ||
      audience === "all" ||
      (audience === "admin" && profile.role === "admin")
    );
  });

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Your pickup address, local-delivery options, and notification emails.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Open or closed</CardTitle>
        </CardHeader>
        <CardContent>
          <VacationToggle
            onVacation={seller.on_vacation}
            pauseReason={seller.is_paused ? seller.pause_reason : null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Where buyers collect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            A market stall, a farmstand, your own porch — add each place you hand orders over, with
            the times you&apos;re there. Buyers pick one at checkout, and adding a market from the
            directory also puts you on that market&apos;s page.
          </p>
          <PickupLocationsManager
            locations={pickupLocations}
            markets={stateMarkets}
            homeState={seller.home_state}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          {/* This address is the kitchen — the label's "made at" and the delivery origin. It is
              deliberately not one of the collection points above. */}
          <CardTitle className="text-sm font-medium">Your kitchen &amp; local delivery</CardTitle>
        </CardHeader>
        <CardContent>
          {!mapboxConfigured ? (
            <p className="mb-4 rounded-md border bg-amber-50 p-3 text-sm text-amber-900">
              Saving needs a Mapbox token (<code>MAPBOX_TOKEN</code>) — we geocode your pickup
              address to compute delivery distances. Add one to use this page.
            </p>
          ) : null}
          {deliveryPermission.block ? (
            <div className="mb-4">
              <ComplianceBlockNotice block={deliveryPermission.block} />
            </div>
          ) : null}
          {deliveryPermission.caution ? (
            <div className="mb-4">
              <ComplianceCautionNotice block={deliveryPermission.caution} />
            </div>
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
              windows: seller.delivery_windows ?? [],
            }}
          />
        </CardContent>
      </Card>

      {needsPhone ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Phone number for the label</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              {phoneRequired
                ? "Your state puts a producer's phone number on the label, so buyers will see it."
                : "Your state asks for a phone number or an email address on the label. Without a number here, your account email is used."}
            </p>
            <ContactPhoneForm initial={seller.contact_phone ?? ""} required={phoneRequired} />
          </CardContent>
        </Card>
      ) : null}

      {needsIdNumber ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Number instead of your address</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              Your state lets you register for an identification number and print that on labels and
              listings in place of your home address.
            </p>
            <ProducerIdNumberForm initial={seller.producer_id_number ?? ""} />
          </CardContent>
        </Card>
      ) : null}

      {needsPreparationCounty ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">County where you prepare</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              Your state puts the county your kitchen is in on the label, in place of a street
              address. Your labels can&apos;t print until we have it.
            </p>
            <PreparationCountyForm initial={seller.preparation_county ?? ""} />
          </CardContent>
        </Card>
      ) : null}

      {needsMailingAddress ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Mailing address</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              {mailingAddressIsAlternative
                ? "Your state accepts a post office box in place of the address where the food is made. Fill this in and your labels show it instead."
                : "Your state wants your postal address on the label as well as the address where the food is made, so both are printed."}
            </p>
            <MailingAddressForm initial={seller.mailing_address ?? ""} />
          </CardContent>
        </Card>
      ) : null}

      {statementPrompt ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Homemade food statement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              Your state requires buyers to be told this, and lets you say it in your own words. It
              goes on your printed labels and on your listings.
            </p>
            <HomemadeStatementForm
              prompt={statementPrompt}
              initial={seller.homemade_food_statement ?? ""}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Notification emails</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4 text-sm">
            In-app notifications and emails about a refund or a compliance pause are always sent.
          </p>
          <NotificationPrefsForm
            categories={emailCategories}
            prefs={profile.notification_prefs ?? {}}
          />
        </CardContent>
      </Card>
    </div>
  );
}
