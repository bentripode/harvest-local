import type { NextConfig } from "next";

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

export default nextConfig;
