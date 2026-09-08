"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  savePreparationCountyAction,
  type PreparationCountyState,
} from "@/app/(dashboard)/seller/settings/actions";

/**
 * The county a seller's kitchen is in.
 *
 * Shown only where the state asks for one, which today is Colorado alone. The copy leads with the
 * change a seller will actually notice — a county on the label where a street address used to be —
 * rather than with the citation, because HB26-1033 amending 25-4-1614(3)(a)(II) means nothing to
 * somebody baking at home, and "your address no longer goes on the jar" means a great deal.
 */
export function PreparationCountyForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState<PreparationCountyState, FormData>(
    savePreparationCountyAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="preparationCounty">County where you prepare your food</Label>
        <Input
          id="preparationCounty"
          name="preparationCounty"
          maxLength={120}
          defaultValue={initial}
          placeholder="e.g. Boulder"
        />
        <p className="text-muted-foreground text-xs">
          Your state asks for the county your kitchen is in, and it goes on the label in place of
          your street address. Just the county name — we print it exactly as you type it.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save county"}
        </Button>
        {state.ok ? <span className="text-muted-foreground text-sm">Saved.</span> : null}
        {state.error ? <span className="text-destructive text-sm">{state.error}</span> : null}
      </div>
    </form>
  );
}
