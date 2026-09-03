import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SellerStatsPanel } from "@/components/seller-stats";
import { StarRating } from "@/components/star-rating";
import { ReviewList } from "@/components/review-list";
import { getSellerContext } from "@/lib/auth";
import { getSellerDashboardStats } from "@/lib/analytics/queries";
import { getSellerReviews, getSellerReviewSummary } from "@/lib/reviews/queries";

export default async function SellerOverviewPage() {
  const { profile, seller, subscription, onboardingComplete } = await getSellerContext();

  if (profile.role === "buyer") redirect("/");
  if (!onboardingComplete || !seller) redirect("/seller/onboarding");

  const [stats, reviewSummary, reviews] = await Promise.all([
    getSellerDashboardStats(seller.id),
    getSellerReviewSummary(seller.id),
    getSellerReviews(seller.id, 5),
  ]);

  const trialEnds = subscription?.trial_end
    ? new Date(subscription.trial_end).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{seller?.business_name}</h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
            <span>
              harvestlocal.com/s/{seller?.storefront_slug} · {seller?.home_state}
            </span>
            {reviewSummary.avg != null ? (
              <span className="inline-flex items-center gap-1">
                · <StarRating value={reviewSummary.avg} />
                {reviewSummary.avg.toFixed(1)} ({reviewSummary.count})
              </span>
            ) : null}
          </p>
        </div>
        <Badge variant={seller?.is_paused ? "secondary" : "default"}>
          {seller?.is_paused ? "Paused" : "Live"}
        </Badge>
      </div>

      <SellerStatsPanel stats={stats} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">{subscription?.status ?? "—"}</p>
            {trialEnds ? (
              <p className="text-muted-foreground text-xs">Trial ends {trialEnds}</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {seller?.connect_payouts_enabled ? "Enabled" : "Pending"}
            </p>
            <p className="text-muted-foreground text-xs">Stripe Connect (Express)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link href="/seller/products">Manage listings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {reviews.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Recent reviews</h2>
          <ReviewList reviews={reviews} />
        </section>
      ) : null}
    </div>
  );
}
