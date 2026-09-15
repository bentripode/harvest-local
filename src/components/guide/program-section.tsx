import type { Money } from "@/lib/money";
import { Citation, Provenance, VerdictBadge } from "@/components/guide/provenance";
import type { ProgramGuide } from "@/lib/compliance/guide";
import type { OnlineVerdict } from "@/lib/compliance/guide-format";

/**
 * One cottage-food programme, in full.
 *
 * Three distinctions this component exists to keep straight, each of which was a real bug in the
 * underlying data at some point:
 *
 *   - A sales cap is not a licence threshold. Crossing a cap means stop selling; crossing a
 *     threshold means go and get a licence. Vermont's $30,000 sat in the wrong column and would
 *     have closed storefronts for passing a line that only removes a filing exemption.
 *   - A cap can apply to one category rather than the whole business. Virginia's $9,000 binds
 *     acidified vegetables alone and nothing else.
 *   - `unclear` is missing data, not a soft no. It never renders as a prohibition.
 */

function money(value: Money | null): string {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const AXIS_STYLE: Record<string, string> = {
  allowed: "text-emerald-700 dark:text-emerald-400",
  unrestricted: "text-emerald-700 dark:text-emerald-400",
  banned: "text-red-700 dark:text-red-400",
  conditional: "text-amber-700 dark:text-amber-400",
  list_only: "text-amber-700 dark:text-amber-400",
  limited: "text-amber-700 dark:text-amber-400",
  unclear: "text-muted-foreground",
};

const AXIS_WORD: Record<string, string> = {
  allowed: "Allowed",
  unrestricted: "Allowed",
  banned: "Not allowed",
  conditional: "With conditions",
  list_only: "Only what's on the state's list",
  limited: "Limited",
  unclear: "Not stated",
};

const CAP_BASIS_NOTE: Record<string, string> = {
  annual_total: "across everything you sell",
  per_product: "per product",
  per_category: "for the foods it names",
};

export function ProgramSection({ guide, stateName }: { guide: ProgramGuide; stateName: string }) {
  const p = guide.program;
  const label = guide.label;

  return (
    <section id={p.id} className="scroll-mt-6 space-y-6 rounded-lg border p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{p.name}</h2>
        <p className="text-muted-foreground text-sm">{guide.summary}</p>
        <Provenance
          sourceUrl={p.source_url}
          sourceCheckedAt={p.source_checked_at}
          verifiedAt={p.verified_at}
        />
      </header>

      {/* --- online orders ---------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-medium">Selling online</h3>
          <VerdictBadge verdict={p.online_orders as OnlineVerdict} />
        </div>
        <Citation text={p.venue_note} />
        {p.mail_note ? (
          <p className="text-muted-foreground text-sm">
            <span className="font-medium">Shipping by mail:</span> {p.mail_note}
          </p>
        ) : null}
      </div>

      {/* --- money ------------------------------------------------------- */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">How much you can sell</h3>
        {p.cap_basis === "none" ? (
          <p className="text-sm">No sales cap under this programme.</p>
        ) : (
          <p className="text-sm">
            <span className="font-medium">{money(p.revenue_cap)}</span>{" "}
            {CAP_BASIS_NOTE[p.cap_basis ?? "annual_total"] ?? "a year"}
            {p.cap_basis === "per_category" && p.cap_category ? ` (${p.cap_category})` : ""} — pass
            it and you&apos;re outside this programme.
          </p>
        )}
        {p.cap_note ? <Citation text={p.cap_note} /> : null}

        {/*
          The distinction that matters most on this page. A threshold is not a ceiling: it does not
          stop you selling, it means the state now wants you licensed.
        */}
        {p.license_threshold ? (
          <p className="bg-muted/50 rounded-md border p-3 text-sm">
            <span className="font-medium">
              Separately: past {money(p.license_threshold)} a year you need a licence.
            </span>{" "}
            That&apos;s not a cap — you can keep selling, but you have to be licensed to do it.
          </p>
        ) : null}
      </div>

      {/* --- what you can make ------------------------------------------- */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">What you can make</h3>
        <ul className="divide-y rounded-md border text-sm">
          {guide.categories.map((c) => (
            <li key={c.axis} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>{c.label}</span>
              <span className={`font-medium ${AXIS_STYLE[c.value] ?? "text-muted-foreground"}`}>
                {AXIS_WORD[c.value] ?? c.value}
              </span>
            </li>
          ))}
        </ul>
        {p.category_note ? <Citation text={p.category_note} /> : null}
        <p className="text-muted-foreground text-xs">
          &ldquo;Not stated&rdquo; means the law we read doesn&apos;t address that category — check
          with {stateName} rather than assuming either answer.
        </p>
      </div>

      {/* --- what you have to do ----------------------------------------- */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">What you have to do first</h3>
        {guide.requirements.length === 0 ? (
          <p className="text-sm">
            No licence, inspection, training or recipe approval recorded for this programme.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {guide.requirements.map((r) => (
              <li key={r.key} className="rounded-md border p-3">
                <p className="font-medium">{r.label}</p>
                {r.detail ? <p className="text-muted-foreground pt-0.5">{r.detail}</p> : null}
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-block pt-1 underline"
                  >
                    Apply or read more
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {p.local_preemption ? (
          <p className="text-muted-foreground text-sm">
            Your city or county may add rules on top of the state&apos;s.
          </p>
        ) : null}
      </div>

      {/* --- the label ---------------------------------------------------- */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">What has to go on the label</h3>
        {!label ? (
          <p className="text-muted-foreground text-sm">
            We haven&apos;t recorded {stateName}&apos;s labelling rule for this programme yet, so we
            can&apos;t tell you what it requires — and we&apos;d rather say that than guess.
          </p>
        ) : (
          <>
            {label.required.length > 0 ? (
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {label.required.map((el) => (
                  <li key={el.key} className="rounded border px-3 py-1.5">
                    {el.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No specific elements recorded.</p>
            )}

            {label.alternatives.length > 0 ? (
              <div className="text-sm">
                <p className="font-medium">Either/or — at least one of each group:</p>
                <ul className="text-muted-foreground list-disc space-y-0.5 pt-1 pl-5">
                  {label.alternatives.map((group, i) => (
                    <li key={i}>{group.map((m) => m.label).join(" or ")}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {label.optional.length > 0 ? (
              <p className="text-muted-foreground text-sm">
                <span className="font-medium">If it applies to you:</span>{" "}
                {label.optional.map((el) => el.label).join(", ")}
              </p>
            ) : null}

            {/*
              Quoted statute, printed onto food. Rendered verbatim and never reflowed into our own
              prose — the column exists precisely so this string is never paraphrased.
            */}
            {label.disclaimerText ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  This exact wording has to appear on the package:
                </p>
                <p
                  className={`bg-muted/50 rounded-md border p-3 text-sm ${
                    label.disclaimerAllCaps ? "uppercase" : ""
                  }`}
                >
                  {label.disclaimerText}
                </p>
                <p className="text-muted-foreground text-xs">
                  {[
                    label.disclaimerMinPt ? `At least ${label.disclaimerMinPt}pt` : null,
                    label.disclaimerAllCaps ? "in capitals" : null,
                    label.disclaimerFontNote,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No size or typeface prescribed."}
                </p>
              </div>
            ) : null}

            {label.sellerStatementPrompt ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">You write this one yourself:</p>
                <Citation text={label.sellerStatementPrompt} />
                <p className="text-muted-foreground text-xs">
                  The law says what the label has to convey and leaves you the wording.
                </p>
              </div>
            ) : null}

            {label.metricRequired ? (
              <p className="text-sm">Net weight has to show metric units as well as US ones.</p>
            ) : null}

            {label.placardRequired ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">You also need a sign where you sell:</p>
                {label.placardText ? (
                  <p className="bg-muted/50 rounded-md border p-3 text-sm">{label.placardText}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    The law requires a sign but doesn&apos;t prescribe its wording.
                  </p>
                )}
              </div>
            ) : null}

            {label.predisclosureRequired ? (
              <p className="bg-muted/50 rounded-md border p-3 text-sm">
                <span className="font-medium">Before the sale, not just on the jar.</span> This
                programme requires the buyer to get the required information before they pay — so a
                web listing has to carry it, not just the package they collect.
              </p>
            ) : null}

            {label.notes ? <p className="text-muted-foreground text-sm">{label.notes}</p> : null}

            <Provenance
              sourceUrl={label.sourceUrl}
              sourceCheckedAt={label.sourceCheckedAt}
              verifiedAt={label.verifiedAt}
            />
          </>
        )}
      </div>

      {/* --- recurring duties --------------------------------------------- */}
      {guide.obligations.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Things you have to keep doing</h3>
          <ul className="space-y-2 text-sm">
            {guide.obligations.map((o) => (
              <li key={o.label} className="rounded-md border p-3">
                <p className="font-medium">
                  {o.label} — {o.cadence}
                </p>
                <p className="text-muted-foreground pt-0.5">{o.detail}</p>
                <Citation text={o.citation} />
                {o.sourceUrl ? (
                  <a
                    href={o.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-block pt-1 text-xs underline"
                  >
                    Source
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
