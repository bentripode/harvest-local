import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

/**
 * Everything a signed-out visitor can legitimately see is crawlable; everything behind a session
 * is not. The disallow list mirrors the protected prefixes in `src/proxy.ts` plus the buyer's own
 * account pages — those redirect to /login anyway, and a crawler shouldn't spend budget finding
 * that out.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/seller",
          "/admin",
          "/checkout",
          "/orders",
          "/messages",
          "/account",
          "/saved",
          "/cart",
          "/reports",
          "/api/",
          "/auth/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
