import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RefundButton } from "@/components/refund-button";
import { getReportQueue } from "@/lib/reports/queries";
import { REPORT_REASONS, REPORT_STATUS_LABELS } from "@/lib/reports/reasons";
import { formatUsd, toCents } from "@/lib/money";
import { updateReportAction } from "./actions";

export const metadata = { title: "Reports — Admin" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  open: "destructive",
  investigating: "secondary",
  resolved: "default",
  refunded: "default",
};

export default async function AdminReportsPage() {
  const reports = await getReportQueue();
  const open = reports.filter((r) => r.status === "open" || r.status === "investigating");
  const closed = reports.filter((r) => r.status === "resolved" || r.status === "refunded");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm">
          Order disputes. Stripe refunds are issued from the order in the Stripe dashboard for now.
        </p>
      </div>

      <Section title={`Open (${open.length})`} reports={open} />
      {closed.length > 0 ? <Section title="Closed" reports={closed} closed /> : null}
    </div>
  );
}

function Section({
  title,
  reports,
  closed,
}: {
  title: string;
  reports: Awaited<ReturnType<typeof getReportQueue>>;
  closed?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {reports.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing here.</p>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => (
            <li key={r.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[r.status]}>
                      {REPORT_STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                    <span className="text-sm font-medium">
                      {REPORT_REASONS[r.reason as keyof typeof REPORT_REASONS] ?? r.reason}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {r.reporterName} ({r.reporterRole}) vs {r.counterpartyName} · order{" "}
                    <span className="font-mono">{r.orderRef}</span> ·{" "}
                    {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </p>
                </div>
              </div>

              {r.description ? <p className="mt-2 text-sm">{r.description}</p> : null}
              {r.resolutionNote ? (
                <p className="text-muted-foreground mt-2 rounded-md border bg-muted/40 p-2 text-sm">
                  <span className="font-medium">Resolution:</span> {r.resolutionNote}
                </p>
              ) : null}
              {r.refundAmount ? (
                <p className="mt-2 text-sm text-green-700">
                  {toCents(r.refundAmount) < toCents(r.orderTotal) ? "Partially refunded" : "Refunded"}{" "}
                  {formatUsd(toCents(r.refundAmount))}
                </p>
              ) : null}

              {!closed ? (
                <div className="mt-3 space-y-3">
                  <form action={updateReportAction} className="space-y-2">
                    <input type="hidden" name="reportId" value={r.id} />
                    <Textarea
                      name="resolutionNote"
                      rows={2}
                      maxLength={2000}
                      defaultValue={r.resolutionNote ?? ""}
                      placeholder="Resolution note (shown to the reporter)"
                      className="text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      {(["investigating", "resolved"] as const).map((s) => (
                        <Button key={s} type="submit" name="status" value={s} size="sm" variant="outline">
                          Mark {REPORT_STATUS_LABELS[s].toLowerCase()}
                        </Button>
                      ))}
                    </div>
                  </form>
                  {!r.refundAmount ? (
                    <RefundButton orderId={r.orderId} reportId={r.id} orderTotal={r.orderTotal} />
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
