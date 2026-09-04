# Harvest Local — local development setup

All five build phases (`ARCHITECTURE.md` §5) are complete: auth + seller onboarding, Connect
payments + Stripe Tax, geofencing + compliance guardrails, referrals, local delivery, seller &
platform analytics, email notifications, reviews, in-app messaging, order reports, and admin refunds.
This doc gets the whole thing running on your machine in Stripe **test** mode against a **hosted**
Supabase project.

For taking it live, see **`LAUNCH.md`**.

---

## 1. Tools

Node 22.6+ / 24 and npm are assumed. Also install:

| Tool | Why | Install (Windows) |
|---|---|---|
| **Stripe CLI** | forwards test webhooks to `localhost` — the payment layer is entirely webhook-driven | `scoop install stripe` · `winget install Stripe.StripeCLI` · or a release from https://github.com/stripe/stripe-cli/releases |

The Supabase CLI is a dev dependency (`npx supabase …`). Docker is **not** needed — we use a hosted
Supabase project, not a local stack. The Inngest dev server runs via `npx` (no install).

---

## 2. Accounts & keys

Do these in order; each produces values for `.env.local`. `.env.example` is the annotated reference;
`src/lib/env.ts` (Zod) validates everything at boot so a missing/bad value fails loudly.

### A. Supabase (hosted project)

Create a project at https://supabase.com/dashboard. From **Project Settings → API**:

- Project URL (bare) → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

Link and push the schema:

```bash
npx supabase login                        # opens a browser; paste the token
npx supabase link --project-ref <ref>     # prompts for the DB password
npx supabase db push                      # applies all migrations (schema, RLS, seed/reference data)
npm run db:types                          # regenerate src/lib/db/database.types.ts
```

Reference data (categories, tags, `platform_settings`, storage buckets) lives inside the migrations —
`db push` loads it; there is no separate `seed.sql`. `npm run db:reset` targets a *local* stack and is
unused here; `npx supabase db reset --linked` **wipes the hosted DB** — only deliberately.

**Auth settings** (Dashboard → Authentication):
- URL Configuration → Redirect URLs → add `http://localhost:3000/**`
- Providers → Email → "Confirm email": leave on and confirm via the email Supabase sends, or turn it
  off for a faster dev loop.

**Realtime** (Database → Replication): enable **Postgres Changes for `public.messages`** if you want
instant message delivery; otherwise messaging falls back to a 4-second poll (fine for dev).

### B. Stripe (test mode)

1. https://dashboard.stripe.com — **toggle "Test mode" ON**.
2. **Developers → API keys**: *Secret* → `STRIPE_SECRET_KEY` (`sk_test_…`), *Publishable* →
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_…`).
3. **Enable Connect** (search "Connect" → Get started → platform/marketplace). We use the
   **Accounts v2 API** (`/v2/core/accounts`) — no account "type" to pick. In Connect → Settings,
   acknowledge loss liability (we pass `losses_collector: "application"`).
4. Create the subscription Price + referral coupons (idempotent):
   ```bash
   npm run stripe:setup
   ```
   Paste the printed `STRIPE_SUBSCRIPTION_PRICE_ID` into `.env.local`. It also creates
   `FREE_MONTH_100` (referral reward) and `buyer-referral-pct-10` (buyer discount).
5. Webhook forwarding — `npm run stripe:listen` (below) prints `whsec_…` → `STRIPE_WEBHOOK_SECRET`.
   `stripe listen` also forwards connected-account events, so `STRIPE_CONNECT_WEBHOOK_SECRET` can stay
   blank locally.
6. Optional — per-state Stripe Tax test setup: `npm run stripe:tax -- --account <acct> --state <XX>`.

### C. Mapbox (needed for delivery)

From https://account.mapbox.com:
- `NEXT_PUBLIC_MAPBOX_TOKEN` — a public token (for the browser map, later).
- `MAPBOX_TOKEN` — a token with **Geocoding + Directions** scopes; used server-side to quote delivery
  fees. Falls back to the public one. With neither set, delivery checkout is unavailable and pickup is
  unaffected.

### D. Tax ID encryption

- `TAX_ID_ENCRYPTION_KEYS` — `1:<key>`, where the key is 32 bytes, base64:
  `openssl rand -base64 32`. It is a keyring (`id:key` entries, comma separated, highest id active)
  so the key can be rotated later without downtime — see LAUNCH.md §4. `TAX_ID_ENCRYPTION_KEY`
  without an id also works and means `1:<key>`. Encrypts the SSN/EIN a
  seller uploads on `/seller/compliance`. The key lives only in the environment, so Postgres holds
  ciphertext it cannot read. **With this unset the compliance form refuses to accept a tax ID**, and
  seller onboarding cannot complete — that is deliberate: the alternative is an SSN column in the
  clear. Losing the key means the stored numbers are unrecoverable (nothing reads them today, so
  that costs a re-upload, not data).

### E. Resend (email notifications)

From https://resend.com:
- `RESEND_API_KEY` (`re_…`). With no key, `notification-dispatch` logs emails instead of sending —
  the queue still drains.
- `EMAIL_FROM` — leave the default `Harvest Local <onboarding@resend.dev>` for dev. Resend's sandbox
  sender only delivers to **your Resend account's own email address** until you verify a domain.

### F. Inngest (background jobs)

Not needed locally — `npm run inngest:dev` runs the Dev Server with no keys. `INNGEST_EVENT_KEY` /
`INNGEST_SIGNING_KEY` are for a deploy (see `LAUNCH.md`).

### G. Sentry (error tracking)

Optional. Leave `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` blank for local dev — the SDK stays inert
and the app behaves identically. To try it, create a project at https://sentry.io and paste the
DSN into both vars. `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` are only for source-map
upload at build time and can stay blank locally.

---

## 3. Fill `.env.local`

Copy `.env.example` → `.env.local` and replace every value with the outputs above.

---

## 4. Run it

```bash
npm run dev:all
```

Runs the Next dev server (:3000), `stripe listen`, and the Inngest Dev Server (:8288) together. On
first run, `stripe login` to authorize the CLI. (Or run `npm run dev`, `npm run stripe:listen`, and
`npm run inngest:dev` in separate terminals.)

Open http://localhost:3000. The Inngest dashboard is http://localhost:8288.

---

## 5. Walk the happy path

**Seller onboarding** (`/signup?role=seller` → `/seller/onboarding`):

1. **Storefront details** — business name, handle, selling state. Creates a paused `seller_profiles`.
2. **Payouts** — Stripe-hosted onboarding (Accounts v2). Test data: SSN `000-00-0000`, routing
   `110000000`, account `000123456789`. On return the page says "confirming…" until the
   `account.updated` webhook lands and the v2 capabilities read `active` — **the redirect changes
   nothing; the webhook does.**
3. **Subscription** — Stripe Checkout, subscription mode, no card for the trial. The
   `customer.subscription.created` webhook writes `subscriptions` as `trialing` and auto-unpauses.
4. **Products** (`/seller/products`) — CRUD with categories/tags + photo upload to the
   `product-images` bucket.
5. **Settings** (`/seller/settings`) — pickup address (geocoded) + optional local-delivery config.

**Buyer flow** — `/shop` → a storefront → add to cart → `/checkout`: pickup or delivery, an optional
referral code, then Stripe Checkout (test card `4242 4242 4242 4242`). `checkout.session.completed` →
`finalize_paid_order` moves the order to `new`, snapshots money, decrements stock.

**Order pipeline** — the seller advances `new → preparing → ready → (out_for_delivery →) completed`
on `/seller/orders`. Completion fires the referral + revenue-cap Inngest jobs.

**Then**: leave a review on a completed order; message the seller from a storefront or order; file a
report on an order. Referral rewards, license reminders, and reports queue email notifications that
`notification-dispatch` sends (or logs).

**Admin** — set a profile to admin directly (`update public.profiles set role='admin' where id=…`),
then `/admin` (report queue + 1-click refund), `/admin/analytics` (GMV, MRR, …), `/admin/settings`
(the `sellers_only` ↔ `public` launch toggle).

### Spot-checking the critical rules

- **Webhooks idempotent** — `stripe events resend <evt_id>`; the second delivery no-ops (`stripe_events`).
- **Money server-side** — order money fields are snapshots in cents (`src/lib/money.ts`); the client only displays.
- **No cross-state orders** — the `orders_same_state_only` CHECK + the checkout guard + discovery filter.
- **Reviews / reports** — enforced by BEFORE INSERT triggers, not app code (try a fake insert with the service-role key).
- **RLS** — read another user's rows with the anon key → denied.

---

## Commands

See `CLAUDE.md` § Commands for the full list. Most-used: `npm run dev:all`, `npm run db:push`,
`npm run db:types`, `npm run build`, `npm run lint`, `npx supabase db diff -f <name>`.

## Files worth reading first

- `ARCHITECTURE.md` — schema + design decisions (source of truth) · `CLAUDE.md` — the rules
- `supabase/migrations/*` — schema, RLS + column-guard triggers, the SECURITY DEFINER functions
- `src/app/api/webhooks/stripe/route.ts` — the only writer of Stripe state
- `src/lib/{auth,env,money}.ts` · `src/lib/db/types.ts` (friendly aliases + the numeric→string money fix)

## Known limitations

- **Twilio / SMS** not wired — `notification-dispatch` has a stubbed `sms` branch.
- `npm test` (Vitest) covers the guardrail logic — money math, the geofence predicate, the
  promo-code schema, cart re-pricing, and webhook idempotency. No integration/e2e suite yet.
- Messaging uses a poll unless Supabase Postgres Changes is enabled (§2.A).
- The hosted dev project contains E2E test data (a sample seller, buyers, orders, etc.).
