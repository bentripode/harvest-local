import Link from "next/link";

import type { ProductDisclosure } from "@/lib/labels/disclosure";

/**
 * Telling a seller that their listing is short of what their state requires a buyer to see.
 *
 * Five jurisdictions oblige a cottage-food seller to put label information in front of the buyer
 * BEFORE the sale, not only on the package afterwards: Texas by payment timing (§437.0194(b)(2)),
 * Indiana by requiring the label on the website (16-42-5.3-5(b)), Illinois on the online sales
 * interface (410 ILCS 625/4(b)(10)), California in any internet advertising (114365.3(f)), and
 * Nebraska in internet advertising too.
 *
 * When a required field has no value we render the rest and drop it — a partial label is not a
 * misleading one, and hiding the listing would be a heavier remedy than the gap deserves. But the
 * gap is a compliance problem and the seller is the only person who can close it, so it is said
 * here, plainly, with the fix attached.
 */
export function DisclosureGapNotice({
  disclosures,
  titles,
}: {
  disclosures: Record<string, ProductDisclosure>;
  titles: Map<string, string>;
}) {
  const gaps = Object.values(disclosures).filter((d) => d.required && d.missing.length > 0);
  if (gaps.length === 0) return null;

  return (
    <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-4 text-sm">
      <p className="text-destructive font-medium">
        Your state requires buyers to see label information before they order, and{" "}
        {gaps.length === 1 ? "one listing is" : `${gaps.length} listings are`} missing some
      </p>
      <p className="text-muted-foreground mt-1">
        These listings are still live and show what we have. Filling the gaps in makes them
        complete.
      </p>
      <ul className="mt-3 space-y-2">
        {gaps.map((gap) => (
          <li key={gap.productId}>
            <Link
              href={`/seller/products/${gap.productId}`}
              className="font-medium underline underline-offset-2"
            >
              {titles.get(gap.productId) ?? "Product"}
            </Link>
            <ul className="text-muted-foreground mt-1 ml-4 list-disc space-y-0.5">
              {gap.missing.map((m) => (
                <li key={m.element}>
                  {m.label} —{" "}
                  {m.fix === "product"
                    ? "add it on the product"
                    : m.fix === "profile"
                      ? "add it in your storefront settings"
                      : m.fix === "licence"
                        ? "comes from a verified permit on your compliance page"
                        : "supplied by the state — contact support"}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
