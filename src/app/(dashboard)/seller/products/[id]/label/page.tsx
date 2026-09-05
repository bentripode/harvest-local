import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { LabelSheet } from "@/components/label-sheet";
import { getSellerContext } from "@/lib/auth";
import { getLabelContext } from "@/lib/labels/queries";
import { stateName } from "@/lib/geo/state";

export const metadata = { title: "Product label — Harvest Local" };

/**
 * Print-ready label for one product, built from the seller's state rule.
 *
 * The rule follows the seller's chosen program where they have one. Without a choice we fall back
 * to the state's first program and say so on the page — a rule from a program you aren't on is
 * worth flagging, not hiding.
 */
export default async function ProductLabelPage({
  params,
}: PageProps<"/seller/products/[id]/label">) {
  const { id } = await params;
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const context = await getLabelContext(seller.id, id);
  if (!context) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2 print:hidden">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {context.source.productName} — label
          </h1>
          <Link href={`/seller/products/${id}`} className="text-primary text-sm underline">
            edit product
          </Link>
        </div>
        <p className="text-muted-foreground text-sm">
          Built from {stateName(context.stateCode)}&apos;s labelling rules
          {context.programName ? ` for ${context.programName}` : ""}. The disclaimer is your
          state&apos;s exact wording and is printed at the size it requires — it isn&apos;t
          rewritten.
        </p>
        {!context.programChosen && context.programName ? (
          <p className="text-muted-foreground rounded-lg border p-3 text-sm">
            You haven&apos;t told us which program you sell under, so this uses{" "}
            <strong>{context.programName}</strong>. If that&apos;s not yours, the label may be
            wrong —{" "}
            <Link href="/seller/onboarding/program" className="text-primary underline">
              choose your program
            </Link>
            .
          </p>
        ) : null}
      </div>

      <LabelSheet
        rule={context.rule}
        source={context.source}
        stateName={stateName(context.stateCode)}
        disclaimerFontNote={context.rule.disclaimerFontNote ?? null}
      />

      {context.rule.notes ? (
        <p className="text-muted-foreground border-t pt-4 text-xs print:hidden">
          <span className="font-medium">Note for {stateName(context.stateCode)}:</span>{" "}
          {context.rule.notes}
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs print:hidden">
        These requirements come from a public summary of state law, not the statutes themselves.
        Check the label against {stateName(context.stateCode)}&apos;s own guidance before you sell.
      </p>
    </div>
  );
}
