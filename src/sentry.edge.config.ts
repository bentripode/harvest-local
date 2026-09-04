import * as Sentry from "@sentry/nextjs";

import { env } from "@/lib/env";

/**
 * Edge-runtime Sentry init (proxy / any edge routes). Loaded from `instrumentation.ts`.
 * Inert when `SENTRY_DSN` is unset.
 */
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
