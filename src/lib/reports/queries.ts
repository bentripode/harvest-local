import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface AdminReport {
  id: string;
  orderId: string;
  orderRef: string;
  status: string;
  reason: string;
  description: string | null;
  reporterName: string;
  reporterRole: "buyer" | "seller";
  counterpartyName: string;
  resolutionNote: string | null;
  createdAt: string;
}

/** All reports, newest first — admin only (RLS enforces). */
export async function getReportQueue(): Promise<AdminReport[]> {
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("reports")
    .select(
      "id, order_id, reporter_id, status, reason, description, resolution_note, created_at, reporter:profiles!reports_reporter_id_fkey(display_name)",
    )
    .order("created_at", { ascending: false });
  if (!reports || reports.length === 0) return [];

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, buyer_id, buyer:profiles!orders_buyer_id_fkey(display_name), seller:seller_profiles!orders_seller_id_fkey(business_name)",
    )
    .in("id", [...new Set(reports.map((r) => r.order_id))]);

  const orderById = new Map((orders ?? []).map((o) => [o.id, o]));

  return reports.map((r) => {
    const o = orderById.get(r.order_id);
    const buyerName = (o?.buyer as { display_name?: string } | null)?.display_name ?? "Buyer";
    const sellerName = (o?.seller as { business_name?: string } | null)?.business_name ?? "Seller";
    const reporterIsBuyer = r.reporter_id === o?.buyer_id;
    return {
      id: r.id,
      orderId: r.order_id,
      orderRef: r.order_id.slice(0, 8),
      status: r.status,
      reason: r.reason,
      description: r.description,
      reporterName:
        (r.reporter as { display_name?: string } | null)?.display_name ?? "Someone",
      reporterRole: reporterIsBuyer ? "buyer" : "seller",
      counterpartyName: reporterIsBuyer ? sellerName : buyerName,
      resolutionNote: r.resolution_note,
      createdAt: r.created_at,
    };
  });
}

/** The signed-in party's own report for an order, if any. */
export async function getReportForOrder(orderId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("id, reason, status, description, resolution_note, created_at")
    .eq("order_id", orderId)
    .eq("reporter_id", userId)
    .maybeSingle();
  return data;
}
