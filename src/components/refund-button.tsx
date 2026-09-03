"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { issueRefundAction, type RefundState } from "@/app/admin/actions";

export function RefundButton({
  orderId,
  reportId,
  amountLabel,
}: {
  orderId: string;
  reportId?: string;
  amountLabel: string;
}) {
  const [state, action] = useActionState<RefundState, FormData>(issueRefundAction, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Refund ${amountLabel} to the buyer and pull it back from the seller?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      {reportId ? <input type="hidden" name="reportId" value={reportId} /> : null}
      <SubmitButton amountLabel={amountLabel} />
      {state.error ? <p className="text-destructive mt-1 text-xs">{state.error}</p> : null}
    </form>
  );
}

function SubmitButton({ amountLabel }: { amountLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="destructive" disabled={pending}>
      {pending ? "Refunding…" : `Refund ${amountLabel}`}
    </Button>
  );
}
