import { CheckCircle2, Circle } from "lucide-react";

import type { FulfillmentType, OrderStatus, OrderStatusHistory } from "@/lib/db/types";
import { ORDER_STATUS_LABELS, pipelineFor } from "@/lib/orders/status";

/**
 * The pipeline as a checklist (New → … → Completed) plus the raw audit trail from
 * `order_status_history`.
 */
export function OrderStatusTimeline({
  status,
  fulfillment,
  history,
}: {
  status: OrderStatus;
  fulfillment: FulfillmentType;
  history: OrderStatusHistory[];
}) {
  const cancelled = status === "cancelled";
  const steps = pipelineFor(fulfillment);
  const currentIndex = steps.indexOf(status);

  return (
    <div className="space-y-4">
      {cancelled ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          This order was cancelled.
        </p>
      ) : (
        <ol className="space-y-2">
          {steps.map((step, i) => {
            const done = currentIndex >= 0 && i <= currentIndex;
            return (
              <li key={step} className="flex items-center gap-2 text-sm">
                {done ? (
                  <CheckCircle2 className="size-4 text-green-600" />
                ) : (
                  <Circle className="text-muted-foreground size-4" />
                )}
                <span className={done ? "font-medium" : "text-muted-foreground"}>
                  {ORDER_STATUS_LABELS[step]}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {history.length > 0 ? (
        <div className="border-t pt-3">
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            History
          </p>
          <ul className="space-y-1.5">
            {history.map((h) => (
              <li key={h.id} className="text-muted-foreground flex justify-between gap-4 text-xs">
                <span>
                  {ORDER_STATUS_LABELS[h.to_status as OrderStatus] ?? h.to_status}
                  {h.note ? ` — ${h.note}` : ""}
                  {h.changed_by ? "" : " (system)"}
                </span>
                <time dateTime={h.created_at} className="shrink-0 tabular-nums">
                  {new Date(h.created_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
