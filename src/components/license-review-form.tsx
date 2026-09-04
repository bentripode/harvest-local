"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviewLicenseAction, type LicenseReviewState } from "@/app/admin/actions";

/**
 * Verify / reject one license. The note is optional on a verification and required on a rejection
 * (the action enforces it) — it's the only explanation the seller gets.
 */
export function LicenseReviewForm({ licenseId }: { licenseId: string }) {
  const [state, action] = useActionState<LicenseReviewState, FormData>(reviewLicenseAction, {});

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="licenseId" value={licenseId} />
      <Textarea
        name="note"
        rows={2}
        maxLength={2000}
        placeholder="Note to the seller (required to reject — e.g. “the photo cuts off the expiry date”)"
        className="text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <SubmitButton status="verified" label="Verify" pendingLabel="Verifying…" />
        <SubmitButton status="rejected" label="Reject" pendingLabel="Rejecting…" variant="outline" />
      </div>
      {state.error ? <p className="text-destructive text-xs">{state.error}</p> : null}
    </form>
  );
}

function SubmitButton({
  status,
  label,
  pendingLabel,
  variant,
}: {
  status: "verified" | "rejected";
  label: string;
  pendingLabel: string;
  variant?: "outline";
}) {
  // `data` is the FormData in flight, so only the button that was actually clicked says "…ing".
  const { pending, data } = useFormStatus();
  const isThisOne = pending && data?.get("status") === status;
  return (
    <Button
      type="submit"
      name="status"
      value={status}
      size="sm"
      variant={variant}
      disabled={pending}
    >
      {isThisOne ? pendingLabel : label}
    </Button>
  );
}
