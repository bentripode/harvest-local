import type { OnlineVerdict } from "@/lib/compliance/guide-format";

/**
 * The honesty furniture for the public guide.
 *
 * Every claim on these pages is our reading of a statute, and `verified_at` is null on essentially
 * every row — so a page that renders a confident yes/no without saying where it came from is
 * asserting more than the data supports. These components make the provenance impossible to omit:
 * the source link, the date we read it, and whether a person has checked it.
 */

const VERDICT_STYLE: Record<OnlineVerdict, { label: string; className: string }> = {
  allowed: {
    label: "Allowed",
    className: "border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  },
  banned: {
    label: "Not allowed",
    className: "border-red-600/40 bg-red-600/10 text-red-800 dark:text-red-300",
  },
  // Missing data, not a soft no. Nothing in the app blocks on `unclear`, and neither does the copy.
  unclear: {
    label: "The law doesn't say",
    className: "border-amber-600/40 bg-amber-600/10 text-amber-800 dark:text-amber-300",
  },
  mixed: {
    label: "Depends which programme",
    className: "border-sky-600/40 bg-sky-600/10 text-sky-800 dark:text-sky-300",
  },
};

export function VerdictBadge({ verdict }: { verdict: OnlineVerdict }) {
  const { label, className } = VERDICT_STYLE[verdict];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Where a claim came from and how much weight to put on it. `verifiedAt` null is stated outright:
 * the verification pass found seeded rows wrong in both directions, so "nobody has checked this"
 * is the single most useful thing we can tell a reader who might be relying on it.
 */
export function Provenance({
  sourceUrl,
  sourceCheckedAt,
  verifiedAt,
  className = "",
}: {
  sourceUrl: string | null;
  sourceCheckedAt: string | null;
  verifiedAt: string | null;
  className?: string;
}) {
  const read = formatDate(sourceCheckedAt);
  const verified = formatDate(verifiedAt);

  return (
    <p className={`text-muted-foreground text-xs ${className}`}>
      {sourceUrl ? (
        <>
          <a href={sourceUrl} target="_blank" rel="noreferrer noopener" className="underline">
            Read the source
          </a>
          {read ? ` · we read it ${read}` : null}
        </>
      ) : (
        <span>No source recorded for this row.</span>
      )}
      {" · "}
      {verified ? (
        <span>Checked by our team {verified}.</span>
      ) : (
        <span className="font-medium">
          Not yet signed off — this is our reading, not the state&apos;s words about us.
        </span>
      )}
    </p>
  );
}

/** Quoted statute. Rendered as a quote so it is visibly the law's words rather than ours. */
export function Citation({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <blockquote className="text-muted-foreground border-l-2 py-0.5 pl-3 text-sm italic">
      {text}
    </blockquote>
  );
}

/**
 * Sitewide caveat. Deliberately not dismissible and not in a footer: the pages give a confident
 * answer to a legal question, and the one thing a reader must not take away is that we are their
 * regulator.
 */
export function LegalNotice() {
  return (
    <div className="bg-muted/50 rounded-lg border p-4 text-sm">
      <p className="font-medium">This is a summary, not legal advice.</p>
      <p className="text-muted-foreground pt-1">
        We read each state&apos;s statutes and rules ourselves and record what we found, with a link
        to the source on every claim. States amend these laws, our reading can be wrong, and your
        county or city may add rules on top. Check with your state or local health department before
        you start selling.
      </p>
    </div>
  );
}
