import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { getSellerContext } from "@/lib/auth";
import { getPayoutBreakdown, getSellerPayouts } from "@/lib/payouts/queries";
import { describePayout, payoutStatus } from "@/lib/payouts/format";
import { formatUsd, toCents } from "@/lib/money";

export const metadata = { title: "Payout — Harvest Local" };

/**
 * What one payout was made of, asked of Stripe when the page is opened.
 *
 * Nothing on this page is stored. The lines are Stripe's balance transactions with Stripe's own
 * amounts and Stripe's own fees; all we add is a link to our order where a line could be matched to
 * one. A payout also contains things that are not orders — refunds, adjustments, Stripe's fees —
 * and those are shown as what they are rather than folded away, because a breakdown that quietly
 * drops rows is a breakdown that doesn't add up.
 */
export default async function PayoutDetailPage({ params }: PageProps<"/seller/payouts/[id]">) {
  const { id } = await params;
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const payouts = await getSellerPayouts(seller.id);
  const payout = payouts.find((p) => p.stripePayoutId === id);
  if (!payout) notFound();

  const breakdown = await getPayoutBreakdown(seller.id, id);
  const status = payoutStatus(payout);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav className="text-muted-foreground text-sm">
        <Link href="/seller/payouts" className="hover:underline">
          Payouts
        </Link>{" "}
        / <span className="text-foreground">{formatUsd(toCents(payout.amount))}</span>
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl tabular-nums sm:text-3xl">{formatUsd(toCents(payout.amount))}</h1>
        <p className="text-muted-foreground text-sm">
          {describePayout(payout)}
          {payout.method === "instant" ? " · instant" : ""}
        </p>
        {status.detail ? <p className="text-muted-foreground text-sm">{status.detail}</p> : null}
        {payout.failureMessage ? (
          <p className="pt-1 text-sm">
            <span className="font-medium">Stripe says:</span> {payout.failureMessage}
          </p>
        ) : null}
      </header>

      {!breakdown.ok ? (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-sm">
            {breakdown.message}
          </CardContent>
        </Card>
      ) : breakdown.lines.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-sm">
            Stripe hasn&apos;t itemised this one. That&apos;s usual for a payout that hasn&apos;t
            left yet.
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg">What&apos;s in it</h2>
          <ul className="divide-y rounded-lg border">
            {breakdown.lines.map((line) => (
              <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                <div className="min-w-0">
                  {line.order ? (
                    <Link
                      href={`/seller/orders/${line.order.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      Order {line.order.id.slice(0, 8)}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">{line.description ?? line.type}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {line.type.replace(/_/g, " ")}
                    {toCents(line.fee) > 0 ? ` · Stripe fee ${formatUsd(toCents(line.fee))}` : ""}
                  </p>
                </div>
                <p className="text-sm tabular-nums">{formatUsd(toCents(line.net))}</p>
              </li>
            ))}
          </ul>

          {breakdown.truncated ? (
            <p className="text-muted-foreground text-xs">
              Showing the first 100 lines. Your Stripe dashboard has the rest.
            </p>
          ) : null}

          <p className="text-muted-foreground text-xs">
            Amounts and fees are Stripe&apos;s own. Lines with no order attached are refunds,
            adjustments or Stripe&apos;s own charges — they are part of the payout too.
          </p>
        </section>
      )}
    </div>
  );
}
