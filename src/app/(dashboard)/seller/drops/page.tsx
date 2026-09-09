import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSellerContext } from "@/lib/auth";
import { getSellerDrops } from "@/lib/orders/drop-queries";
import { closesIn, dropState, formatFulfillment, opensIn, unitsLeft } from "@/lib/orders/drops";

export const metadata = { title: "Batches — Harvest Local" };

/**
 * The bake list.
 *
 * A seller running batches across several listings has one question on a Friday night — what am I
 * making, and how many — and answering it by opening each product page in turn is how a batch gets
 * missed. Ordered by collection date rather than by listing, because the oven works by date.
 */
export default async function SellerDropsPage() {
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const drops = await getSellerDrops(seller.id);

  const taking = drops.filter((d) => dropState(d) === "open");
  const upcoming = drops.filter((d) => dropState(d) === "scheduled");
  const soldOut = drops.filter((d) => dropState(d) === "sold_out");
  // Everything settled: closed windows and batches called off. Kept, because "where did it go" is
  // a worse question than a slightly longer page.
  const done = drops.filter((d) => ["closed", "cancelled"].includes(dropState(d)));

  const toBake = [...taking, ...soldOut].sort((a, b) =>
    a.fulfillmentDate.localeCompare(b.fulfillmentDate),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
        <p className="text-muted-foreground text-sm">
          What you&apos;ve committed to make, by collection date. Set one up on a listing&apos;s own
          page — a listing with batches sells through them and pauses between them.
        </p>
      </div>

      {drops.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-sm">
            No batches yet. Open a{" "}
            <Link href="/seller/products" className="underline underline-offset-2">
              listing
            </Link>{" "}
            and schedule one to take pre-orders against a date instead of guessing how much to make.
          </CardContent>
        </Card>
      ) : null}

      {toBake.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">To make</h2>
          <ul className="space-y-3">
            {toBake.map((d) => (
              <li key={d.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    <span className="tabular-nums">{d.unitsClaimed}</span> ×{" "}
                    <Link
                      href={`/seller/products/${d.productId}`}
                      className="underline underline-offset-2"
                    >
                      {d.productTitle}
                    </Link>
                  </p>
                  {unitsLeft(d) === 0 ? (
                    <Badge>Sold out</Badge>
                  ) : (
                    <Badge variant="secondary">{unitsLeft(d)} left</Badge>
                  )}
                </div>
                <p className="text-muted-foreground pt-1 text-sm">
                  {d.name} · collect {formatFulfillment(d)}
                  {d.pickupWindow ? `, ${d.pickupWindow}` : ""}
                  {closesIn(d) ? ` · orders close in ${closesIn(d)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Announced</h2>
          <ul className="space-y-3">
            {upcoming.map((d) => (
              <li key={d.id} className="rounded-lg border p-4 text-sm">
                <p className="font-medium">{d.productTitle}</p>
                <p className="text-muted-foreground pt-1">
                  {d.name} · up to {d.unitCap} · collect {formatFulfillment(d)}
                  {opensIn(d) ? ` · orders open in ${opensIn(d)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {done.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Finished</h2>
          <ul className="space-y-2">
            {done.map((d) => (
              <li key={d.id} className="text-muted-foreground text-sm">
                {d.productTitle} — {d.name} ·{" "}
                {d.cancelledAt
                  ? "called off"
                  : `${d.unitsClaimed} of ${d.unitCap}, collected ${formatFulfillment(d)}`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
