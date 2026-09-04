# CLAUDE.md — Harvest Local

> **Architecture and schema live in `ARCHITECTURE.md`. Treat it as the source of truth.**
> This file is the fast briefing; when they disagree, `ARCHITECTURE.md` wins and this file should be
> corrected.

---

## What this is

**Harvest Local** — a hyper-local, peer-to-peer marketplace: a "Zillow-style map" for farmers,
artisans, and makers. Buyers discover nearby sellers on a map/gallery, order goods, and pick up or
get local delivery. Sellers pay a **$20/mo subscription** (not a per-transaction cut) to run a
storefront. Transactions are **intentionally confined to a single US state** for legal (cottage-food)
reasons.

Revenue model: seller subscriptions. A referral engine rewards sellers with a free month when they
bring in 3 verified buyers per billing cycle.

### Build phases (see `ARCHITECTURE.md` §5)

1. **Phase 1 — Foundation & Seller Onboarding (current):** auth + roles, "Sellers Only" launch gate,
   Stripe Connect onboarding (Accounts v2) + Billing subscription with 90-day trial, product CRUD with
   categories/sub-categories/tags, the map/gallery. **We stop when seller onboarding + product
   listings work end-to-end in Stripe test mode.**
2. Phase 2 — buyer checkout (Connect destination charge + Stripe Tax), geofencing, revenue caps,
   license expiry, order status pipeline.
3. Phase 3 — referral engine, seller analytics, delivery/mileage fees, notifications.
4. Phase 4 — in-app messaging, reviews, reports.
5. Phase 5 — admin/dispute dashboard, public launch.

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework / language | **Next.js 16 (App Router) + TypeScript (strict)**. Turbopack is the default for `dev` and `build`. |
| UI | **Tailwind CSS v4 + shadcn/ui** (`base-nova` style, `neutral` base color). Components in `src/components/ui`. |
| DB / Auth / Storage / Realtime | **Supabase** — Postgres + PostGIS, Supabase Auth (email OTP + social), Storage (private bucket for license/ID docs), Realtime (Phase 4 messaging). |
| Payments | **Stripe** — **Connect Accounts v2** (`/v2/core/accounts`, Express dashboard) for buyer→seller payments & payouts; connected accounts get the `recipient` + `merchant` configurations so the **seller is merchant of record** for sales tax (destination charges `on_behalf_of` in Phase 2). Billing for the $20/mo subscription + 90-day trial + 100%-off reward coupon. Tax for local sales tax (Phase 2). **Never use the deprecated `stripe.accounts.create({type:'express'})` v1 path or the `charges_enabled`/`payouts_enabled` fields — use v2 capability status.** |
| Validation | **Zod v4** — shared schemas at every trust boundary (client + server). |
| Client data fetching | TanStack Query (added when the order pipeline / messaging needs it; not in the Phase 1 checkpoint). |
| Maps | Mapbox GL JS + Geocoding + Directions/Matrix (mileage fees). Kept behind a routing interface so it's swappable. |
| Background jobs | Inngest — referral activation, revenue-cap checks, license-expiry scans, notification fan-out. Skeleton only in Phase 1. |
| Email / SMS | Resend (+ React Email) / Twilio. Phase 3. |
| Hosting | Vercel (app) + Supabase (managed Postgres). |

### Next.js 16 specifics (do not regress these)

- `cookies()`, `headers()`, `draftMode()`, and route `params` / `searchParams` are **async** — always `await` them.
- The old `middleware.ts` convention is **`proxy.ts`** with an exported `proxy` function (nodejs
  runtime, not edge). Supabase session refresh lives in `src/proxy.ts`.
- `next lint` is gone; use `npm run lint` (ESLint flat config in `eslint.config.mjs`).
- Read `node_modules/next/dist/docs/` before using an unfamiliar API — this Next is newer than most
  training data. `AGENTS.md` (which `CLAUDE.md` `@`-includes) carries this rule too.

---

## Critical rules — these are legal / financial guardrails, not preferences

### 1. No cross-state orders. Ever.

A buyer in state X may only transact with a seller whose authoritative selling state is X. Enforced in
**three layers**, all of which must stay:

- **Data layer:** the `orders.same_state_only` CHECK constraint (`buyer_state = seller_state`). Never
  drop or weaken it. `buyer_state` / `seller_state` are frozen snapshots on the order.
- **Server layer:** every checkout / order-creation path re-checks buyer state vs. seller state before
  writing.
- **Discovery layer:** the map/search hides out-of-state sellers for a given buyer by default.

Never write an order, or code a path that could write an order, that crosses state lines.

### 2. All Stripe state changes come from webhooks, and every handler is idempotent.

- **Never** mutate subscription, order, payment, payout, or referral state from a browser "success"
  redirect, a client callback, or an optimistic UI path. The redirect only navigates; the webhook is
  the source of truth.
- The webhook route (`src/app/api/webhooks/stripe/route.ts`) **must** verify the Stripe signature
  against `STRIPE_WEBHOOK_SECRET` before doing anything.
- Every handler must be **idempotent**: Stripe retries and re-delivers. Record every processed event
  id in `stripe_events` and no-op on repeats; make each mutation safe to run twice (upserts, guarded
  state transitions, `reward_granted` flags).
- Every Stripe **write** (creating a subscription, attaching a coupon, issuing a refund) uses an
  **idempotency key derived from a stable local id** (e.g. `seller_profile.id`, `cycle_id`).
- Stripe is the source of truth for money; our tables are a queryable **mirror** kept in sync by
  webhooks.

### 3. Money math is server-side only.

- The client never computes subtotals, discounts, delivery fees, tax, or totals — it displays numbers
  the server produced.
- All money is stored as `numeric` in Postgres and handled in **integer minor units (cents)** in
  application code (`src/lib/money.ts`). No floating-point arithmetic on money.
- Order money fields are **snapshots** captured at checkout (`unit_price`, `subtotal`,
  `discount_total`, `delivery_fee`, `tax_total`, `total`) — never recomputed from live product rows.
  `tax_total` / `total` are provisional until the payment webhook finalises them from the Stripe
  session (`finalize_paid_order`); everything else is frozen at checkout.
- The buyer referral **discount amount** is our own order math (admin-set % from `platform_settings`,
  computed in `validatePromoCode`, snapshotted into `discount_total` at checkout). A reusable
  `percent_off` Coupon rides the Checkout Session **only** as the transport so Stripe Tax applies to
  the discounted base; the webhook reconciles `discount_total` against the session's
  `amount_discount`. The seller free-month reward is a separate Stripe 100%-off Coupon on the
  subscription — don't conflate the two.

### 4. Reviews only from verified buyers of completed orders.

- A `reviews` row is insertable **only** when the reviewer is the `buyer_id` of an `orders` row with
  `status = 'completed'`, and there is **one review per order** (`reviews.order_id` is unique).
- Enforced at the data layer: the `reviews_verify_buyer` `BEFORE INSERT` trigger (fires for every
  insert, RLS bypass included) + the `order_id` unique constraint. RLS additionally scopes writes to
  `reviewer_id = auth.uid()`. `seller_profiles.avg_rating` is rolled up by a SECURITY DEFINER
  `AFTER INSERT/DELETE` trigger (`recompute_seller_rating`).

---

### 5. A storefront is only live with every required document verified.

- The required set is **Government ID + Tax ID**, plus a **Cottage Food Permit** for any seller
  listing food. Whether they list food is *derived* from their product categories
  (`categories.requires_food_permit` → `seller_sells_cottage_food()`), never self-declared — so a
  trigger on `products` re-runs the gate whenever the catalogue changes.
- `seller_profiles.is_paused` is the single lever — checkout, the storefront page and `/shop` all
  already gate on it, so the guardrail lives entirely in
  **`sync_seller_license_pause()`** (`20260904110000_license_gate.sql`), not in request handlers.
- The gate predicate is `seller_has_required_documents()`: every required type has a
  `verification_status = 'verified'` row that is not past `expiration_date` (a tax ID has no expiry,
  and no issuing state — both columns are nullable for that type alone, enforced by CHECK).
- `src/lib/licenses/requirements.ts` is the seller-facing half of the same rules (the upload
  checklist). Keep the two in step: it decides what the seller is *asked* for, the SQL function
  decides whether the storefront may *open*.
- **The tax ID is encrypted and unreadable from any browser session.** `tax_id_encrypted` is
  AES-256-GCM (`src/lib/crypto/secret-box.ts`, key in `TAX_ID_ENCRYPTION_KEY` — the app holds it,
  Postgres never does), and SELECT is granted to `anon`/`authenticated` **column by column** with
  that column left off the list, so even the owning seller and an admin get a permission error —
  and `select *` on `seller_licenses` fails for those roles by design. Only `service_role` reads it,
  and **nothing in the app decrypts today**: every screen renders `tax_id_last4`. `license_number`
  is for non-sensitive document numbers only. Storing a tax ID writes a `tax_id_audit` row, and the
  `tax-id-retention` cron destroys numbers and documents 4 years past a seller's last sale. Anything
  that ever decrypts must write a `decrypted` audit row.
- **Rotation:** `TAX_ID_ENCRYPTION_KEYS` is a keyring of `id:key` entries and the **highest id is
  active**, so rotating is only "add a higher-numbered key" — there is no second variable to fall out
  of sync. Ciphertext is `v2.<keyId>.<payload>` (`v1.<payload>` is pre-keyring history, read as key
  1) and `seller_licenses.tax_id_key_id` mirrors that id so progress is countable without
  decrypting. `tax-id-rekey` (nightly, or on `harvest/taxid.rekey.requested`) sweeps stale rows;
  **an old key must stay in the list until /admin/settings shows nothing left on it**, or those rows
  become unreadable.
- **Precedence matters.** Pausing never renames an existing pause (`coalesce(pause_reason,
  'license_unverified')`), and unpausing lifts **only** `license_unverified` / `license_expired`,
  and only when Connect + a trialing/active subscription still hold. `revenue_cap` and `admin` are
  lifted by an admin or the yearly reset alone; `onboarding_incomplete` belongs to the webhook's
  `reconcileActivation`, which now also requires a valid license before it will set a seller live.
- Called from `reviewLicenseAction` (an admin verifying or withdrawing) and `reconcileActivation`.
- The gate is deliberately **not** keyed on `state_cottage_food_rules.requires_license`: those rows
  are seeded `false` as placeholders, so gating on them would enforce nothing. Revisit when real
  per-state rules are entered.

---

### 6. A seller may not list food where their state bans online food sales.

- Delaware, Hawaii, Michigan, Mississippi and Nevada prohibit online cottage-food orders under
  **every** program they run; six more ban it under one program and allow it under another. The
  predicate is `state_allows_online_food_sales(state)`, derived from `state_food_programs` — never a
  hardcoded state list, so correcting a program in the admin surface moves the gate with it.
- Enforced by the `products_guard_online_food_sales` BEFORE INSERT/UPDATE trigger
  (`20260904180000_online_food_sales_gate.sql`): a product in a `requires_food_permit` category
  cannot reach `active` or `sold_out` for a seller in a banned state. `draft` is allowed through on
  purpose — it keeps the seller's work and gives the migration's backfill somewhere to park existing
  listings without destroying them.
- **This is not a storefront pause.** Pausing would take down the legal candle listings alongside
  the illegal bread. The food listing is what's prohibited, so the food listing is what's blocked;
  non-food selling continues untouched.
- `describeFoodSalesBlock()` in the product actions is the friendly half — the seller reads a
  sentence, not a constraint violation. `FoodSalesNotice` says the same thing up front on
  `/seller/products` and `/seller/compliance`.

---

## Conventions

- **TypeScript strict.** No `any` without a written reason. Validate external input with Zod at the
  boundary; infer types from the schema.
- **RLS on every table.** A new table is not done until it has row-level security policies. The
  service-role key (`src/lib/supabase/admin.ts`) bypasses RLS and is used **only** in webhook
  handlers and trusted server jobs, never in a request handler driven by user input without an
  explicit authz check first.
- **Authorization inside a SECURITY DEFINER function: never use `current_user`.** RLS is bypassed in
  a SECURITY DEFINER body *and* `current_user` is the function **owner** (`postgres`), not the
  caller — so `is_platform_context()` is always true there and is useless as a guard. This shipped a
  real bypass in `advance_order_status` (any authenticated user could advance any order); see
  `20260904090000_fix_advance_order_status_authz.sql`. Use **`auth.uid()`** for ownership and
  **`is_service_role()`** for the trusted-caller escape hatch — both read the request JWT claims,
  which are transaction-local and survive correctly. `is_platform_context()` stays as-is and is
  **only** valid in SECURITY INVOKER guard *triggers* (`profiles_guard_role`,
  `seller_profiles_guard_columns`, …), which rely on it returning true for `postgres` so SECURITY
  DEFINER jobs can write protected columns. Any new function granted to `authenticated`/`anon` needs
  a case in `test/integration/functions-authz.test.ts`.
- **Server Functions / Actions** verify auth and authorization on every call (they are reachable by
  direct POST, not just via your UI). Use `requireUser()` / `requireRole()` from `src/lib/auth.ts`.
  Public write paths (checkout, cart re-price, promo attempts, messaging, reports) also call
  `tryRateLimit()` from `src/lib/rate-limit.ts` right after the auth check, keyed per user.
- **Migrations** live in `supabase/migrations/`, are additive, and small. One concern per migration.
  Never edit a migration that has been applied to a shared environment — add a new one.
- **Feature-folder structure** under `src/app` using route groups: `(auth)`, `(dashboard)`. Shared
  logic in `src/lib/<domain>`.
- **Env vars** are validated in `src/lib/env.ts` (Zod). Server-only secrets never get the
  `NEXT_PUBLIC_` prefix. Read `process.env` through `env` so a missing var fails loudly at startup.
- Keep the routing provider (Mapbox vs. Google) behind `src/lib/geo/` interfaces.

## Commands

| Command | What |
|---|---|
| `npm run dev` | Next dev server (Turbopack) on :3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit pass (pure logic; `test/integration/**` excluded) |
| `npm run test:integration` | DB pass — SECURITY DEFINER fns, triggers, RLS against a real Postgres. Skips unless `INTEGRATION_SUPABASE_URL` / `_ANON_KEY` / `_SERVICE_ROLE_KEY` are set. See `test/integration/README.md` |
| `npx supabase start` | Local Postgres + Auth + Storage (needs Docker) |
| `npx supabase db reset` | Drop, recreate, re-run all migrations + seed |
| `npx supabase migration new <name>` | New migration file |
| `npx supabase db diff -f <name>` | Generate a migration from schema changes |
| `npx supabase gen types typescript --local > src/lib/db/database.types.ts` | Regenerate DB types |
| `stripe listen --forward-to localhost:3000/api/webhooks/stripe` | Forward Stripe test webhooks locally |
| `stripe trigger <event>` | Fire a test webhook event |

## Where things are

```
ARCHITECTURE.md                        source of truth for schema + design decisions
LAUNCH.md                              production go-live checklist (env, Stripe live, Inngest Cloud, Resend, admin, hardening)
test/                                  Vitest units (pure logic) · test/integration/ = the DB pass (see its README)
supabase/migrations/                   Phase 1: core tables, RLS, seed · Phase 2: orders+pipeline, compliance · Phase 3: referrals, finalize_paid_order
src/lib/env.ts                         Zod-validated environment
src/lib/supabase/{client,server,admin}.ts   browser / server / service-role clients
src/lib/stripe/{client,config,checkout}.ts  Stripe SDK · price/coupon constants · Checkout builder
src/lib/money.ts                       server-side money helpers (cents)
src/lib/geo/{state,address,geocode,routing}.ts   geofence predicate · address schema/format · Mapbox geocoding · routing interface
src/lib/orders/{pricing,status,queries,delivery}.ts   server re-pricing · status map · order reads · delivery-fee quote
src/lib/compliance.ts                  revenue-status / license / notification reads
src/lib/licenses/{queries,labels,requirements}.ts   admin queue reads · type labels · the required document set + checklist
src/lib/crypto/secret-box.ts           AES-256-GCM keyring for the tax ID · rotation (no in-app decrypt path)
src/lib/compliance/{programs,food-sales}.ts   per-state programs · the online-food-sales gate reads
src/lib/products/labeling.ts           ingredients / allergens / net weight for the label
src/lib/admin/state-rules.ts           per-state cottage-food rules for the admin editor
src/lib/analytics/queries.ts           seller dashboard stats (revenue/AOV/fulfillment/top products from orders)
src/lib/reviews/queries.ts             seller reviews + rating summary reads
src/lib/messages/queries.ts            conversation list / thread / unread-count reads
src/app/messages/                      buyer↔seller inbox + thread (own layout, both roles)
src/lib/referrals/{codes,settings,validate,queries}.ts   promo-code rules · config · checkout validation · dashboard reads
src/lib/stripe/coupons.ts              ensureBuyerDiscountCoupon (reusable percent-off)
src/lib/inngest/                       Inngest client + functions (revenue-cap, license-expiry, referral-activate/-invalidate, notification-dispatch, tax-id-retention, tax-id-rekey)
src/lib/notifications/                  queue (channel fan-out + email opt-out / SMS opt-in) · categories (template→category, prefs, smsEnabled) · copy (in-app lines) · templates (email) · send (Resend) · sms (Twilio)
src/lib/auth.ts                        requireUser / requireRole / getProfile / getSellerContext
src/lib/rate-limit.ts                  tryRateLimit + RATE_LIMITS · check_rate_limit() Postgres fixed-window, fails open
src/proxy.ts                           Supabase session refresh (was middleware.ts)
src/instrumentation*.ts                 Sentry init (server/edge/client) · onRequestError · inert without SENTRY_DSN
src/app/(auth)/                        login, signup, email confirm
src/app/(shop)/                        buyer: /shop, /s/[slug] storefront, /cart, /checkout, /orders, /account (address book + email/SMS prefs)
src/app/(dashboard)/seller/onboarding/ Connect Accounts v2 + Billing subscription
src/app/(dashboard)/seller/products/   product CRUD
src/app/(dashboard)/seller/orders/     seller order board (advance_order_status RPC) + /export CSV
src/app/(dashboard)/seller/referrals/  promo codes + Referral Progress widget
src/app/(dashboard)/seller/compliance/ revenue-vs-cap, licenses, notifications
src/app/(dashboard)/seller/settings/   pickup address + local-delivery config + notification-email opt-outs
src/app/admin/licenses/                license review queue + [id]/document signed-URL redirect
src/app/admin/states/                  per-state cap / licence-required editor
src/app/admin/programs/                seeded cottage-food programs, read-only for now
src/app/api/webhooks/stripe/route.ts   the ONLY place Stripe state is applied
src/app/api/inngest/route.ts           Inngest serve endpoint
```

**Phase 2 — buyer checkout:** a Stripe **Checkout Session** → destination charge with
`on_behalf_of` the seller (seller = MoR) + `automatic_tax` (`liability: { type: 'account' }`).
Order starts `pending_payment`; the `checkout.session.completed` / `async_payment_succeeded`
webhook calls **`finalize_paid_order()`** — one guarded, atomic SQL function that moves the order to
`new`, finalises `discount_total`/`tax_total`/`total` from the session, decrements stock, and (for a
promo order) logs the pending referral. Guarded on `status = 'pending_payment'`, so a Stripe
redelivery — even after a partially-completed prior attempt — is a clean no-op or a clean full redo.
`charge.refunded` (full only) / `charge.dispute.created` move the order to `cancelled` / `disputed`
and emit `harvest/order.refunded`. Sellers advance the pipeline only through `advance_order_status()`
(SQL, SECURITY DEFINER); every transition is logged to `order_status_history` by trigger.
`npm run stripe:tax -- --account <acct> --state <XX>` sets up test-mode Stripe Tax.

**Phase 2 — compliance guardrails (Inngest).** `advanceOrderStatusAction` emits
`harvest/order.completed` (and `harvest/order.cancelled`). `revenue-cap-check` calls
`record_order_revenue()` which tallies `seller_revenue_tracking` and, if the yearly goods total
crosses `state_cottage_food_rules.revenue_cap`, sets `is_paused = true, pause_reason =
'revenue_cap'` **atomically in SQL** (guardrail lives at the data layer). `license-expiry-scan`
(daily cron) sends T-30/7/1 reminders and calls `expire_seller_license()` at expiry (→
`pause_reason = 'license_expired'`). A compliance pause is never lifted by the Stripe webhook's
`reconcileActivation` — only by an admin or the yearly reset. Local dev: `npm run inngest:dev`
(no keys).

**Phase 3 — notification delivery.** Producers call `queueNotification()` /
`queueNotificationForEach()` (`src/lib/notifications/queue.ts`), which fans a template out to one
`notifications` row per channel (default `in_app` + `email`) and nudges `harvest/notification.queued`.
`notification-dispatch` (Inngest — that event + a `*/2` cron backstop) sends the non-`in_app` rows:
`email` → resolve address (`auth.admin.getUserById`) + render (`templates.ts`) + Resend
(`send.ts` — logs when `RESEND_API_KEY` unset), keyed on `notification.id`; `sms` → `profiles.phone`
+ the `copy.ts` one-liner + Twilio (`sms.ts`, a keyless `fetch` to the Messages REST endpoint — logs
when any `TWILIO_*` var is unset). Marks `sent` / bumps `attempt_count` / `failed` past 5; optimistic
`attempt_count` claim guards concurrent runs (Twilio has no idempotency key, so a crash mid-send can
re-text). Every `advance_order_status` transition emits `harvest/order.status_changed` →
`order-status-notify` (Inngest) queues `order_status_changed` on `["email", "sms"]` to the buyer (no
buyer in-app panel; `sms` dropped unless opted in). `sendMessageAction` emits `harvest/message.sent`
→ `message-notify` emails the recipient a `new_message` **only when it's their sole unread message in
the thread** (deduped on `message_id`).

Per-user **email opt-outs**: `queueNotification` reads `profiles.notification_prefs` (jsonb,
`{category: false}` = opted out) and drops the `email` channel for a suppressed category before
inserting — `in_app` is never filtered. `src/lib/notifications/categories.ts` owns the template →
category map and `emailEnabled()`; `payments` (refund) + `compliance` (license-expired / revenue-cap)
are **not** suppressible and skip the profile read entirely. Sellers/admins toggle theirs on
`/seller/settings` (`saveNotificationPrefsAction`); buyers on `/account`; the `messages` category
(`audience: "all"`) shows on both.

**SMS is opt-IN** — `notification_prefs["sms:<category>"] = true` (only `order_updates` is
SMS-eligible, `SMS_CATEGORIES`). `queueNotification` drops the `sms` channel unless `smsEnabled()`.
Buyers add a US number + toggle "text me order updates" on `/account` (`saveSmsPrefsAction` →
`profiles.phone` E.164 + the pref). No phone verification yet.

**Phase 3 — referral engine.** Seller makes a `promo_codes` code; buyer enters it at checkout →
`validatePromoCode` (validates the code shape with `promoCodeSchema`, then an `.eq` lookup — never a
LIKE on raw input; our DB owns attribution). The discount amount is our own math and is snapshotted
into `discount_total` at checkout; a reusable `buyer-referral-pct-<n>` Coupon
(`ensureBuyerDiscountCoupon`) goes on the Checkout Session purely so Stripe Tax hits the discounted
base. `finalize_paid_order()` (see Phase 2) logs the `pending` referral via
`create_referral_for_order()`. Order → `completed` fires `harvest/order.completed` →
`referral-activate`: `activate_referral_for_order()` sets the referral `active` and
`referral_cycles.active_referral_count += 1` atomically, and **reports** whether the cycle just hit
the threshold — it does **not** touch `reward_granted`. The function then attaches the reward Coupon
(id from `platform_settings.seller_referral_reward.coupon` via `getReferralConfig`, `idempotencyKey =
reward:<cycle_id>`) and only then does `set_referral_reward_coupon()` flip `reward_granted` +
`reward_stripe_coupon_id` **together** — so `reward_granted` always implies the coupon is really
attached. A permanently failed attach leaves the cycle honestly un-granted and re-attempts on the
next activation; `onFailure` flags admins. Cycles rotate via `open_referral_cycle()` from
`handleSubscription` / `invoice.paid` (which reads
`invoice.parent.subscription_details.subscription`) **only on a strictly-later `period_start`** — an
equal/earlier boundary keeps the in-progress cycle and its count; `reward_granted` is preserved on a
closed cycle. `harvest/order.cancelled` (seller board — referral still `pending`) or
`harvest/order.refunded` (`charge.refunded` / `charge.dispute.created` — referral may be `active`) →
`referral-invalidate` (decrement, never revoke an issued coupon — flag admins if a granted reward
drops below threshold). Anti-abuse: self-referral block, one non-invalidated referral per
buyer+seller+cycle (app check + partial unique index), `referral_min_order`. Config in
`platform_settings` (`buyer_referral_discount`, `seller_referral_reward` = `{threshold, coupon}`,
`referral_min_order`); `npm run stripe:setup` creates the coupons.

**Phase 3 — local delivery + mileage fees.** Seller sets a pickup address + `delivery_enabled` /
radius / `delivery_base_fee` / `delivery_per_mile_fee` on `/seller/settings`
(`saveDeliverySettingsAction` geocodes via Mapbox → `upsert_address()` RPC, the only way to write a
PostGIS point through PostgREST; a trigger blocks `delivery_enabled` without a pickup address).
Checkout: the buyer picks pickup or delivery + an address; `repriceCartAction` / `startCheckoutAction`
call `resolveDelivery()` → `geocodeAddress()` + `quoteDelivery()`. `quoteDelivery` runs
`delivery_route_inputs()` (SECURITY DEFINER, service-role — PostGIS straight-line radius check +
returns the seller's pickup coords) then the Mapbox driving distance; `fee = base + per_mile *
ceil(miles)`, min 1 mi, all cents. The fee is **snapshotted** into `orders.delivery_fee` (our math,
like `discount_total`), the address frozen into `orders.delivery_address_text`, and it rides the
Stripe session as a `shipping_options` fixed rate so Stripe Tax handles delivery tax and the seller
(MoR) receives it. For delivery, `orders.buyer_state` = the delivery address state (still ==
seller state; the `orders_same_state_only` CHECK + guard hold). Needs `MAPBOX_TOKEN` (Geocoding +
Directions); with none set, delivery is unavailable and pickup is unaffected. `src/lib/geo/routing.ts`
keeps the provider swappable. Buyers save reusable addresses on `/account` (`addresses` table +
`upsert_address` RPC + "addresses: owner all" RLS — no schema change) and pick one from a dropdown
in the checkout delivery form (`getMyDeliveryAddressesAction` → populates the fields; the fee is
still quoted server-side from the submitted text).

**Delivery time windows.** A delivery-enabled seller lists free-text window labels
(`seller_profiles.delivery_windows` jsonb; parsed by `parseWindows` in `src/lib/orders/delivery-windows.ts`
— one per line, deduped, ≤12, ≤80 chars) in the `/seller/settings` form. If a seller has windows,
the buyer **must** pick one at checkout (`startCheckoutAction` re-checks the choice is in the list)
and it's frozen into `orders.delivery_window`, shown on the buyer order page + both seller order
views. Windows don't touch pricing or the Stripe session — pure fulfilment metadata.

**Phase 3 — seller analytics.** `/seller` overview renders `SellerStatsPanel` from
`getSellerDashboardStats(sellerId, windowDays)` — RLS-scoped reads of `orders` / `order_items`
aggregated in JS. The window is **30 / 90 / 365 days** (`?range=` on `/seller`, `parseWindowDays`);
every figure is compared against the equally-long period before it. Revenue (`sum(total)` of
`completed` orders) with a vs-prior trend, completed-order count, AOV, pickup/delivery split,
delivery fees + referral discounts, a dependency-free SVG revenue chart (daily ≤90d, weekly for a
year), and top 5 products. **Storefront views + conversion rate** (completed orders ÷ views): the
storefront page fires `record_storefront_view` (SECURITY DEFINER RPC, `anon`-callable) from
`TrackStorefrontView` once per browser session — not for the owner's own visits — into the per-day
`seller_view_counts` rollup. Advisory (seller-only, no money effect), so the RPC is unthrottled.
The `record_storefront_view` beacon also passes the ids of the products shown → per-product
impression rollup (`product_view_counts`, RLS = seller reads own) → a "Most viewed" list on the
dashboard. `GET /seller/orders/export` streams the seller's orders as CSV (`src/lib/orders/csv.ts`,
pure). Not built: chart CSV.

**Phase 4 — reviews.** ARCHITECTURE §2.7. `reviews` (one per order, `order_id` unique). Verified-
buyer rule (rule 4) at the data layer: `reviews_verify_buyer` BEFORE INSERT (fires for every insert)
requires a `completed` order by that buyer for that seller; RLS scopes writes to
`reviewer_id = auth.uid()`, reads public, reviewer deletes own. `seller_profiles.avg_rating` rolled
up by a SECURITY DEFINER AFTER INSERT/DELETE trigger. Surfaced on the buyer order page, storefront
(header + list), shop listing, seller overview. A seller posts one public **reply** per review
(`reviews.response` / `responded_at`): `respondToReviewAction`, gated by the "reviews: seller
responds" UPDATE policy (owner of `seller_id`) + the `reviews_guard_columns` BEFORE UPDATE trigger
that freezes every column but the two response ones. Edit form on the seller overview
(`ReviewList respondable`); read-only on the storefront + buyer order page.

**Phase 4 — in-app messaging.** ARCHITECTURE §2.6. `conversations` (one per buyer+seller+order;
`order_id` NULL = general) + `messages`. Clients never write `conversations` (`get_or_create_
conversation` RPC) or update `messages` (`mark_conversation_read` RPC). RLS = "participant"
(`buyer_id = auth.uid()` OR `seller_id ∈ my seller_profiles`), via the SECURITY DEFINER
`is_conversation_participant`. `/messages` (own layout, both roles) — inbox + thread. `MessageThread`
uses Supabase Realtime (Postgres Changes) **plus a 4s visible-tab poll**; the poll is the reliable
path — **Postgres Changes must be enabled for `messages` in the Supabase dashboard** for the instant
path to work (`messages` is in `supabase_realtime` with `replica identity full`, but the hosted
project wasn't streaming it). Unread badge in both nav headers. A new message emails the recipient
(see the notification-delivery section — `message-notify`). Not built: typing/presence, attachments.

**Phase 4 — reports / flagging.** ARCHITECTURE §2.7 (the `refunds` table + Stripe refunds are
Phase 5). `reports` (one per order per reporter, `unique(order_id, reporter_id)`; `reason` enum,
`status` open→investigating→resolved/refunded). `reports_verify_reporter` BEFORE INSERT: the
reporter must be the order's buyer or own its seller_profile, and the order must be past
`pending_payment`. RLS: reporter reads own OR `is_admin()`; reporter files own; only `is_admin()`
updates. `submitReportAction` (`src/app/reports/actions.ts`, shared by both order pages) inserts +
`queueNotificationForEach` a `report_filed` to admins. Read-only-ish admin queue at `/admin`
(`requireRole("admin")`, own layout; "Admin" nav link shows only for `role = 'admin'`) — status +
resolution-note updates.

**Phase 5 — admin refunds.** `refunds` table (§2.7; party-or-admin read, no client write). An order
can be refunded across **several partial refunds** — one row per Stripe `Refund`, keyed on
`unique(stripe_refund_id)` (the `unique(order_id)` was dropped). `issueRefundAction` (admin): sums
existing `refunds`, validates the new `amount` (dollars → cents) ≤ the **remaining** balance,
`stripe.refunds.create({ payment_intent, reverse_transfer: true, amount? })` (omit `amount` = "the
rest"; pulls back from the seller/MoR proportionally), `idempotencyKey:
refund:<order_id>:<already-refunded-cents>` (advances as refunds accumulate → dedupes a double
submit), records the row (`onConflict: stripe_refund_id`) + resolves the report. **Never touches
order state.** The `charge.refunded` webhook: `fetchOrderForCharge`, take the triggering refund
(`charge.refunds.data[0]`), mirror it if `stripe_refund_id` is new, link+resolve the oldest open
report, and queue `refund_issued` (payload carries `refund_id` + this refund's `amount` + a
`cancelled` flag; deduped per refund by `notifications_refund_issued_ux` + `tolerateDuplicate`).
When the **cumulative** `charge.amount_refunded` reaches the charge total → `unwindOrder(→ cancelled)`
+ referral-invalidate. `charge.dispute.created` → `unwindOrder(→ disputed)`. Order pages sum the
refunds → "Refunded − $X" / "Partially refunded (N) − $X".

**Phase 5 — license review.** Sellers upload cottage-food permits / IDs to the private `seller-docs`
bucket; `/admin/licenses` is where an admin verifies or rejects them. `verification_status` and the
review trail (`reviewed_at` / `reviewed_by` / `review_note`) are platform-only at the data layer
(`seller_licenses_guard_status`), and `is_platform_context()` reads `current_user` — an admin over
PostgREST is `authenticated`, so the "licenses: admin all" RLS policy is **not** enough to write
them: `reviewLicenseAction` goes through the service-role client behind `requireRole("admin")`.
Verifying is what arms `license-expiry-scan` (it scans `verified` rows only), so the action refuses
to verify an already-lapsed document. A rejection must carry a note — the seller sees it on
`/seller/compliance` — and either outcome queues a `license_verified` / `license_rejected`
notification (category `compliance`, so not suppressible). Every decision then runs
`sync_seller_license_pause()` (rule 5), so verifying a document is what reopens the storefront and
withdrawing a verification is what closes it; `license_required` tells a seller paused this way what
to do. The document itself is reached only via
`GET /admin/licenses/<id>/document`, which mints a 60-second signed URL with the service-role client;
route handlers don't run the `/admin` layout, so that handler carries its own admin check.

**Phase 5 — platform analytics.** `/admin/analytics` — `getPlatformStats()`
(`src/lib/admin/analytics.ts`) reads all orders / refunds / seller_profiles / profiles /
subscriptions via the **service-role client** (allowed: it's behind the `/admin` layout's
`requireRole("admin")`), aggregated in JS. GMV (Σ `total` of completed orders) all-time + 30d, AOV,
refund total, MRR (`active` subs × $20 — trialing = $0), paying/trialing seller counts, total/live/
active-30d sellers, total/ordered buyers, 30d signups. Admin sub-nav: Reports · Licenses · Analytics · States · Programs · Settings.

**Phase 5 — state rules editor.** `/admin/states` edits `state_cottage_food_rules` (cap,
`requires_license`, notes) through the request client — RLS ("cottage rules: admin write") is the
gate and there is no guard trigger, so no service role. **Saving is the verification act**: it
stamps `verified_at` / `verified_by` (`20260904120000_state_rules_verification.sql`), which is what
separates a real figure from the seeded placeholder. All 51 rows shipped with the same invented
$50,000 cap and `requires_license = false`, and `record_order_revenue` pauses a storefront the
moment its yearly gross crosses whatever is in that column — so an unverified row is a guardrail
firing on a number nobody checked. The page says so, and `/seller/compliance` only calls the cap a
placeholder when `verified_at` is null (`getRevenueStatus().capVerified`).


**Phase 5 — state food programs (compliance reference data).** `state_food_programs`
(`20260904170000_state_food_programs.sql`) holds **69 programs across 51 jurisdictions**, seeded
from the Institute for Justice state pages read 2026-09-04. The shape matters: a seller operates in
a **program within a state**, not in a state — CA/OR/UT/VT run three each and ten more run two, with
different caps, permitted foods and online rules. Key columns: `online_orders`
(`allowed|banned|unclear` — **DE, HI, MI, MS, NV ban it under every program**, so sellers there may
list non-food only), `mail_delivery` + `mail_note`, `direct_delivery` (defaults `unclear` —
whether delivering to a buyer's door counts as a permitted venue is a legal question the source
does not answer), `cap_basis` (`annual_total|per_product|per_category` — CO caps per *product*, VA
caps only acidified), `license_threshold` (MN 7,665 / VT 6,500 / VT 10,000 — triggers licensing
rather than stopping sales), and the six category axes. Public read, admin write, and **every row
lands unverified**: IJ is a summary, not statute, and its own pages say so. `state_label_rules` is
created **empty on purpose** — disclaimer text is quoted statute that gets printed onto food, so it
needs a complete verbatim capture. Nothing enforces any of this yet; `src/lib/compliance/programs.ts`
is the read layer and `/admin/programs` shows the data and how much of it is unchecked.


**Phase 5 — product label fields.** `products` gains `ingredients` (jsonb string array),
`net_weight_value` + `net_weight_unit`, and `allergens` (`text[]`)
(`20260904190000_product_label_fields.sql`) — the three things nearly every state requires on a
homemade-food label that a product row could not previously express. **Ingredient order is
meaningful** (states require descending order of predominance by weight, so the seller's order is
the label's order — never re-sort it). The allergen vocabulary is the federal nine and is enforced
by a CHECK: a misspelling that reaches a printed label is worse than one refused at write time.
`src/lib/products/labeling.ts` is the pure half — `parseIngredients`, `parseAllergens`,
`formatAllergens`, and `formatNetWeight`, which derives the metric equivalent NC/TN/CT require
rather than asking the seller for it. Fields are optional until the label generator can require them
in exchange for something. Net weight and allergens also show on the storefront: a buyer-safety fact
belongs on the shelf, not only on the label. Production date and lot code are deliberately absent —
they are per-batch, so label printing will ask.


**Phase 5 — launch toggle.** `/admin/settings` → `setAccessModeAction` flips
`platform_settings.access_mode` `sellers_only` ↔ `public` (RLS already allows admin writes),
`revalidatePath("/", "layout")`. `public` removes the home-page early-access notice and swaps the
logged-out CTA to "Sign up to shop" / "Sell on Harvest Local" (`sellers_only` → "Start selling" /
"Sign in"). `access_mode` is presentational only — nothing hard-gates buyers from `/shop`.
