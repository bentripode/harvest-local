"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUsd, toCents } from "@/lib/money";
import { issueRefundAction, type RefundState } from "@/app/admin/actions";

export function RefundButton({
  orderId,
  reportId,
  orderTotal,
}: {
  orderId: string;
  reportId?: string;
  /** Order total as a decimal string (Postgres numeric). */
  orderTotal: string;
}) {
  const [state, action] = useActionState<RefundState, FormData>(issueRefundAction, {});
  const total = Number(orderTotal);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const amount = (e.currentTarget.elements.namedItem("amount") as HTMLInputElement)?.value;
        const label = amount ? formatUsd(toCents(amount)) : formatUsd(toCents(orderTotal));
        if (!confirm(`Refund ${label} to the buyer and pull it back from the seller?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      {reportId ? <input type="hidden" name="reportId" value={reportId} /> : null}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">$</span>
        <Input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          max={total.toFixed(2)}
          defaultValue={total.toFixed(2)}
          className="h-8 w-28"
          aria-label="Refund amount in dollars"
        />
        <SubmitButton total={formatUsd(toCents(orderTotal))} />
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        The full total is a full refund (cancels the order); a smaller amount is a partial refund.
      </p>
      {state.error ? <p className="text-destructive mt-1 text-xs">{state.error}</p> : null}
    </form>
  );
}

function SubmitButton({ total }: { total: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="destructive" disabled={pending}>
      {pending ? "Refunding…" : `Refund (up to ${total})`}
    </Button>
  );
}
