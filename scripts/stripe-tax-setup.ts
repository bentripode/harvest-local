/**
 * One-time Stripe TEST-MODE tax setup for buyer checkout (Phase 2).
 *
 *   npm run stripe:tax -- --account acct_XXX --state TX
 *
 * Stripe Tax only calculates tax when (a) the liable entity has a head-office address and
 * (b) it has an ACTIVE registration in the buyer's jurisdiction. Harvest Local's merchant of
 * record is the connected SELLER account (destination charge + `on_behalf_of`), so both live on
 * that account — this script sets them, plus the platform's own head office.
 *
 * Without this, checkout still completes but `automatic_tax` silently collects $0. These are
 * sandbox registrations; add real ones in the live Dashboard before going live.
 *
 * Run with Node's built-in env + TS: `node --env-file=.env.local`.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY must be a test-mode key (sk_test_...). Aborting.");
  process.exit(1);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const accountId = arg("account");
const state = (arg("state") ?? "").toUpperCase();

// Representative test-mode addresses. Any resolvable US address works in a sandbox; edit freely.
const ADDRESSES: Record<string, Stripe.AddressParam> = {
  TX: { line1: "1100 Congress Ave", city: "Austin", state: "TX", postal_code: "78701", country: "US" },
  CA: { line1: "1 Dr Carlton B Goodlett Pl", city: "San Francisco", state: "CA", postal_code: "94102", country: "US" },
  NY: { line1: "253 Broadway", city: "New York", state: "NY", postal_code: "10007", country: "US" },
  FL: { line1: "400 S Orange Ave", city: "Orlando", state: "FL", postal_code: "32801", country: "US" },
  WA: { line1: "600 4th Ave", city: "Seattle", state: "WA", postal_code: "98104", country: "US" },
  CO: { line1: "1437 Bannock St", city: "Denver", state: "CO", postal_code: "80202", country: "US" },
  IL: { line1: "121 N LaSalle St", city: "Chicago", state: "IL", postal_code: "60602", country: "US" },
};

if (!state || !ADDRESSES[state]) {
  console.error(
    `Pass --state with one of: ${Object.keys(ADDRESSES).join(", ")} ` +
      `(or add an address for your state to scripts/stripe-tax-setup.ts).`,
  );
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
const addr = ADDRESSES[state];

async function ensureHeadOffice(opts?: Stripe.RequestOptions) {
  const settings = await stripe.tax.settings.retrieve({}, opts);
  if (settings.status === "active") {
    console.log(`  head office: already set (status active)`);
    return;
  }
  await stripe.tax.settings.update({ head_office: { address: addr } }, opts);
  console.log(`  head office: set to ${addr.city}, ${addr.state}`);
}

async function ensureRegistration(opts?: Stripe.RequestOptions) {
  const existing = await stripe.tax.registrations.list({ status: "active" }, opts);
  const already = existing.data.some((r) => r.country_options?.us?.state === state);
  if (already) {
    console.log(`  registration: ${state} state sales tax already active`);
    return;
  }
  await stripe.tax.registrations.create(
    {
      country: "US",
      country_options: { us: { state, type: "state_sales_tax" } },
      active_from: "now",
    },
    opts,
  );
  console.log(`  registration: created ${state} state sales tax`);
}

async function main() {
  console.log("Platform account:");
  await ensureHeadOffice();

  if (accountId) {
    const opts: Stripe.RequestOptions = { stripeAccount: accountId };
    console.log(`\nConnected account ${accountId}:`);
    await ensureHeadOffice(opts);
    await ensureRegistration(opts);
    const s = await stripe.tax.settings.retrieve({}, opts);
    console.log(`\nConnected account tax status: ${s.status}`);
  } else {
    console.log("\nNo --account given; skipped the connected account (its registration is the");
    console.log("one that matters for buyer checkout since the seller is merchant of record).");
  }

  console.log("\nDone. Run a test checkout — the Stripe page should now show sales tax.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
