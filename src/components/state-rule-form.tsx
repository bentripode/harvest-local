"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveStateRuleAction, type StateRuleState } from "@/app/admin/actions";
import type { StateRule } from "@/lib/admin/state-rules";

/**
 * One state's rules. Saving stamps `verified_at` — the admin is asserting these are the real
 * numbers, so the button says so rather than "Save".
 */
export function StateRuleForm({ rule }: { rule: StateRule }) {
  const [state, action] = useActionState<StateRuleState, FormData>(saveStateRuleAction, {});

  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[9rem_auto_1fr_auto] sm:items-center">
      <input type="hidden" name="stateCode" value={rule.stateCode} />

      <label className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">$</span>
        <Input
          name="revenueCap"
          type="number"
          step="0.01"
          min="0"
          defaultValue={rule.revenueCap ?? ""}
          placeholder="no cap"
          className="h-8"
          aria-label={`${rule.stateCode} annual gross revenue cap in dollars`}
        />
      </label>

      <label className="flex items-center gap-2 text-sm whitespace-nowrap">
        <input
          type="checkbox"
          name="requiresLicense"
          value="true"
          defaultChecked={rule.requiresLicense}
          className="size-4"
        />
        Licence required
      </label>

      <Input
        name="notes"
        maxLength={2000}
        defaultValue={rule.notes ?? ""}
        placeholder="Source / citation for these figures"
        className="h-8 text-sm"
        aria-label={`${rule.stateCode} notes`}
      />

      <div className="flex items-center gap-2">
        <SubmitButton verified={!!rule.verifiedAt} />
        {state.error ? <span className="text-destructive text-xs">{state.error}</span> : null}
      </div>
    </form>
  );
}

function SubmitButton({ verified }: { verified: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={verified ? "outline" : "default"} disabled={pending}>
      {pending ? "Saving…" : verified ? "Save" : "Save & verify"}
    </Button>
  );
}
