import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PromoCodeForm } from "@/components/promo-code-form";
import { getSellerContext } from "@/lib/auth";
import { getReferralProgress, getSellerPromoCodes } from "@/lib/referrals/queries";
import { getReferralConfig } from "@/lib/referrals/settings";
import { formatUsd, toCents } from "@/lib/money";
import { togglePromoCodeAction } from "./actions";

export const metadata = { title: "Referrals — Harvest Local" };

export default async function SellerReferralsPage() {
  const { profile, seller, onboardingComplete } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");
  if (!onboardingComplete) redirect("/seller/onboarding");

  const [progress, codes, config] = await Promise.all([
    getReferralProgress(seller.id),
    getSellerPromoCodes(seller.id),
    getReferralConfig(),
  ]);

  const pct =
    progress.threshold > 0
      ? Math.min(100, Math.round((progress.count / progress.threshold) * 100))
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Referrals</h1>
        <p className="text-muted-foreground text-sm">
          Share a code. Buyers get {config.discountPercent}% off their order; bring in{" "}
          {progress.threshold} in a billing cycle and your next month is free.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">This cycle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {progress.cycle ? (
            <>
              <p className="text-lg font-semibold tabular-nums">
                {progress.count} / {progress.threshold} verified referrals
              </p>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className={progress.rewardGranted ? "bg-green-600 h-full" : "bg-primary h-full"}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {progress.rewardGranted ? (
                <p className="text-sm text-green-600">
                  Free month earned — it applies to your next invoice.
                </p>
              ) : progress.projectedFreeMonth ? (
                <p className="text-muted-foreground text-sm">
                  Cycle ends{" "}
                  {new Date(progress.projectedFreeMonth).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                  . Counting resets then.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              A cycle opens once your subscription is active.
            </p>
          )}

          {progress.contributing.length > 0 ? (
            <ul className="divide-y border-t pt-2 text-sm">
              {progress.contributing.map((r) => (
                <li key={r.id} className="flex justify-between gap-4 py-1.5">
                  <span>
                    {r.buyerName} · order {r.orderId.slice(0, 8)}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {r.activatedAt
                      ? new Date(r.activatedAt).toLocaleDateString(undefined, { dateStyle: "medium" })
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Your codes</h2>
        {codes.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            No codes yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {codes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="font-mono font-medium">{c.code}</span>
                <Badge variant={c.is_active ? "default" : "secondary"}>
                  {c.is_active ? "Active" : "Inactive"}
                </Badge>
                <span className="text-muted-foreground text-sm">used {c.times_used}×</span>
                <form action={togglePromoCodeAction} className="ml-auto">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={c.is_active ? "false" : "true"} />
                  <Button type="submit" variant="ghost" size="sm">
                    {c.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <PromoCodeForm />
      </section>

      {progress.contributing.length === 0 && progress.cycle ? (
        <p className="text-muted-foreground text-xs">
          A referral counts once the buyer&apos;s order is marked completed. Discounts given so far
          this cycle:{" "}
          {formatUsd(
            progress.contributing.reduce((n, r) => n + toCents(r.discountAmount), 0),
          )}
          .
        </p>
      ) : null}
    </div>
  );
}
