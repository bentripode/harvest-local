import * as Sentry from "@sentry/nextjs";

/**
 * Client-side Sentry init. Runs after the document loads, before hydration.
 * Inert when `NEXT_PUBLIC_SENTRY_DSN` is unset. No Session Replay — this app handles buyer
 * PII and we don't want it recorded.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

/** Adds App Router navigation breadcrumbs / transaction spans. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
