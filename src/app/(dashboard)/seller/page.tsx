import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SellerStatsPanel } from "@/components/seller-stats";
import { SellerAvatar } from "@/components/seller-avatar";
import { StarRating } from "@/components/star-rating";
import { ReviewList } from "@/components/review-list";
import { getSellerContext } from "@/lib/auth";
import { getSellerDashboardStats, parseWindowDays, WINDOW_DAYS } from "@/lib/analytics/queries";
import { getSellerReviews, getSellerReviewSummary } from "@/lib/reviews/queries";

export default async function SellerOverviewPage({ searchParams }: PageProps<"/seller">) {
  const { profile, seller, subscription, onboardingComplete } = await getSellerContext();

  if (profile.role === "buyer") redirect("/");
  if (!onboardingComplete || !seller) redirect("/seller/onboarding");

  const windowDays = parseWindowDays((await searchParams).range);

  const [stats, reviewSummary, reviews] = await Promise.all([
    getSellerDashboardStats(seller.id, windowDays),
    getSellerReviewSummary(seller.id),
    getSellerReviews(seller.id, 5),
  ]);

  const trialEnds = subscription?.trial_end
    ? new Date(subscription.trial_end).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <SellerAvatar name={seller.business_name} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl sm:text-3xl">{seller.business_name}</h1>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
              <Link href={`/s/${seller.storefront_slug}`} className="hover:text-foreground">
                /s/{seller.storefront_slug}
              </Link>
              <span>· {seller.home_state}</span>
              {reviewSummary.avg != null ? (
                <span className="inline-flex items-center gap-1">
                  · <StarRating value={reviewSummary.avg} />
                  {reviewSummary.avg.toFixed(1)} ({reviewSummary.count})
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <Badge variant={seller.is_paused ? "secondary" : "default"}>
          {seller.is_paused ? "Paused" : "Live"}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Sales</h2>
        <div className="flex gap-1 text-sm">
          {WINDOW_DAYS.map((d) => (
            <Link
              key={d}
              href={d === 30 ? "/seller" : `/seller?range=${d}`}
              className={`rounded-full px-3 py-1 no-underline ${
                windowDays === d
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d === 365 ? "1 year" : `${d} days`}
            </Link>
          ))}
        </div>
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
            <CardTitle className="text-sm font-medium">Storefront</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{seller.is_paused ? "Closed" : "Open"}</p>
            <p className="text-muted-foreground text-xs">
              {seller.is_paused ? (seller.pause_reason ?? "paused") : "buyers can order"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/seller/products">Manage listings</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/seller/orders">Orders</Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/s/${seller.storefront_slug}`}>View storefront</Link>
        </Button>
      </div>

      {reviews.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg">Recent reviews</h2>
          <ReviewList reviews={reviews} respondable />
        </section>
      ) : null}
    </div>
  );
}
