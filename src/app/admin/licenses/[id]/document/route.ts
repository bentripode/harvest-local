import { NextResponse } from "next/server";
import { z } from "zod";

import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * `GET /admin/licenses/<id>/document` — redirect to a short-lived signed URL for the license
 * document, so an admin can actually look at what they're verifying.
 *
 * `seller-docs` is a private bucket whose only `storage.objects` policy is owner-folder-scoped, so
 * the service-role client is the sole way to read another user's document. That makes the admin
 * check **in this handler** the only gate: route handlers don't run the `/admin` layout, so its
 * `requireRole("admin")` does not cover this path.
 */

const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getProfile();
  // 404, not 403 — don't confirm the id exists to anyone who isn't an admin.
  if (profile?.role !== "admin") return new NextResponse("Not found", { status: 404 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createAdminClient();
  const { data: license } = await admin
    .from("seller_licenses")
    .select("document_path")
    .eq("id", id)
    .maybeSingle();
  if (!license?.document_path) {
    return new NextResponse("No document on file for this license.", { status: 404 });
  }

  const { data, error } = await admin.storage
    .from("seller-docs")
    .createSignedUrl(license.document_path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    console.error("[admin] createSignedUrl failed:", error);
    return new NextResponse("Could not open the document.", { status: 500 });
  }

  // no-store so the signed URL never lands in a shared cache; it outlives this redirect by <60s.
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
