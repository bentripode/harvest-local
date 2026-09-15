"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { US_STATES, stateName } from "@/lib/geo/state";
import { setBrowseStateAction, type StateFormState } from "@/app/(shop)/shop/actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * Buyers self-select their state; Harvest only shows in-state sellers and blocks cross-state
 * orders. Works signed out — the action writes a cookie for guests, and `profiles.home_state` as
 * well once there is an account to write it to.
 */
export function StatePicker({
  current,
  submitLabel = "Save",
  hideLabel = false,
}: {
  current?: string | null;
  submitLabel?: string;
  hideLabel?: boolean;
}) {
  const [state, action] = useActionState<StateFormState, FormData>(setBrowseStateAction, {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="state" className={hideLabel ? "sr-only" : undefined}>
          Your state
        </Label>
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
      <Submit label={submitLabel} />
      {state.error ? <p className="text-destructive w-full text-sm">{state.error}</p> : null}
    </form>
  );
}
