import type { MetadataRoute } from "next";

import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

/**
 * The public surface of the marketplace.
 *
 * Live storefronts only: `is_paused = false` is both the RLS predicate ("seller_profiles: public
 * read live") and the filter here, so a paused seller — whether paused for a lapsed licence, a
 * revenue cap or an admin action — is never advertised to a crawler while their page 404s.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
  ];

  const supabase = await createClient();
  const { data: sellers } = await supabase
    .from("seller_profiles")
    .select("storefront_slug, updated_at")
    .eq("is_paused", false)
    .order("updated_at", { ascending: false })
    .limit(5000);

  const storefronts: MetadataRoute.Sitemap = (sellers ?? []).map((s) => ({
    url: `${base}/s/${s.storefront_slug}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : undefined,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticRoutes, ...storefronts];
}
