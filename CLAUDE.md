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

## Conventions

- **TypeScript strict.** No `any` without a written reason. Validate external input with Zod at the
  boundary; infer types from the schema.
- **RLS on every table.** A new table is not done until it has row-level security policies. The
  service-role key (`src/lib/supabase/admin.ts`) bypasses RLS and is used **only** in webhook
  handlers and trusted server jobs, never in a request handler driven by user input without an
  explicit authz check first.
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
supabase/migrations/                   Phase 1: core tables, RLS, seed · Phase 2: orders+pipeline, compliance · Phase 3: referrals, finalize_paid_order
src/lib/env.ts                         Zod-validated environment
src/lib/supabase/{client,server,admin}.ts   browser / server / service-role clients
src/lib/stripe/{client,config,checkout}.ts  Stripe SDK · price/coupon constants · Checkout builder
src/lib/money.ts                       server-side money helpers (cents)
src/lib/geo/{state,address,geocode,routing}.ts   geofence predicate · address schema/format · Mapbox geocoding · routing interface
src/lib/orders/{pricing,status,queries,delivery}.ts   server re-pricing · status map · order reads · delivery-fee quote
src/lib/compliance.ts                  revenue-status / license / notification reads
src/lib/analytics/queries.ts           seller dashboard stats (revenue/AOV/fulfillment/top products from orders)
src/lib/reviews/queries.ts             seller reviews + rating summary reads
src/lib/messages/queries.ts            conversation list / thread / unread-count reads
src/app/messages/                      buyer↔seller inbox + thread (own layout, both roles)
src/lib/referrals/{codes,settings,validate,queries}.ts   promo-code rules · config · checkout validation · dashboard reads
src/lib/stripe/coupons.ts              ensureBuyerDiscountCoupon (reusable percent-off)
src/lib/inngest/                       Inngest client + functions (revenue-cap, license-expiry, referral-activate/-invalidate, notification-dispatch)
src/lib/notifications/                  queue (channel fan-out) · copy (in-app lines) · templates (email) · send (Resend)
src/lib/auth.ts                        requireUser / requireRole / getProfile / getSellerContext
src/lib/rate-limit.ts                  tryRateLimit + RATE_LIMITS · check_rate_limit() Postgres fixed-window, fails open
src/proxy.ts                           Supabase session refresh (was middleware.ts)
src/instrumentation*.ts                 Sentry init (server/edge/client) · onRequestError · inert without SENTRY_DSN
src/app/(auth)/                        login, signup, email confirm
src/app/(shop)/                        buyer: /shop, /s/[slug] storefront, /cart, /checkout, /orders
src/app/(dashboard)/seller/onboarding/ Connect Accounts v2 + Billing subscription
src/app/(dashboard)/seller/products/   product CRUD
src/app/(dashboard)/seller/orders/     seller order board (advance_order_status RPC)
src/app/(dashboard)/seller/referrals/  promo codes + Referral Progress widget
src/app/(dashboard)/seller/compliance/ revenue-vs-cap, licenses, notifications
src/app/(dashboard)/seller/settings/   pickup address + local-delivery config
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
resolves the address (`auth.admin.getUserById` for email), renders via
`src/lib/notifications/templates.ts` (copy from `copy.ts`, shared with the in-app panel), sends
through Resend (`send.ts` — logs instead when `RESEND_API_KEY` is unset), marks `sent` / bumps
`attempt_count` / `failed` past 5. Optimistic `attempt_count` claim + Resend idempotency key
(`notification.id`) make overlapping runs safe. **SMS (Twilio), a `notification_prefs` opt-out
table, and buyer order-status emails are not built yet.**

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
keeps the provider swappable. Not built: saved-address book, delivery time windows, buyer
order-status emails.

**Phase 3 — seller analytics.** `/seller` overview renders `SellerStatsPanel` from
`getSellerDashboardStats()` — RLS-scoped reads of `orders` / `order_items` aggregated in JS (no
schema, no RPC). 30-day revenue (`sum(total)` of `completed` orders, bucketed by `created_at`) with
a vs-prior-30 trend, completed-order count, AOV, pickup/delivery split, delivery fees + referral
discounts, a 90-day lens, a dependency-free SVG daily-revenue chart, and top 5 products. Not built:
storefront/product view tracking → conversion rate, date-range picker, CSV export.

**Phase 4 — reviews.** ARCHITECTURE §2.7. `reviews` (one per order, `order_id` unique). Verified-
buyer rule (rule 4) at the data layer: `reviews_verify_buyer` BEFORE INSERT (fires for every insert)
requires a `completed` order by that buyer for that seller; RLS scopes writes to
`reviewer_id = auth.uid()`, reads public, reviewer deletes own. `seller_profiles.avg_rating` rolled
up by a SECURITY DEFINER AFTER INSERT/DELETE trigger. Surfaced on the buyer order page, storefront
(header + list), shop listing, seller overview.

**Phase 4 — in-app messaging.** ARCHITECTURE §2.6. `conversations` (one per buyer+seller+order;
`order_id` NULL = general) + `messages`. Clients never write `conversations` (`get_or_create_
conversation` RPC) or update `messages` (`mark_conversation_read` RPC). RLS = "participant"
(`buyer_id = auth.uid()` OR `seller_id ∈ my seller_profiles`), via the SECURITY DEFINER
`is_conversation_participant`. `/messages` (own layout, both roles) — inbox + thread. `MessageThread`
uses Supabase Realtime (Postgres Changes) **plus a 4s visible-tab poll**; the poll is the reliable
path — **Postgres Changes must be enabled for `messages` in the Supabase dashboard** for the instant
path to work (`messages` is in `supabase_realtime` with `replica identity full`, but the hosted
project wasn't streaming it). Unread badge in both nav headers. Not built: message→email
notification, typing/presence, attachments, seller review responses.

**Phase 4 — reports / flagging.** ARCHITECTURE §2.7 (the `refunds` table + Stripe refunds are
Phase 5). `reports` (one per order per reporter, `unique(order_id, reporter_id)`; `reason` enum,
`status` open→investigating→resolved/refunded). `reports_verify_reporter` BEFORE INSERT: the
reporter must be the order's buyer or own its seller_profile, and the order must be past
`pending_payment`. RLS: reporter reads own OR `is_admin()`; reporter files own; only `is_admin()`
updates. `submitReportAction` (`src/app/reports/actions.ts`, shared by both order pages) inserts +
`queueNotificationForEach` a `report_filed` to admins. Read-only-ish admin queue at `/admin`
(`requireRole("admin")`, own layout; "Admin" nav link shows only for `role = 'admin'`) — status +
resolution-note updates.

**Phase 5 — admin refunds.** `refunds` table (§2.7; `unique(order_id)`, party-or-admin read, no
client write). `issueRefundAction` (admin): `stripe.refunds.create({ payment_intent, reverse_transfer:
true })` (pulls the money back from the seller/MoR), `idempotencyKey: refund:<order_id>`, then records
the `refunds` row + sets the report `refunded`. **Never touches order state** — the `charge.refunded`
webhook does the unwind (`→ cancelled` + referral-invalidate), upserts the `refunds` mirror with
`ignoreDuplicates` (so a dashboard-issued refund also lands), and queues `refund_issued` to the buyer
+ seller. Order pages show a "Refunded − $X" line. Not built: partial refunds.

**Phase 5 — platform analytics.** `/admin/analytics` — `getPlatformStats()`
(`src/lib/admin/analytics.ts`) reads all orders / refunds / seller_profiles / profiles /
subscriptions via the **service-role client** (allowed: it's behind the `/admin` layout's
`requireRole("admin")`), aggregated in JS. GMV (Σ `total` of completed orders) all-time + 30d, AOV,
refund total, MRR (`active` subs × $20 — trialing = $0), paying/trialing seller counts, total/live/
active-30d sellers, total/ordered buyers, 30d signups. Admin sub-nav: Reports · Analytics · Settings.

**Phase 5 — launch toggle.** `/admin/settings` → `setAccessModeAction` flips
`platform_settings.access_mode` `sellers_only` ↔ `public` (RLS already allows admin writes),
`revalidatePath("/", "layout")`. `public` removes the home-page early-access notice and swaps the
logged-out CTA to "Sign up to shop" / "Sell on Harvest Local" (`sellers_only` → "Start selling" /
"Sign in"). `access_mode` is presentational only — nothing hard-gates buyers from `/shop`.
