import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  // Reaching `npm run dev` from a phone means the browser's origin is this machine's LAN address,
  // not localhost — and Next refuses cross-origin dev requests (HMR, server actions, /_next assets)
  // from an origin it was not told about. The private ranges are listed rather than a single
  // address because DHCP moves it.
  //
  // Dev only: `next build` ignores this, so it widens nothing in production.
  allowedDevOrigins: ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12", "*.local"],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      ...(supabaseHost
        ? [
            {
              protocol: supabaseHost === "127.0.0.1" || supabaseHost === "localhost" ? "http" : "https",
              hostname: supabaseHost,
              port: supabaseHost === "127.0.0.1" || supabaseHost === "localhost" ? "54321" : "",
              pathname: "/storage/v1/object/public/**",
            } as const,
          ]
        : []),
    ],
  },
};

// Wraps the config to instrument the build and (when SENTRY_AUTH_TOKEN + org/project are set)
// upload source maps. With none of the Sentry env vars set it's a near no-op — the build still
// works and runtime Sentry stays inert (see src/sentry.*.config.ts).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps when we have a token (CI/prod); silent locally.
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // No auth token → the plugin skips the upload step instead of failing the build.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
