import * as Sentry from "@sentry/nextjs";

import { env } from "@/lib/env";

/**
 * Server-side Sentry init (Node runtime). Loaded from `instrumentation.ts`'s `register()`.
 * Inert when `SENTRY_DSN` is unset — the app runs identically without it.
 */
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? env.NODE_ENV,
    // Sample a slice of traces for performance; errors are always sent.
    tracesSampleRate: 0.1,
    // Webhook payloads and server-action inputs carry buyer PII and payment data — never
    // let Sentry attach request bodies, cookies, or user IP by default.
    sendDefaultPii: false,
  });
}
