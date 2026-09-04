import * as Sentry from "@sentry/nextjs";

/** Runs once per server instance. Loads the Sentry init for whichever runtime we're in. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/** Reports errors thrown in Server Components, route handlers, and Server Actions to Sentry. */
export const onRequestError = Sentry.captureRequestError;
