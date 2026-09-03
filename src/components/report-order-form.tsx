"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitReportAction, type ReportFormState } from "@/app/reports/actions";
import { REPORT_REASONS, REPORT_STATUS_LABELS } from "@/lib/reports/reasons";

export function ReportOrderForm({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ReportFormState, FormData>(submitReportAction, {});

  if (state.ok) {
    return <p className="text-sm text-green-600">Report filed — we&apos;ll look into it.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground text-sm underline"
      >
        Report a problem with this order
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="space-y-1.5">
        <label htmlFor="reason" className="text-sm font-medium">
          What went wrong?
        </label>
        <select
          id="reason"
          name="reason"
          required
          defaultValue=""
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        >
          <option value="" disabled>
            Choose a reason
          </option>
          {Object.entries(REPORT_REASONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Textarea name="description" rows={3} maxLength={2000} placeholder="Details (optional)" />
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      <div className="flex gap-2">
        <SubmitButton />
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "Filing…" : "File report"}
    </Button>
  );
}

export function ExistingReport({
  report,
}: {
  report: { reason: string; status: string; description: string | null; resolution_note: string | null };
}) {
  return (
    <div className="space-y-1 text-sm">
      <p>
        You reported this order:{" "}
        <span className="font-medium">
          {REPORT_REASONS[report.reason as keyof typeof REPORT_REASONS] ?? report.reason}
        </span>{" "}
        · <span className="text-muted-foreground">{REPORT_STATUS_LABELS[report.status] ?? report.status}</span>
      </p>
      {report.description ? (
        <p className="text-muted-foreground">{report.description}</p>
      ) : null}
      {report.resolution_note ? (
        <p className="rounded-md border bg-muted/40 p-2">
          <span className="font-medium">Resolution:</span> {report.resolution_note}
        </p>
      ) : null}
    </div>
  );
}
