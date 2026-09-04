import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddressBook } from "@/components/address-book";
import { NotificationPrefsForm } from "@/components/notification-prefs-form";
import { getUser, getProfile } from "@/lib/auth";
import { getMyAddresses } from "@/lib/addresses/queries";
import {
  CATEGORY_META,
  SUPPRESSIBLE_CATEGORIES,
  type SuppressibleCategory,
} from "@/lib/notifications/categories";

export const metadata = { title: "Your account — Harvest Local" };

export default async function AccountPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/account");

  const [profile, addresses] = await Promise.all([getProfile(), getMyAddresses()]);

  const emailCategories = SUPPRESSIBLE_CATEGORIES.filter(
    (c: SuppressibleCategory) => CATEGORY_META[c].audience === "buyer",
  );

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
        <p className="text-muted-foreground text-sm">
          Delivery addresses and notification emails.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Delivery addresses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4 text-sm">
            Saved addresses are yours to reuse — checkout still confirms the delivery fee for the
            seller you&apos;re buying from.
          </p>
          <AddressBook addresses={addresses} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Notification emails</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4 text-sm">
            Emails about a refund are always sent.
          </p>
          <NotificationPrefsForm
            categories={emailCategories}
            prefs={profile?.notification_prefs ?? {}}
          />
        </CardContent>
      </Card>
    </div>
  );
}
