"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { setVacationAction, type VacationState } from "@/app/(dashboard)/seller/settings/vacation-actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * Close the shop for a season, or open it again.
 *
 * Only ever shown for the seller's own switch. A storefront closed for a compliance reason shows
 * that reason instead and no button — the fix for a lapsed licence is a licence, not a toggle, and
 * offering one here would suggest otherwise.
 */
export function VacationToggle({
  onVacation,
  pauseReason,
}: {
  onVacation: boolean;
  pauseReason: string | null;
}) {
  const [state, action] = useActionState<VacationState, FormData>(setVacationAction, {});

  const blockedByUs = !!pauseReason && pauseReason !== "vacation";

  if (blockedByUs) {
    return (
      <p className="text-muted-foreground text-sm">
        Your storefront is closed by us right now, so there&apos;s nothing to switch. See the
        compliance page for what to do about it.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm">
        {onVacation
          ? "Your storefront is closed. Buyers can still find it, read your reviews and follow you — they just can't order."
          : "Your storefront is open and taking orders."}
      </p>
      <form action={action}>
        <input type="hidden" name="on" value={onVacation ? "false" : "true"} />
        <Submit label={onVacation ? "Open my storefront" : "Close for now"} />
      </form>
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      <p className="text-muted-foreground text-xs">
        Closing doesn&apos;t cancel your subscription or delete anything. Your link keeps working.
      </p>
    </div>
  );
}
