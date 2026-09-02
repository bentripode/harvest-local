"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { nextStatuses, transitionLabel } from "@/lib/orders/status";
import type { FulfillmentType, OrderStatus } from "@/lib/db/types";
import {
  advanceOrderStatusAction,
  type AdvanceState,
} from "@/app/(dashboard)/seller/orders/actions";

function Action({ to, destructive }: { to: OrderStatus; destructive?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="toStatus"
      value={to}
      size="sm"
      variant={destructive ? "destructive" : "default"}
      disabled={pending}
    >
      {transitionLabel(to)}
    </Button>
  );
}

export function OrderActions({
  orderId,
  status,
  fulfillment,
}: {
  orderId: string;
  status: OrderStatus;
  fulfillment: FulfillmentType;
}) {
  const [state, action] = useActionState<AdvanceState, FormData>(advanceOrderStatusAction, {});
  const options = nextStatuses(status, fulfillment);

  if (options.length === 0) {
    return <p className="text-muted-foreground text-sm">No further actions.</p>;
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex flex-wrap gap-2">
        {options.map((to) => (
          <Action key={to} to={to} destructive={to === "cancelled"} />
        ))}
      </div>
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
    </form>
  );
}
