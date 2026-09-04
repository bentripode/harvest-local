import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * The database pass: SECURITY DEFINER functions, triggers and RLS policies against a real Postgres.
 * `npm run test:integration` — see test/integration/README.md. Every suite skips (loudly) when the
 * INTEGRATION_SUPABASE_* env vars are unset, so this is safe to run anywhere.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    globalSetup: [r("./test/integration/global-setup.ts")],
    // One file at a time: the suites share a database and create real auth users.
    fileParallelism: false,
    // Real network round-trips to Supabase.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "server-only": r("./test/stubs/server-only.ts"),
      "@": r("./src"),
    },
  },
});
