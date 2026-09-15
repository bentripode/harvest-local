"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * A block of suggested text the seller can edit and copy.
 *
 * Editable rather than read-only on purpose: a template is a starting point, and a seller who wants
 * to change one word should not have to paste it somewhere else to do it. The edit is local — there
 * is nothing to save, because nothing here belongs to the app.
 *
 * The clipboard can fail (an insecure origin, a browser that refuses it without a gesture it
 * recognises), so the failure path tells the seller to select and copy by hand rather than leaving
 * a button that silently does nothing.
 */
export function CopyBox({ text, label }: { text: string; label: string }) {
  const [value, setValue] = useState(text);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied.");
    } catch {
      toast.error("Couldn't copy — select the text and copy it by hand.");
    }
  }

  const changed = value !== text;

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={Math.min(10, value.split("\n").length + 1)}
        aria-label={label}
        className="text-sm"
      />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          Copy
        </Button>
        {changed ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setValue(text)}>
            Reset
          </Button>
        ) : null}
      </div>
    </div>
  );
}
