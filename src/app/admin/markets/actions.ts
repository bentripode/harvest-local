"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkLogoUpload, logoStoragePath } from "@/lib/markets/logo";

/**
 * Market pictures, set by hand. The `market-images` bucket has no write policy — only the service
 * role writes it — so these use the admin client, and only after `requireRole("admin")`: a Server
 * Action is reachable by direct POST, whatever the page around it shows.
 */

const BUCKET = "market-images";
const marketId = z.string().uuid();

export type LogoState = { ok?: boolean; error?: string; imageUrl?: string | null };

function revalidateMarket(state: string, slug: string) {
  revalidatePath("/admin/markets");
  revalidatePath("/markets");
  revalidatePath(`/markets/${state.toLowerCase()}`);
  revalidatePath(`/markets/${state.toLowerCase()}/${slug}`);
}

export async function uploadMarketLogoAction(formData: FormData): Promise<LogoState> {
  await requireRole("admin");

  const id = marketId.safeParse(formData.get("marketId"));
  if (!id.success) return { error: "Unknown market." };
  const file = formData.get("logo");
  if (!(file instanceof File)) return { error: "Choose a picture first." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const source = formData.get("sourceUrl");
  const check = checkLogoUpload(bytes, typeof source === "string" ? source : null);
  if (!check.ok) return { error: check.error };

  const db = createAdminClient();
  const { data: market } = await db
    .from("markets")
    .select("id, state, slug")
    .eq("id", id.data)
    .maybeSingle();
  if (!market) return { error: "Unknown market." };

  const path = logoStoragePath(market.state, market.slug);
  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  // Versioned by content, so the CDN does not keep serving the picture this one replaced.
  const v = createHash("sha1").update(bytes).digest("hex").slice(0, 10);
  const imageUrl = `${db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?v=${v}`;

  const { error } = await db
    .from("markets")
    .update({
      image_path: path,
      image_url: imageUrl,
      image_source_url: check.sourceUrl,
      image_source: "admin",
    })
    .eq("id", market.id);
  if (error) return { error: error.message };

  revalidateMarket(market.state, market.slug);
  return { ok: true, imageUrl };
}

/**
 * Take a market's picture down. A picture the scan copied from the market's site is also recorded
 * as rejected, so the next scan does not simply copy the same image back; if the site later
 * changes its picture, that one gets a fresh look.
 */
export async function removeMarketLogoAction(formData: FormData): Promise<LogoState> {
  await requireRole("admin");

  const id = marketId.safeParse(formData.get("marketId"));
  if (!id.success) return { error: "Unknown market." };

  const db = createAdminClient();
  const { data: market } = await db
    .from("markets")
    .select("id, state, slug, image_path, image_source, image_source_url")
    .eq("id", id.data)
    .maybeSingle();
  if (!market) return { error: "Unknown market." };

  if (market.image_path) await db.storage.from(BUCKET).remove([market.image_path]);

  const { error } = await db
    .from("markets")
    .update({
      image_path: null,
      image_url: null,
      image_source_url: null,
      image_source: null,
      ...(market.image_source === "website" && market.image_source_url
        ? { image_rejected_source_url: market.image_source_url }
        : {}),
    })
    .eq("id", market.id);
  if (error) return { error: error.message };

  revalidateMarket(market.state, market.slug);
  return { ok: true, imageUrl: null };
}
