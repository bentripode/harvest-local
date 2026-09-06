"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  saveHomemadeStatementAction,
  type HomemadeStatementState,
} from "@/app/(dashboard)/seller/settings/actions";

/**
 * The seller's own wording for a disclosure their state prescribes by substance.
 *
 * Four states (LA, MO, MT, NE) say what the buyer must be told and leave the sentence to the
 * producer. We show them the statute's words and take theirs — composing one for them would put our
 * prose where quoted law belongs, and none of us can judge whether a given sentence "clearly
 * indicates" what Louisiana wants.
 */
export function HomemadeStatementForm({
  prompt,
  initial,
}: {
  prompt: string;
  initial: string;
}) {
  const [state, action, pending] = useActionState<HomemadeStatementState, FormData>(
    saveHomemadeStatementAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="statement">Your statement</Label>
        <textarea
          id="statement"
          name="statement"
          rows={3}
          maxLength={500}
          defaultValue={initial}
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          placeholder="e.g. Not produced in a licensed or regulated facility."
        />
        <p className="text-muted-foreground text-xs">
          Your state prescribes what this has to say but not the words. It must be {prompt}.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save statement"}
        </Button>
        {state.ok ? <span className="text-muted-foreground text-sm">Saved.</span> : null}
        {state.error ? <span className="text-destructive text-sm">{state.error}</span> : null}
      </div>
    </form>
  );
}
