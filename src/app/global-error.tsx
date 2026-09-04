"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Catches errors thrown in the root layout — the one place a normal `error.tsx` can't reach.
 * Must render its own <html>/<body>.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          padding: "2rem",
          textAlign: "center",
          color: "#1a1a1a",
          background: "#fafaf9",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "#57534e", marginBottom: "1.5rem" }}>
            We&apos;ve been notified and are looking into it. Try reloading the page.
          </p>
          <button
            type="button"
            // A global error means the app tree (incl. the router) is broken — a hard nav is the
            // only reliable recovery here.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            onClick={() => window.location.assign("/")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#1a1a1a",
              color: "#fff",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            Back to Harvest Local
          </button>
        </div>
      </body>
    </html>
  );
}
