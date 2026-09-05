import type { ProductDisclosure } from "@/lib/labels/disclosure";

/**
 * The label, shown to the buyer before they pay.
 *
 * Where a state requires this it is a legal disclosure, not a nicety — so it renders inline and
 * legible rather than behind a toggle a buyer would never open. Texas asks for a "legible
 * statement"; a collapsed accordion is not that.
 */
export function LabelDisclosure({
  disclosure,
  className,
}: {
  disclosure: ProductDisclosure | undefined;
  className?: string;
}) {
  if (!disclosure?.required) return null;
  if (disclosure.lines.length === 0 && !disclosure.disclaimer) return null;

  return (
    <div className={`bg-muted/40 rounded-md border p-3 text-xs ${className ?? ""}`}>
      <p className="text-muted-foreground mb-1.5 font-medium">Product label</p>
      <dl className="space-y-1">
        {disclosure.lines.map((line, i) => (
          <div key={i} className="flex flex-wrap gap-x-1.5">
            {line.caption ? (
              <dt className="text-muted-foreground">{line.caption}:</dt>
            ) : null}
            <dd className={line.caption ? "" : "font-medium"}>{line.value}</dd>
          </div>
        ))}
      </dl>
      {disclosure.disclaimer ? (
        <p
          className="mt-2 border-t pt-2"
          style={{ textTransform: disclosure.disclaimerAllCaps ? "uppercase" : "none" }}
        >
          {disclosure.disclaimer}
        </p>
      ) : null}
    </div>
  );
}
