import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { FoodSalesNotice } from "@/components/food-sales-notice";
import { NotificationsPanel } from "@/components/notifications-panel";
import { getSellerContext } from "@/lib/auth";
import {
  daysUntil,
  getInAppNotifications,
  getRevenueStatus,
  getSellerLicenses,
  sellerSellsCottageFood,
} from "@/lib/compliance";
import { getFoodSalesStatus } from "@/lib/compliance/food-sales";
import { getChosenProgram, programRequirements, programSummary } from "@/lib/compliance/onboarding";
import { licenseTypeLabel } from "@/lib/licenses/labels";
import {
  buildDocumentChecklist,
  displayNumber,
  type DocumentStatus,
} from "@/lib/licenses/requirements";
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

const CHECKLIST_VARIANT: Record<DocumentStatus, "default" | "secondary" | "destructive" | "outline"> =
  {
    verified: "default",
    pending: "secondary",
    rejected: "destructive",
    expired: "destructive",
    missing: "outline",
  };

function expiryPhrase(days: number): string {
  if (days < 0) return "past due";
  if (days === 0) return "today";
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export default async function CompliancePage() {
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const [revenue, licenses, notifications, sellsCottageFood, foodSales, program] =
    await Promise.all([
    getRevenueStatus(seller.id, seller.home_state),
    getSellerLicenses(seller.id),
    getInAppNotifications(profile.id),
    sellerSellsCottageFood(seller.id),
    getFoodSalesStatus(seller.id),
    getChosenProgram(seller.id),
  ]);

  const checklist = buildDocumentChecklist(licenses, sellsCottageFood);
  const required = checklist.filter((c) => c.required);
  const outstanding = required.filter((c) => c.status !== "verified");
  // Anything uploaded under the old generic form (food handler card, business license, …).
  const checklistTypes = new Set<string>(checklist.map((c) => c.spec.type));
  const otherLicenses = licenses.filter((l) => !checklistTypes.has(l.license_type));

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

      <FoodSalesNotice status={foodSales} />

      {foodSales?.allowed !== false ? (
        <section className="space-y-2 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium">Your food program</h2>
            {program ? null : <Badge variant="outline">not chosen</Badge>}
          </div>
          {program ? (
            <>
              <p className="text-sm">
                {program.name}{" "}
                <span className="text-muted-foreground">· {programSummary(program)}</span>
              </p>
              {programRequirements(program).length > 0 ? (
                <ul className="text-muted-foreground space-y-1 text-sm">
                  {programRequirements(program).map((r) => (
                    <li key={r.key}>
                      {r.label}
                      {r.detail ? ` — ${r.detail}` : ""}
                      {r.url ? (
                        <>
                          {" "}
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-primary underline"
                          >
                            open
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link href="/seller/onboarding/program" className="text-primary text-sm underline">
                Change program
              </Link>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                Your listings are being checked against your state as a whole. Telling us which
                program you sell under makes that precise, and shows exactly which permits you need.
              </p>
              <Link href="/seller/onboarding/program" className="text-primary text-sm underline">
                Choose your program
              </Link>
            </>
          )}
        </section>
      ) : null}

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
          {revenue.capVerified ? null : (
            <p className="text-muted-foreground text-xs">
              This cap is a placeholder — an admin hasn&apos;t entered the verified limit for
              {" "}
              {stateName(revenue.state)} yet.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Your documents</h2>
          <p className="text-muted-foreground text-sm">
            {outstanding.length === 0
              ? "Everything we need is verified."
              : `Your storefront stays paused until all ${required.length} are verified — ${outstanding.length} still outstanding.`}{" "}
            {sellsCottageFood
              ? "You list food, so we also need your cottage-food permit."
              : "You don't list food yet, so no cottage-food permit is needed. Add a food product and it becomes required."}
          </p>
        </div>

        <ul className="space-y-3">
          {checklist.map((item) => (
            <li key={item.spec.type} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {item.spec.label}{" "}
                    {item.required ? null : (
                      <span className="text-muted-foreground font-normal">— not needed yet</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-sm">{item.spec.help}</p>
                </div>
                <Badge variant={CHECKLIST_VARIANT[item.status]}>
                  {item.status === "missing" ? "not uploaded" : item.status}
                </Badge>
              </div>

              {item.license ? (
                <div className="text-muted-foreground mt-3 space-y-1 text-sm">
                  {displayNumber(item.spec, item.license) ? (
                    <p>
                      {item.spec.numberLabel}:{" "}
                      <span className="font-mono">{displayNumber(item.spec, item.license)}</span>
                    </p>
                  ) : null}
                  {item.license.expiration_date ? (
                    <p>
                      Expires {item.license.expiration_date}
                      {item.status !== "expired"
                        ? ` · ${expiryPhrase(daysUntil(item.license.expiration_date))}`
                        : null}
                    </p>
                  ) : null}
                  {item.license.review_note ? (
                    <p className="bg-muted/40 rounded-md border p-2">
                      <span className="font-medium">From the reviewer:</span>{" "}
                      {item.license.review_note}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {item.status === "verified" ? null : (
                <div className="mt-4 border-t pt-4">
                  <DocumentUploadForm
                    spec={item.spec}
                    sellerId={seller.id}
                    defaultState={seller.home_state}
                    replacing={item.status === "rejected" || item.status === "expired"}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {otherLicenses.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Other documents on file</h2>
          <ul className="divide-y rounded-lg border">
            {otherLicenses.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1 font-medium">
                  {licenseTypeLabel(l.license_type)}
                  {l.issuing_state ? ` · ${stateName(l.issuing_state)}` : ""}
                </span>
                <Badge variant={STATUS_VARIANT[l.verification_status as LicenseStatus]}>
                  {l.verification_status}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <NotificationsPanel notifications={notifications} />
      </section>
    </div>
  );
}
