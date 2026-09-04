# Integration tests (database pass)

`npm test` covers pure units. **These** exercise the parts that only exist in Postgres — the
SECURITY DEFINER functions, the BEFORE INSERT/UPDATE triggers, and the RLS policies — against a real
database. `LAUNCH.md` §7.

```bash
npm run test:integration
```

With no database configured every suite **skips** (and logs why), so this is safe to run anywhere and
CI is unaffected.

## Setup

> ⚠️ These tests create and delete real rows, including auth users. **Never point them at
> production.** Use a Supabase **branch** (Dashboard → Branches) or a local `npx supabase start`.

1. Apply the migrations to the target database (`npx supabase db push`, or `db reset` locally).
2. Export three vars — Project Settings → API on the branch:

```bash
export INTEGRATION_SUPABASE_URL="https://<branch-ref>.supabase.co"
export INTEGRATION_SUPABASE_ANON_KEY="<anon key>"
export INTEGRATION_SUPABASE_SERVICE_ROLE_KEY="<service role key>"
npm run test:integration
```

The seed data from `20260901221902_phase1_storage_and_seed.sql` must be present — `createProduct`
needs a top-level `categories` row.

## How the harness works

`helpers.ts` gives each suite:

- **`describeDb`** — `describe` that skips when the env vars are missing.
- **`adminDb()`** — service-role client (bypasses RLS). Stands in for webhook / trusted-job code.
- **`anonDb()`** — anon client, no session. Stands in for a logged-out visitor.
- **`createTestUser({ role, homeState })`** — makes a real auth user (the `on_auth_user_created`
  trigger creates the `profiles` row), patches `home_state`/`role`, and returns a client **signed in
  as that user** so RLS and `auth.uid()` behave for real. This is what makes the authorization tests
  meaningful — the service role skips `is_platform_context()` checks.
- **`createSeller` / `createProduct` / `createOrder` / `addOrderItem` / `completeOrder`** — fixtures.
- **`cleanupAll()`** — call it from `afterAll`. Deletes tracked orders first (`orders.buyer_id` is
  `ON DELETE RESTRICT`), then the auth users; everything else cascades.

Fixtures are prefixed `it-` so a stray row is obvious. Suites run one file at a time
(`fileParallelism: false`) because they share the database.

## Covered

| Suite | Guards |
|---|---|
| `geofence.test.ts` | `orders_same_state_only` on INSERT and UPDATE, service role included (rule 1, layer 1) |
| `finalize-paid-order.test.ts` | webhook idempotency — second call no-ops, no double stock decrement; `service_role`-only grant (rule 2) |
| `order-pipeline.test.ts` | `advance_order_status` ownership + legal-transition map + `order_status_history` trigger |
| `reviews.test.ts` | `reviews_verify_buyer` trigger, one-review-per-order, `avg_rating` rollup (rule 4) |
| `rls.test.ts` | order visibility (anon / buyer / other buyer / seller), no client order writes, `profiles_guard_role`, `seller_profiles_guard_columns`, `check_rate_limit` grant |
| `licenses.test.ts` | `seller_licenses_guard_status` — a seller can't verify their own license or forge the review trail, but can still edit the rest of the row; license RLS (owner / other seller / anon) |
| `license-gate.test.ts` | `sync_seller_license_pause` — pauses without a verified/unexpired license, lifts the two license pauses on verification, never downgrades or lifts `revenue_cap` / `admin`, never resurrects an incomplete onboarding |
| `functions-authz.test.ts` | authorization inside every SECURITY DEFINER function granted to `authenticated`/`anon`: `get_or_create_conversation`, `mark_conversation_read`, `mark_notifications_read`, `upsert_address` |

## What the first run found

A real authorization bypass. `advance_order_status` gated its ownership check on
`not is_platform_context()`, which reads `current_user` — but inside a SECURITY DEFINER body
`current_user` is the function **owner** (`postgres`), so it was true for every caller and the check
never ran. The RPC is granted to `authenticated` and the anon key ships in the browser bundle, so any
logged-in account could advance any order. Fixed in
`supabase/migrations/20260904090000_fix_advance_order_status_authz.sql` by switching that one
predicate to `is_service_role()`, which reads the request JWT claims instead.

The lesson generalises: **inside a SECURITY DEFINER function, authorize on `auth.uid()` /
`is_service_role()`, never on `current_user`.** RLS is bypassed there too, so the function must
carry its own check. `functions-authz.test.ts` exists to keep every user-callable one honest.

## Not covered yet

Worth adding as the harness gets used:

- `reports_verify_reporter` (party-only, order past `pending_payment`) and the `reports` admin-only
  update policy.
- The referral chain: `create_referral_for_order`, `activate_referral_for_order`,
  `set_referral_reward_coupon`, `invalidate_referral_for_order`, `open_referral_cycle` — cycle
  rotation on a strictly-later `period_start`, and the one-per-buyer-per-seller-per-cycle partial
  unique index.
- Compliance: `record_order_revenue` crossing `state_cottage_food_rules.revenue_cap` → `is_paused`,
  and `expire_seller_license`.
- `check_rate_limit` behaviour (allows N in a window, then denies with `retry_after`).
- Messaging: the participant RLS on `conversations` / `messages` (the RPCs themselves are covered).
- Delivery: `delivery_route_inputs` and the PostGIS point `upsert_address` writes (its authorization
  is covered; the geography round-trip isn't).
- `record_storefront_view` bumping both `seller_view_counts` and `product_view_counts`.
- Storage RLS on the private `seller-docs` bucket.
