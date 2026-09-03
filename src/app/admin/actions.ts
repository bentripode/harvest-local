"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function updateReportAction(formData: FormData): Promise<void> {
  const { user } = await requireRole("admin");

  const parsed = z
    .object({
      reportId: z.string().uuid(),
      status: z.enum(["open", "investigating", "resolved", "refunded"]),
      resolutionNote: z.string().trim().max(2000).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { reportId, status, resolutionNote } = parsed.data;

  const terminal = status === "resolved" || status === "refunded";
  const supabase = await createClient();
  await supabase
    .from("reports")
    .update({
      status,
      resolution_note: resolutionNote || null,
      resolved_by: terminal ? user.id : null,
      resolved_at: terminal ? new Date().toISOString() : null,
    })
    .eq("id", reportId);

  revalidatePath("/admin");
}
