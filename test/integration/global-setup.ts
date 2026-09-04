/**
 * Prints why the database pass is skipping, before any suite runs. A module-level log inside a
 * skipped test file doesn't reliably reach the reporter; `globalSetup` always does.
 */
export default function setup() {
  const configured = !!(
    process.env.INTEGRATION_SUPABASE_URL &&
    process.env.INTEGRATION_SUPABASE_ANON_KEY &&
    process.env.INTEGRATION_SUPABASE_SERVICE_ROLE_KEY
  );

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
