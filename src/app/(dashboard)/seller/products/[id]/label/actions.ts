"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

/**
 * Record what went on the jars.
 *
 * Called when the seller presses print, not before: an abandoned preview is not a batch. The label
 * text is stored as rendered rather than re-derived later, because the state's rule can change
 * underneath it — this pass replaced Vermont's entire rule set and corrected four disclaimers, and a
 * label reconstructed from today's rule would be one that was never printed.
 */

const schema = z.object({
  productId: z.string().uuid(),
  productionDate: z.string().max(40).nullable(),
  lotCode: z.string().max(120).nullable(),
  expirationDate: z.string().max(40).nullable(),
  copies: z.number().int().min(1).max(1000),
  lines: z.array(
    z.object({
      element: z.string(),
      caption: z.string().nullable(),
      value: z.string(),
    }),
  ),
  disclaimer: z.string().nullable(),
  programName: z.string().nullable(),
});

export interface PrintRunState {
  ok?: boolean;
  error?: string;
}

export async function recordPrintRunAction(input: unknown): Promise<PrintRunState> {
  const { user } = await requireRole("seller");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Could not record that print run." };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!seller) return { error: "Finish onboarding first." };

  // A blank date string is an empty form field, not a date.
  const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

  const { error } = await supabase.from("label_print_runs").insert({
    seller_id: seller.id,
    product_id: d.productId,
    production_date: day(d.productionDate),
    lot_code: d.lotCode?.trim() || null,
    expiration_date: day(d.expirationDate),
    copies: d.copies,
    lines: d.lines,
    disclaimer: d.disclaimer,
    program_name: d.programName,
  });
  // A failure here must never stop the seller printing — the label is the point and the log is the
  // bookkeeping. It is reported, not thrown.
  if (error) return { error: error.message };

  return { ok: true };
}
