import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LicenseForm } from "@/components/license-form";
import { NotificationsPanel } from "@/components/notifications-panel";
import { getSellerContext } from "@/lib/auth";
import {
  daysUntil,
  getInAppNotifications,
  getRevenueStatus,
  getSellerLicenses,
} from "@/lib/compliance";
import { licenseTypeLabel } from "@/lib/licenses/labels";
import { formatUsd, toCents } from "@/lib/money";
import { stateName } from "@/lib/geo/state";
import type { LicenseStatus } from "@/lib/db/types";

export const metadata = { title: "Compliance — Harvest Local" };

const STATUS_VARIANT: Record<LicenseStatus, "default" | "secondary" | "destructive"> = {
  verified: "default",
  pending: "secondary",
  rejected: "destructive",
  expired: "destructive",
};

export default async function CompliancePage() {
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const [revenue, licenses, notifications] = await Promise.all([
    getRevenueStatus(seller.id, seller.home_state),
    getSellerLicenses(seller.id),
    getInAppNotifications(profile.id),
  ]);

  const grossCents = toCents(revenue.grossThisYear);
  const capCents = revenue.cap ? toCents(revenue.cap) : null;
  const pct = capCents && capCents > 0 ? Math.min(100, Math.round((grossCents / capCents) * 100)) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compliance</h1>
        <p className="text-muted-foreground text-sm">
          Cottage-food rules are per-state. We track your sales against your state&apos;s limit and
          your license expiry, and pause your storefront automatically if either is crossed.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {revenue.year} gross sales — {stateName(revenue.state)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {capCents ? (
            <>
              <p className="text-lg font-semibold tabular-nums">
                {formatUsd(grossCents)}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  of {formatUsd(capCents)}
                </span>
              </p>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className={revenue.overCap ? "bg-destructive h-full" : "bg-primary h-full"}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {revenue.overCap ? (
                <p className="text-destructive text-sm">
                  Over the cap — your storefront is paused for the rest of {revenue.year}.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-lg font-semibold tabular-nums">
              {formatUsd(grossCents)}{" "}
              <span className="text-muted-foreground text-sm font-normal">
                · no cap on record for {stateName(revenue.state)}
              </span>
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Cap figures are placeholders until an admin enters the verified limit for your state.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Licenses &amp; IDs</h2>
        {licenses.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            No licenses on file.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {licenses.map((l) => {
              const days = daysUntil(l.expiration_date);
              return (
                <li key={l.id} className="space-y-2 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {licenseTypeLabel(l.license_type)} · {stateName(l.issuing_state)}
                      </p>
                      <p className="text-muted-foreground">
                        Expires {l.expiration_date}
                        {l.verification_status !== "expired" ? (
                          <>
                            {" "}
                            ·{" "}
                            {days < 0
                              ? "past due"
                              : days === 0
                                ? "today"
                                : `in ${days} day${days === 1 ? "" : "s"}`}
                          </>
                        ) : null}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[l.verification_status as LicenseStatus]}>
                      {l.verification_status}
                    </Badge>
                  </div>
                  {l.review_note ? (
                    <p className="text-muted-foreground bg-muted/40 rounded-md border p-2">
                      <span className="font-medium">From the reviewer:</span> {l.review_note}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Add a license</h2>
        <LicenseForm sellerId={seller.id} defaultState={seller.home_state} />
      </section>

      <section>
        <NotificationsPanel notifications={notifications} />
      </section>
    </div>
  );
}
