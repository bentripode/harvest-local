"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateListingCopyAction } from "@/app/(dashboard)/seller/products/copy-actions";
import { screenCopy, isSafeToApply, type ClaimFinding } from "@/lib/ai/claims";
import type { CopyKind } from "@/lib/ai/prompt";

/**
 * A drafting assistant for listing copy.
 *
 * The shape of this component is the safety argument. A draft appears in an editable box, screened,
 * with every problem named — and the only way it reaches the listing is the seller pressing a button
 * that is disabled while a blocking claim stands. Editing re-screens on every keystroke, so a seller
 * who deletes "gluten-free" watches the warning go away, which teaches the rule better than a
 * refusal would.
 *
 * Nothing here auto-fills the description field. `onUse` hands the text to the product form, which
 * the seller still has to save.
 */

const KIND_COPY: Record<CopyKind, { button: string; heading: string; hint: string }> = {
  description: {
    button: "Draft a description",
    heading: "Suggested description",
    hint: "Two or three sentences, from what you've entered. Read it before you use it — it's a draft, not a fact-check.",
  },
  social: {
    button: "Draft a social post",
    heading: "Suggested post",
    hint: "Short enough for anywhere. Copy it out and post it yourself.",
  },
};

export function CopyAssistant({
  productId,
  kind,
  onUse,
}: {
  productId: string;
  kind: CopyKind;
  /** Given the accepted text. Omit for copy the seller pastes elsewhere, like a social post. */
  onUse?: (text: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const findings = draft ? screenCopy(draft) : [];
  const safe = isSafeToApply(findings);
  const meta = KIND_COPY[kind];

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateListingCopyAction(productId, kind);
      if (!result.ok) {
        setError(result.message);
        setDraft(null);
        return;
      }
      setDraft(result.text);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={generate} disabled={pending}>
          {pending ? "Writing…" : draft ? "Try another" : meta.button}
        </Button>
        {draft ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(null);
              setError(null);
            }}
          >
            Discard
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-muted-foreground text-sm">{error}</p> : null}

      {draft !== null ? (
        <div className="space-y-3 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">{meta.heading}</p>
            <p className="text-muted-foreground text-xs">{meta.hint}</p>
          </div>

          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={kind === "social" ? 3 : 4}
            aria-label={meta.heading}
          />

          <ClaimNotices findings={findings} />

          <div className="flex flex-wrap items-center gap-2">
            {onUse ? (
              <Button
                type="button"
                size="sm"
                disabled={!safe || draft.trim().length === 0}
                onClick={() => {
                  onUse(draft.trim());
                  toast.success("Put into the description — remember to save.");
                }}
              >
                Use this
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={!safe || draft.trim().length === 0}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(draft.trim());
                    toast.success("Copied.");
                  } catch {
                    toast.error("Couldn't copy — select the text and copy it by hand.");
                  }
                }}
              >
                Copy
              </Button>
            )}

            {!safe ? (
              <p className="text-muted-foreground text-xs">
                Edit the wording above to use this.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * What's wrong with the draft, in the seller's terms.
 *
 * Blocks first, then warnings — a seller should read what stops them before what merely nags. The
 * matched phrase is quoted so they can find it in the box above.
 */
function ClaimNotices({ findings }: { findings: ClaimFinding[] }) {
  if (findings.length === 0) return null;

  return (
    <ul className="space-y-2">
      {findings.map((f) => (
        <li
          key={`${f.category}:${f.match}`}
          className={`rounded-md border p-2 text-xs ${
            f.severity === "block" ? "border-destructive/40 bg-destructive/5" : "bg-muted/40"
          }`}
        >
          <span className="font-medium">
            {f.severity === "block" ? "Can't say " : "Maybe rethink "}“{f.match}”
          </span>{" "}
          — {f.why}
        </li>
      ))}
    </ul>
  );
}
