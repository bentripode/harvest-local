/**
 * Prints why the database pass is skipping, before any suite runs. A module-level log inside a
 * skipped test file doesn't reliably reach the reporter; `globalSetup` always does.
 *
 * ## Why `INTEGRATION_REQUIRED` exists
 *
 * Skipping is the right default: `npm run test:integration` has to be safe to run on a laptop with
 * no database. But a skip exits 0, and a green run that executed nothing looks exactly like a green
 * run that passed. That is not hypothetical — three cap-variant tests asserted on seeded state data,
 * were invalidated when that data was corrected against the statutes, and stayed invisible because
 * nothing ran them.
 *
 * So anywhere the suite is *expected* to run, set `INTEGRATION_REQUIRED=1` and a missing database
 * becomes a hard failure instead of a silent pass. CI sets it. The guard lives here rather than in
 * the workflow so it protects any runner, not just GitHub Actions.
 */
export default function setup() {
  const configured = !!(
    process.env.INTEGRATION_SUPABASE_URL &&
    process.env.INTEGRATION_SUPABASE_ANON_KEY &&
    process.env.INTEGRATION_SUPABASE_SERVICE_ROLE_KEY
  );

  if (!configured && process.env.INTEGRATION_REQUIRED === "1") {
    throw new Error(
      "[integration] INTEGRATION_REQUIRED=1 but no database is configured. Set " +
        "INTEGRATION_SUPABASE_URL / _ANON_KEY / _SERVICE_ROLE_KEY, or unset INTEGRATION_REQUIRED " +
        "if skipping is genuinely intended here. Refusing to report a skip as a pass.",
    );
  }

  if (configured) {
    const host = (() => {
      try {
        return new URL(process.env.INTEGRATION_SUPABASE_URL!).host;
      } catch {
        return "(unparseable URL)";
      }
    })();
    console.info(`\n[integration] running against ${host} — this creates and deletes real rows.\n`);
    return;
  }

  console.info(
    "\n[integration] SKIPPING every suite: INTEGRATION_SUPABASE_URL / _ANON_KEY / " +
      "_SERVICE_ROLE_KEY are not set.\n" +
      "[integration] Point them at a throwaway Supabase branch — see test/integration/README.md.\n",
  );
}
