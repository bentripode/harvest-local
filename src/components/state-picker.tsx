"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { US_STATES, stateName } from "@/lib/geo/state";
import { setBuyerStateAction, type StateFormState } from "@/app/(shop)/checkout/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

/** Buyers self-select their state; Harvest only shows in-state sellers and blocks cross-state orders. */
export function StatePicker({ current }: { current?: string | null }) {
  const [state, action] = useActionState<StateFormState, FormData>(setBuyerStateAction, {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="state">Your state</Label>
        <select
          id="state"
          name="state"
          defaultValue={current ?? ""}
          required
          className="border-input bg-transparent h-8 rounded-lg border px-2.5 text-sm"
        >
          <option value="" disabled>
            Select a state
          </option>
          {US_STATES.map((s) => (
            <option key={s} value={s}>
              {stateName(s)}
            </option>
          ))}
        </select>
      </div>
      <Submit />
      {state.error ? <p className="text-destructive w-full text-sm">{state.error}</p> : null}
    </form>
  );
}
