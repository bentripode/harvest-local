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
    { url: `${base}/markets`, changeFrequency: "weekly", priority: 0.7 },
  ];

  const supabase = await createClient();
  const [{ data: sellers }, { data: markets }] = await Promise.all([
    supabase
      .from("seller_profiles")
      .select("storefront_slug, updated_at")
      .eq("is_paused", false)
      .order("updated_at", { ascending: false })
      .limit(5000),
    // Market pages are the directory's public surface and exist whether or not a seller is there
    // yet, so they belong here from day one. RLS already hides anything not `published`.
    supabase
      .from("markets")
      .select("slug, state, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20000),
  ]);

  const storefronts: MetadataRoute.Sitemap = (sellers ?? []).map((s) => ({
    url: `${base}/s/${s.storefront_slug}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : undefined,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const seenStates = new Set<string>();
  const statePages: MetadataRoute.Sitemap = [];
  const marketPages: MetadataRoute.Sitemap = (markets ?? []).map((m) => {
    const state = m.state.toLowerCase();
    if (!seenStates.has(state)) {
      seenStates.add(state);
      statePages.push({
        url: `${base}/markets/${state}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    return {
      url: `${base}/markets/${state}/${m.slug}`,
      lastModified: m.updated_at ? new Date(m.updated_at) : undefined,
      changeFrequency: "weekly",
      priority: 0.5,
    };
  });

  return [...staticRoutes, ...storefronts, ...statePages, ...marketPages];
}
