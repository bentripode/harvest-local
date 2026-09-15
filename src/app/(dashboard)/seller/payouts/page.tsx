import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getSellerContext } from "@/lib/auth";
import { getSellerPayouts } from "@/lib/payouts/queries";
import {
  describePayout,
  payoutStatus,
  splitPayouts,
  sumAmounts,
  type PayoutTone,
} from "@/lib/payouts/format";
import { formatUsd, toCents } from "@/lib/money";

export const metadata = { title: "Payouts — Harvest Local" };

const TONE: Record<PayoutTone, "default" | "secondary" | "outline"> = {
  settled: "secondary",
  moving: "default",
  attention: "outline",
};

/**
 * What Stripe has actually sent to the seller's bank.
 *
 * Deliberately NOT the same page as `/seller` revenue, and the copy works hard to keep them apart:
 * revenue is what buyers paid us, this is what Stripe paid you, and the gap is processing fees,
 * refunds and timing. Sellers ask about that gap constantly, and the honest answer is to show both
 * numbers with their real names rather than to reconcile them with arithmetic of our own.
 */
export default async function SellerPayoutsPage() {
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const payouts = await getSellerPayouts(seller.id);
  const { upcoming, history } = splitPayouts(payouts);
  const comingTotal = sumAmounts(upcoming);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">Payouts</h1>
        <p className="text-muted-foreground text-sm">
          Money Stripe has sent to your bank. Not the same as{" "}
          <Link href="/seller" className="underline underline-offset-2">
            your revenue
          </Link>
          : that is what buyers paid, this is what is left after Stripe&apos;s fees and refunds.
        </p>
      </div>

      {payouts.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground space-y-2 py-6 text-sm">
            <p>No payouts yet.</p>
            <p>
              Stripe pays out on its own schedule once you&apos;ve taken your first order and your
              account details are complete. Nothing here needs setting up.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg">On the way</h2>
            <p className="text-sm">
              <span className="font-medium tabular-nums">{formatUsd(toCents(comingTotal))}</span>{" "}
              <span className="text-muted-foreground">across {upcoming.length}</span>
            </p>
          </div>
          <ul className="space-y-3">
            {upcoming.map((p) => (
              <PayoutRow key={p.id} payout={p} />
            ))}
          </ul>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg">Sent</h2>
          <ul className="space-y-3">
            {history.map((p) => (
              <PayoutRow key={p.id} payout={p} />
            ))}
          </ul>
        </section>
      ) : null}

      {payouts.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          These figures come from Stripe, not from us — we copy them down as Stripe reports them. If
          anything here disagrees with your bank, your Stripe dashboard is the record.
        </p>
      ) : null}
    </div>
  );
}

function PayoutRow({ payout }: { payout: Awaited<ReturnType<typeof getSellerPayouts>>[number] }) {
  const status = payoutStatus(payout);

  return (
    <li className="space-y-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-medium tabular-nums">{formatUsd(toCents(payout.amount))}</p>
        <Badge variant={TONE[status.tone]}>{status.label}</Badge>
      </div>

      <p className="text-muted-foreground text-sm">
        {describePayout(payout)}
        {payout.method === "instant" ? " · instant" : ""}
      </p>

      {status.detail ? <p className="text-muted-foreground text-sm">{status.detail}</p> : null}

      {/* Stripe's own wording for the failure. Shown verbatim: a bank's reason is the one thing
          that tells a seller what to actually fix. */}
      {payout.failureMessage ? (
        <p className="text-sm">
          <span className="font-medium">Stripe says:</span> {payout.failureMessage}
        </p>
      ) : null}

      <Link
        href={`/seller/payouts/${payout.stripePayoutId}`}
        className="text-muted-foreground inline-block text-sm underline underline-offset-2"
      >
        What&apos;s in this payout →
      </Link>
    </li>
  );
}
