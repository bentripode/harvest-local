import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { LabelSheet } from "@/components/label-sheet";
import { getSellerContext } from "@/lib/auth";
import { getLabelContext } from "@/lib/labels/queries";
import { createClient } from "@/lib/supabase/server";
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
  searchParams,
}: PageProps<"/seller/products/[id]/label">) {
  const { id } = await params;
  const sp = await searchParams;
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  // A listing sold in sizes has a different net weight per bag, so the label is printed per
  // option rather than per listing.
  const supabase = await createClient();
  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, name")
    .eq("product_id", id)
    .eq("is_active", true)
    .order("sort_order");

  const options = variants ?? [];
  const requested = typeof sp?.variant === "string" ? sp.variant : null;
  const chosen =
    options.find((v) => v.id === requested)?.id ?? (options.length === 1 ? options[0].id : null);

  const context = await getLabelContext(seller.id, id, chosen);
  if (!context) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2 print:hidden">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl sm:text-3xl">
            {context.source.productName} — label
          </h1>
          <Link href={`/seller/products/${id}`} className="text-primary text-sm underline">
            edit product
          </Link>
        </div>
        {options.length > 1 ? (
          <p className="text-sm">
            <span className="font-medium">Which option?</span>{" "}
            {options.map((v) => (
              <Link
                key={v.id}
                href={`/seller/products/${id}/label?variant=${v.id}`}
                className={`mr-2 underline ${v.id === chosen ? "font-medium" : "text-muted-foreground"}`}
              >
                {v.name}
              </Link>
            ))}
            {!chosen ? (
              <span className="text-muted-foreground">
                — pick one; the net weight differs between them.
              </span>
            ) : null}
          </p>
        ) : null}
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
        productId={id}
        programName={context.programName}
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
