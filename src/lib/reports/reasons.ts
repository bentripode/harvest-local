/** Report reasons — shared by the form, the admin queue, and notification copy. */
export const REPORT_REASONS = {
  not_received: "Order never arrived / wasn't ready",
  not_as_described: "Not as described",
  damaged: "Damaged or spoiled",
  payment: "Payment or pricing issue",
  conduct: "Seller / buyer conduct",
  other: "Something else",
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

export const REPORT_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  investigating: "Investigating",
  resolved: "Resolved",
  refunded: "Refunded",
};
