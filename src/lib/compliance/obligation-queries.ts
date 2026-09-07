import "server-only";

import { createClient } from "@/lib/supabase/server";
import { nextDue, type ObligationRule } from "@/lib/compliance/obligations";

/**
 * The recurring duties this seller's programme puts on them, and when each is next due.
 *
 * Only for a seller who has chosen a programme. Without a choice we do not know which route they
 * are on — Utah runs three and Vermont four, with different duties — and showing a deadline that is
 * not theirs is worse than showing none.
 */

export interface SellerObligation extends ObligationRule {
  dueDate: string;
  daysOut: number;
  periodKey: string;
  /** When they last marked this done, or null. */
  lastCompletedAt: string | null;
}

export async function getSellerObligations(sellerId: string): Promise<SellerObligation[]> {
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("id, food_program_id, created_at")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller?.food_program_id) return [];

  const [{ data: rows }, { data: completions }] = await Promise.all([
    supabase
      .from("program_obligations")
      .select(
        "id, kind, label, detail, citation, source_url, schedule, due_month, due_day, interval_months",
      )
      .eq("program_id", seller.food_program_id),
    supabase
      .from("seller_obligation_completions")
      .select("obligation_id, completed_at")
      .eq("seller_id", sellerId)
      .order("completed_at", { ascending: false }),
  ]);
  if (!rows?.length) return [];

  const today = new Date().toISOString().slice(0, 10);
  const startedOn = seller.created_at.slice(0, 10);
  const lastByObligation = new Map<string, string>();
  for (const c of completions ?? []) {
    if (!lastByObligation.has(c.obligation_id)) lastByObligation.set(c.obligation_id, c.completed_at);
  }

  const out: SellerObligation[] = [];
  for (const row of rows) {
    const rule: ObligationRule = {
      id: row.id,
      kind: row.kind,
      label: row.label,
      detail: row.detail,
      citation: row.citation,
      sourceUrl: row.source_url,
      schedule: row.schedule as ObligationRule["schedule"],
      dueMonth: row.due_month,
      dueDay: row.due_day,
      intervalMonths: row.interval_months,
    };
    const last = lastByObligation.get(row.id) ?? null;
    const occurrence = nextDue(rule, today, last?.slice(0, 10) ?? null, startedOn);
    if (!occurrence) continue;
    out.push({ ...rule, ...occurrence, lastCompletedAt: last });
  }

  // Soonest first — a seller reading this page wants the next thing, not an alphabetical list.
  return out.sort((a, b) => a.daysOut - b.daysOut);
}
