import type { ComplianceBlock } from "@/lib/compliance/blocks";

/**
 * A refusal, with the words behind it.
 *
 * The seller gets three things: what happened, the text of the rule it rests on, and a link to the
 * source so they can read it themselves. The last line is the important one — almost no row in
 * `state_food_programs` has been signed off by a person yet, and a seller who knows their own
 * state's rules is the fastest way for us to find out when we have it wrong.
 */
export function ComplianceBlockNotice({ block }: { block: ComplianceBlock }) {
  return (
    <div className="border-destructive/40 bg-destructive/5 space-y-3 rounded-md border p-4">
      <p className="text-destructive text-sm font-medium">{block.message}</p>

      {block.citation ? (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            What the rule says
          </p>
          <blockquote className="text-muted-foreground border-muted-foreground/30 border-l-2 pl-3 text-sm">
            {block.citation}
          </blockquote>
        </div>
      ) : null}

      <div className="text-muted-foreground space-y-1 text-xs">
        {block.programName ? <p>Programme: {block.programName}</p> : null}
        {block.sourceUrl ? (
          <p>
            <a
              href={block.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Read the source
            </a>
            {block.sourceCheckedAt ? <> — we last read it on {block.sourceCheckedAt}.</> : null}
          </p>
        ) : null}
        <p>
          {block.verified
            ? "An administrator has checked this rule against the state's own text."
            : "This rule has not yet been checked by an administrator against the state's own text. If you believe it is wrong for your situation, tell us — with the citation above, it is quick to settle."}
        </p>
      </div>
    </div>
  );
}

/**
 * The same information at a lower temperature.
 *
 * Used where the state has not answered a question rather than answered it against the seller —
 * `direct_delivery = 'unclear'` on 29 of the seeded programmes, because whether a doorstep is a
 * permitted place to sell is a question most sources simply do not address. Nothing is blocked, so
 * the styling must not read as a refusal; what the seller needs is the open question and the source.
 */
export function ComplianceCautionNotice({ block }: { block: ComplianceBlock }) {
  return (
    <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <p className="text-sm font-medium">{block.message}</p>

      {block.citation ? (
        <blockquote className="border-l-2 border-amber-400 pl-3 text-sm">
          {block.citation}
        </blockquote>
      ) : null}

      <div className="space-y-1 text-xs">
        {block.programName ? <p>Programme: {block.programName}</p> : null}
        {block.sourceUrl ? (
          <p>
            <a
              href={block.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Read the source
            </a>
            {block.sourceCheckedAt ? <> — we last read it on {block.sourceCheckedAt}.</> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
