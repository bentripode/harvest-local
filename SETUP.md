# Harvest Local — Phase 1 setup & review

This scaffold stops at the point the architecture doc calls the Phase 1 checkpoint: **a seller can
sign up, complete Stripe Connect Express onboarding, start a $20/mo subscription with a 90-day trial,
and create product listings — all in Stripe test mode.** The Mapbox map/gallery is deliberately left
for the next slice.

Everything below is code-complete and type-checks / builds (`npm run build`). It has **not** been run
end-to-end here because that needs Docker (local Supabase) and your Stripe test keys. Follow these
steps to bring it up and review.

---

## 1. Install the two CLIs the toolchain needs

You already have Node 24 and npm. You still need:

| Tool | Why | Install (Windows) |
|---|---|---|
| **Docker Desktop** | `supabase start` runs Postgres + Auth + Storage in containers | https://www.docker.com/products/docker-desktop/ |
| **Stripe CLI** | forwards test webhooks to `localhost` — the whole payment layer is webhook-driven | `scoop install stripe` · or `winget install Stripe.StripeCLI` · or download from https://github.com/stripe/stripe-cli/releases |

The Supabase CLI itself is already a dev dependency (`npx supabase ...`).

---

## 2. Accounts & keys you need to create

Do these in order; each produces values for `.env.local`.

### A. Supabase (hosted project — Docker not required)

This machine can't run `npx supabase start` (Docker needs virtualization). We use a hosted
Supabase project instead. Create one at https://supabase.com/dashboard, then from
**Project Settings → API** copy into `.env.local`:

- Project URL (bare, no path) → `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://<ref>.supabase.co`)
- `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

Log in, link the repo to the project, push the schema + seed, regenerate types:

```bash
npx supabase login                                   # opens a browser; paste the token
npx supabase link --project-ref <ref>                # prompts for the DB password
npx supabase db push                                 # applies all 3 migrations (incl. seed/reference data) to the hosted DB
npm run db:types                                     # regenerate src/lib/db/database.types.ts from the linked project
```

The seed/reference data (categories, tags, `platform_settings`, storage buckets) lives in migration
`20260901221902_phase1_storage_and_seed.sql`, so `db push` loads it — there is no separate
`supabase/seed.sql` and `db reset` is only for a local stack.

> `npm run db:reset` still targets a local stack (`--local`) and is unused in this workflow.
> To re-run everything against the hosted DB you'd use `npx supabase db reset --linked` — **that wipes
> the hosted database**, so only do it deliberately.

### B. Stripe (test mode)

1. Create / sign in at https://dashboard.stripe.com and **toggle "Test mode" ON** (top-right).
2. **Developers → API keys**:
   - *Secret key* → `STRIPE_SECRET_KEY` (starts `sk_test_`)
   - *Publishable key* → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (starts `pk_test_`)
3. **Enable Connect**: Dashboard → search "Connect" → **Get started**. Choose platform/marketplace.
   We create connected accounts with the **Accounts v2 API** (`/v2/core/accounts`) — no account
   "type" to pick, and the legacy `type: 'express'` path is gone. In **Connect → Settings**,
   acknowledge the loss-liability responsibility (we pass `losses_collector: "application"`). The
   same `sk_test_` key acts on connected accounts.
4. Create the subscription Price + reward coupon (idempotent helper):

   ```bash
   npm run stripe:setup
   ```

   Paste the printed `STRIPE_SUBSCRIPTION_PRICE_ID` into `.env.local`.
5. Start webhook forwarding (leave running in its own terminal):

   ```bash
   npm run stripe:listen
   # first run: `stripe login` to authorize the CLI
   ```

   It prints `Ready! ... whsec_...` → that's `STRIPE_WEBHOOK_SECRET`.

   The default `stripe listen` **also forwards connected-account events**, so you can leave
   `STRIPE_CONNECT_WEBHOOK_SECRET` blank for local dev.

### C. Mapbox — *not needed for this checkpoint*

Leave `NEXT_PUBLIC_MAPBOX_TOKEN` blank. You'll get a token from https://account.mapbox.com when we
build the map.

---

## 3. Fill `.env.local`

`.env.local` currently holds **placeholders** so the build boots. Replace every value using the
outputs above. `.env.example` is the annotated reference.

---

## 4. Run it

```bash
# terminal 1  (webhook forwarding)
npm run stripe:listen

# terminal 2
npm run dev
```

(The hosted Supabase project is always up — nothing to start locally.)

Open http://localhost:3000.

---

## 5. What to review (the checkpoint)

1. **Sign up as a seller** — `/signup?role=seller`. On a hosted project email confirmation is **on by
   default** — either confirm via the email Supabase sends, or turn it off for now in
   Dashboard → Authentication → Providers → Email ("Confirm email"). Also add
   `http://localhost:3000/**` under Authentication → URL Configuration → Redirect URLs.
2. **Step 1 — Storefront details.** Creates a `seller_profiles` row (starts paused). Slug uniqueness
   + state lock enforced.
3. **Step 2 — Payouts.** "Set up payouts with Stripe" → Stripe-hosted onboarding (Accounts v2, the
   `acct_…` is created via `/v2/core/accounts` with the `recipient` + `merchant` configurations).
   Use Stripe's test data (SSN `000-00-0000`, any test values, routing `110000000`, account
   `000123456789`). On return, the page says "confirming your details" until the `account.updated`
   webhook lands — watch the `stripe:listen` terminal; the handler re-reads the v2 account and, once
   `configuration.merchant.capabilities.card_payments` and
   `configuration.recipient…stripe_transfers` are `active`, the step flips to done. **This is the
   rule in action: the return redirect changes nothing; the webhook does.**
4. **Step 3 — Subscription.** "Start 90-day free trial" → Stripe Checkout (subscription mode, no card
   required for the trial) → returns. `customer.subscription.created` webhook writes the
   `subscriptions` row as `trialing` and the storefront auto-unpauses (both conditions met).
5. **Overview** (`/seller`) now shows Subscription `trialing`, trial end date, Payouts, and status
   **Live**.
6. **Products** (`/seller/products`) → **New product** — title, price, category + sub-category, tags,
   photo upload (goes to the `product-images` Supabase Storage bucket under your seller id), draft or
   active. Edit, publish/unpublish, delete.

### Verifying the critical rules hold

- **Webhooks are the source of truth / idempotent:** re-send an event —
  `stripe events resend <evt_id>` — and confirm no duplicate rows (check the `stripe_events` table;
  the second delivery returns `{duplicate:true}`).
- **Money math server-side:** product prices round-trip through `src/lib/money.ts` (cents) on the
  server; the client only displays.
- **Cross-state guard:** the `orders` table and its `same_state_only` CHECK arrive in Phase 2, but
  `seller_profiles.home_state` is already locked at creation and mirrored to `profiles.home_state`.
- **RLS:** try reading another user's `seller_profiles`/`products` rows with the anon key — denied.

### Files most worth reading

- `supabase/migrations/*` — `20260901221859` enables PostGIS in the `extensions` schema (must run
  first); then schema, RLS policies + column-guard triggers, storage buckets, seed
- `src/app/api/webhooks/stripe/route.ts` — the only writer of Stripe state; signature check +
  `stripe_events` idempotency gate + `reconcileActivation`
- `src/app/(dashboard)/seller/onboarding/actions.ts` — Connect account + account links + Checkout
- `src/lib/auth.ts`, `src/lib/env.ts`, `src/lib/money.ts`
- `CLAUDE.md` — the rules, restated for future sessions

---

## Known limitations at this checkpoint

- Not executed end-to-end in this environment (no Stripe keys / browser here). Build + typecheck +
  lint are green.
- `src/lib/db/database.types.ts` is now generated from the hosted schema (`npm run db:types`).
  Friendly row aliases (`Profile`, `Product`, …) and two generator corrections (Postgres `numeric`
  → `string` for money; `products.images` → `ProductImage[]`) live in `src/lib/db/types.ts`;
  import `Database` and row types from there, not from `database.types` directly.
- Email/password auth only; social login + OTP polish is deferred.
- No automated tests yet.
- Inngest, Resend, Twilio: not wired (Phase 3).
